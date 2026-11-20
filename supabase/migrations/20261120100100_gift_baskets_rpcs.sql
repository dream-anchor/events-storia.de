-- ═══════════════════════════════════════════════════════════════════════════
-- Geschenkkorb-Shop, Teil 2/3: RPCs (Bestand, öffentlicher Katalog, Admin-Statuswechsel)
-- Voraussetzung: Migration 20261120100000_gift_baskets_schema.sql
--
-- Bestandsmodell: verfügbar = stock_qty - Summe aktiver Holds (status 'held', expires_at > now()).
-- stock_qty sinkt erst bei Zahlung (gift_consume_stock) bzw. bei Übergabe (Zahlung vor Ort).
-- Race-Schutz: Variantenzeilen werden in fester Reihenfolge (ORDER BY id) mit FOR UPDATE gesperrt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Abgelaufene Holds freigeben; liefert die Bestellungen, die dadurch verfallen ──
CREATE OR REPLACE FUNCTION public.gift_sweep_expired_holds()
RETURNS TABLE (order_id uuid, payment_method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.gift_stock_holds h
     SET status = 'released'
   WHERE h.status = 'held' AND h.expires_at <= now();

  RETURN QUERY
  UPDATE public.gift_orders o
     SET status = 'expired'
   WHERE o.status IN ('pending','reserved')
     AND NOT EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status = 'held')
     AND EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status = 'released')
  RETURNING o.id, o.payment_method;
END $$;

-- ── Reservieren (Abbruch mit 'sold_out', wenn eine Variante nicht reicht) ──
-- p_items: [{"variant_id":"…","qty":2}, …]
CREATE OR REPLACE FUNCTION public.gift_reserve_stock(p_order_id uuid, p_items jsonb, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_available integer;
BEGIN
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'invalid_expiry';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no_items';
  END IF;

  PERFORM 1 FROM public.gift_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  -- Menge je Variante zusammenfassen, in fester Reihenfolge sperren (kein Deadlock)
  FOR r IN
    WITH req AS (
      SELECT (i->>'variant_id')::uuid AS variant_id, sum((i->>'qty')::integer) AS qty
        FROM jsonb_array_elements(p_items) i GROUP BY 1
    )
    SELECT v.id, v.stock_qty, req.qty
      FROM public.gift_basket_variants v
      JOIN req ON req.variant_id = v.id
     ORDER BY v.id
       FOR UPDATE OF v
  LOOP
    IF r.qty <= 0 THEN RAISE EXCEPTION 'invalid_qty'; END IF;

    PERFORM 1 FROM public.gift_basket_variants v
       JOIN public.gift_baskets b ON b.id = v.basket_id
     WHERE v.id = r.id AND v.active AND v.deleted_at IS NULL AND b.active AND b.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sold_out' USING DETAIL = r.id::text;
    END IF;

    SELECT r.stock_qty - COALESCE(sum(h.qty), 0) INTO v_available
      FROM public.gift_stock_holds h
     WHERE h.variant_id = r.id AND h.status = 'held' AND h.expires_at > now() AND h.order_id <> p_order_id;

    IF v_available < r.qty THEN
      RAISE EXCEPTION 'sold_out' USING DETAIL = r.id::text;
    END IF;

    INSERT INTO public.gift_stock_holds (order_id, variant_id, qty, expires_at)
    VALUES (p_order_id, r.id, r.qty, p_expires_at);
  END LOOP;

  IF (SELECT count(*) FROM public.gift_stock_holds WHERE order_id = p_order_id AND status = 'held')
     <> (SELECT count(DISTINCT (i->>'variant_id')) FROM jsonb_array_elements(p_items) i) THEN
    RAISE EXCEPTION 'sold_out';  -- unbekannte variant_id
  END IF;
END $$;

-- ── Bei Zahlung: Bestand dekrementieren (idempotent) ──────────────────────
-- Liefert {"consumed":bool,"oversold":bool}. oversold = Kunde hat bezahlt, Ware aber nicht
-- (mehr) verfügbar (z. B. Hold war schon abgelaufen) -> Betreiber muss erstatten/nachliefern.
CREATE OR REPLACE FUNCTION public.gift_consume_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_stock integer;
  v_other integer;
  v_any boolean := false;
  v_oversold boolean := false;
BEGIN
  FOR r IN
    SELECT h.id, h.variant_id, h.qty, h.status, h.expires_at
      FROM public.gift_stock_holds h
     WHERE h.order_id = p_order_id AND h.status IN ('held','released')
     ORDER BY h.variant_id
  LOOP
    SELECT stock_qty INTO v_stock FROM public.gift_basket_variants WHERE id = r.variant_id FOR UPDATE;

    IF r.status = 'released' OR r.expires_at <= now() THEN
      -- Späte Zahlung: nur wenn nach Abzug aller anderen aktiven Holds noch genug da ist
      SELECT COALESCE(sum(qty), 0) INTO v_other
        FROM public.gift_stock_holds
       WHERE variant_id = r.variant_id AND status = 'held' AND expires_at > now() AND order_id <> p_order_id;
      IF v_stock - v_other < r.qty THEN v_oversold := true; END IF;
    ELSIF v_stock < r.qty THEN
      v_oversold := true;   -- Bestand wurde zwischenzeitlich im Admin gesenkt
    END IF;

    UPDATE public.gift_basket_variants SET stock_qty = greatest(stock_qty - r.qty, 0) WHERE id = r.variant_id;
    UPDATE public.gift_stock_holds SET status = 'consumed' WHERE id = r.id;
    INSERT INTO public.gift_stock_log (variant_id, delta, reason, order_id)
    VALUES (r.variant_id, -r.qty, 'consume', p_order_id);
    v_any := true;
  END LOOP;

  RETURN jsonb_build_object('consumed', v_any, 'oversold', v_oversold);
END $$;

-- ── Freigeben (Stripe-Session abgelaufen, Abbruch) ─────────────────────────
CREATE OR REPLACE FUNCTION public.gift_release_stock(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.gift_stock_holds SET status = 'released' WHERE order_id = p_order_id AND status = 'held';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ── Manuelle Bestandskorrektur / Wiedereinbuchen (Admin), mit Protokoll ────
CREATE OR REPLACE FUNCTION public.gift_adjust_stock(p_variant_id uuid, p_delta integer, p_reason text DEFAULT 'manual', p_order_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new integer;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.gift_basket_variants SET stock_qty = stock_qty + p_delta
   WHERE id = p_variant_id RETURNING stock_qty INTO v_new;   -- CHECK (stock_qty >= 0) greift
  IF NOT FOUND THEN RAISE EXCEPTION 'variant_not_found'; END IF;
  INSERT INTO public.gift_stock_log (variant_id, delta, reason, order_id, created_by)
  VALUES (p_variant_id, p_delta, COALESCE(NULLIF(p_reason, ''), 'manual'), p_order_id, auth.uid());
  RETURN v_new;
END $$;

-- ── Statuswechsel im Admin (inkl. Bestandslogik für "vor Ort zahlen") ──────
CREATE OR REPLACE FUNCTION public.gift_admin_set_status(p_order_id uuid, p_status text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gift_orders%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO o FROM public.gift_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  IF NOT (
       (o.status = 'paid'     AND p_status IN ('ready','handed_over','cancelled'))
    OR (o.status = 'reserved' AND p_status IN ('ready','handed_over','cancelled'))
    OR (o.status = 'ready'    AND p_status IN ('handed_over','cancelled'))
    OR (o.status = 'pending'  AND p_status = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'invalid_transition % -> %', o.status, p_status;
  END IF;

  IF p_status = 'handed_over' THEN
    IF o.payment_method = 'on_site' THEN
      PERFORM public.gift_consume_stock(o.id);  -- Zahlung + Bestandsabgang bei Übergabe
      UPDATE public.gift_orders SET paid_at = COALESCE(paid_at, now()) WHERE id = o.id;
    END IF;
    UPDATE public.gift_orders SET handed_over_at = now() WHERE id = o.id;
  ELSIF p_status = 'cancelled' THEN
    PERFORM public.gift_release_stock(o.id);     -- verbrauchten Bestand NICHT automatisch zurück (Entscheidung 8)
    UPDATE public.gift_orders SET cancelled_at = now() WHERE id = o.id;
  END IF;

  UPDATE public.gift_orders SET status = p_status WHERE id = o.id;
  RETURN p_status;
END $$;

-- ── Öffentlicher Katalog (nur aktive Körbe/Varianten, keine Interna) ───────
CREATE OR REPLACE FUNCTION public.gift_public_catalog()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(basket ORDER BY (basket->>'sort_order')::int), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', b.id, 'slug', b.slug, 'size_key', b.size_key,
      'name_de', b.name_de, 'name_en', b.name_en,
      'description_de', b.description_de, 'description_en', b.description_en,
      'packaging_de', b.packaging_de, 'packaging_en', b.packaging_en,
      'image_url', b.image_url, 'price_cents', b.price_cents, 'sort_order', b.sort_order,
      'variants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id, 'key', v.key, 'label_de', v.label_de, 'label_en', v.label_en, 'image_url', v.image_url,
          'available', greatest(v.stock_qty - COALESCE((
              SELECT sum(h.qty) FROM public.gift_stock_holds h
               WHERE h.variant_id = v.id AND h.status = 'held' AND h.expires_at > now()), 0), 0),
          'net_content', v.net_content, 'abv_percent', v.abv_percent, 'bottler', v.bottler,
          'origin', v.origin, 'contains_sulfites', v.contains_sulfites,
          'lmiv_complete', (v.lmiv_verified_at IS NOT NULL)
        ) ORDER BY v.sort_order, v.key)
        FROM public.gift_basket_variants v
        WHERE v.basket_id = b.id AND v.active AND v.deleted_at IS NULL), '[]'::jsonb),
      'components', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name_de', c.name_de, 'name_en', c.name_en, 'quantity', c.quantity,
          'ingredients_de', c.ingredients_de, 'ingredients_en', c.ingredients_en,
          'allergens', c.allergens, 'net_content', c.net_content,
          'food_business_operator', c.food_business_operator, 'origin', c.origin,
          'lmiv_complete', (c.lmiv_verified_at IS NOT NULL)
        ) ORDER BY c.sort_order)
        FROM public.gift_basket_components c
        WHERE c.basket_id = b.id AND c.deleted_at IS NULL), '[]'::jsonb)
    ) AS basket
    FROM public.gift_baskets b
    WHERE b.active AND b.deleted_at IS NULL
  ) q;
$$;

-- ── Öffentliche Einstellungen (Termine, Sperrtage, Tarifanzeige) ───────────
CREATE OR REPLACE FUNCTION public.gift_public_settings()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'origin_label', s.origin_label,
    'pickup_hours', s.pickup_hours,
    'pickup_lead_minutes', s.pickup_lead_minutes,
    'delivery_lead_days', s.delivery_lead_days,
    'delivery_windows', s.delivery_windows,
    'min_fee_cents', s.min_fee_cents,
    'blackout_dates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', d.date, 'handover', d.handover) ORDER BY d.date)
        FROM public.gift_blackout_dates d WHERE d.date >= (now() AT TIME ZONE 'Europe/Berlin')::date), '[]'::jsonb)
  ) FROM public.gift_settings s WHERE s.id = 1;
$$;

-- ── Ausführungsrechte ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.gift_sweep_expired_holds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gift_reserve_stock(uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gift_consume_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gift_release_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_sweep_expired_holds() TO service_role;
GRANT EXECUTE ON FUNCTION public.gift_reserve_stock(uuid, jsonb, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.gift_consume_stock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gift_release_stock(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.gift_adjust_stock(uuid, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_adjust_stock(uuid, integer, text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gift_admin_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_admin_set_status(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.gift_public_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gift_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gift_public_catalog() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gift_public_settings() TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- VORBEREITUNG (auskommentiert, wie purge-retention): Sweep abgelaufener Holds per pg_cron.
-- Ohne Cron werden Holds trotzdem bei jedem Reserve-Aufruf und im Katalog (expires_at > now())
-- korrekt ignoriert; der Cron löst nur das Verfallen der Bestellung + die Kundenmail
-- ("Reservierung abgelaufen") über die Edge Function gift-expire-reservations aus.
-- Aktivieren erst nach Freigabe, Service-Key als Vault-Secret 'gift_expire_cron_service_key':
--
-- select cron.schedule('gift-expire-reservations', '*/10 * * * *', $$
--   select net.http_post(
--     url := 'https://sovlfqncotxcjqseeawp.supabase.co/functions/v1/gift-expire-reservations',
--     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
--       (select decrypted_secret from vault.decrypted_secrets where name = 'gift_expire_cron_service_key')),
--     body := '{}'::jsonb);
-- $$);
-- ═══════════════════════════════════════════════════════════════════════════
