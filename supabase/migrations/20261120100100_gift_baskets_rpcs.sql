-- ═══════════════════════════════════════════════════════════════════════════
-- Geschenkkorb-Shop, Teil 2/3: RPCs (Bestand, öffentlicher Katalog, Admin-Statuswechsel)
-- Voraussetzung: Migration 20261120100000_gift_baskets_schema.sql
--
-- Bestandsmodell: Standard UNBEGRENZT (stock_unlimited, Inhaber 20.11.2026): keine Mengenprüfung, kein Abzug.
-- Bei fester Menge/ausverkauft: verfügbar = stock_qty - Summe aktiver Holds (status 'held', expires_at > now()).
-- stock_qty sinkt erst bei Zahlung (gift_consume_stock) bzw. bei Übergabe (Zahlung vor Ort).
-- Zahlung vor Ort = Double-Opt-in: awaiting_confirmation (Hold 30 Min) -> gift_confirm_reservation -> reserved.
-- Race-Schutz: Variantenzeilen werden in fester Reihenfolge (ORDER BY id) mit FOR UPDATE gesperrt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Abgelaufene Holds freigeben; liefert die Bestellungen, die dadurch verfallen ──
-- Sperrreihenfolge (überall gleich, kein Deadlock): ZUERST die Bestellung (ORDER BY id), DANACH deren Holds.
-- Verfällt: pending (Stripe nicht abgeschlossen), awaiting_confirmation (Bestätigungslink nicht angeklickt, 30 Min),
-- reserved (nicht abgeholt bis Ladenschluss). Der Sweep läuft per pg_cron (unten) und zusätzlich lazy aus create-gift-order.
CREATE OR REPLACE FUNCTION public.gift_sweep_expired_holds()
RETURNS TABLE (order_id uuid, payment_method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE r record;
BEGIN
  FOR r IN
    SELECT o.id, o.payment_method
      FROM public.gift_orders o
     WHERE o.status IN ('pending','awaiting_confirmation','reserved')
       AND (
         EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status = 'held' AND h.expires_at <= now())
         OR (NOT EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status = 'held')
             AND EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status = 'released'))
       )
     ORDER BY o.id
       FOR UPDATE OF o
  LOOP
    UPDATE public.gift_stock_holds h SET status = 'released'
     WHERE h.order_id = r.id AND h.status = 'held' AND h.expires_at <= now();

    IF NOT EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = r.id AND h.status = 'held') THEN
      UPDATE public.gift_orders SET status = 'expired' WHERE id = r.id;
      order_id := r.id; payment_method := r.payment_method;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- Datenschutz: IP-Hash abgeschlossener Bestellungen löschen (der Trigger erledigt es beim Statuswechsel, hier Altbestände)
  UPDATE public.gift_orders SET client_ip_hash = NULL
   WHERE client_ip_hash IS NOT NULL AND status IN ('handed_over','cancelled','expired','refunded');
END $$;

-- ── Offene Reservierungen/Checkout-Holds je E-Mail und je IP zählen (Missbrauchsgrenze) ──
-- "Offen" = Status pending/awaiting_confirmation/reserved UND mindestens ein NOCH GÜLTIGER Hold (expires_at > now()):
-- abgelaufene oder unbestätigt verfallene Bestellungen zählen nie mit, auch wenn der Sweep noch nicht gelaufen ist.
-- Echte Bestellungen (is_test = false). Zählt p_payment_method getrennt (online | on_site).
CREATE OR REPLACE FUNCTION public.gift_open_counts(p_payment_method text, p_email text, p_ip_hash text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH open_orders AS (
    SELECT o.customer_email, o.client_ip_hash
      FROM public.gift_orders o
     WHERE o.payment_method = p_payment_method
       AND o.status IN ('pending','awaiting_confirmation','reserved')
       AND NOT o.is_test
       AND EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status = 'held' AND h.expires_at > now())
  )
  SELECT jsonb_build_object(
    'by_email', (SELECT count(*) FROM open_orders WHERE customer_email = p_email),
    'by_ip',    CASE WHEN p_ip_hash IS NULL THEN 0 ELSE (SELECT count(*) FROM open_orders WHERE client_ip_hash = p_ip_hash) END
  );
$$;

-- ── Double-Opt-in: Bestätigungslink einlösen ("vor Ort zahlen") ─────────────
-- Token wird nur als SHA-256 gespeichert; p_token_hash = Hash des Links. Ergebnis status:
--   confirmed         erster Klick: Hold wird bis reservation_until (Ladenschluss Abholtag) verlängert, Status 'reserved'
--   already_confirmed Link wurde schon eingelöst (Idempotenz, zweiter Klick ändert nichts)
--   expired           30 Min überschritten / Bestellung verfallen oder storniert
--   invalid           unbekannter Token
-- Sperrreihenfolge: Bestellung, dann Holds.
CREATE OR REPLACE FUNCTION public.gift_confirm_reservation(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gift_orders%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  SELECT * INTO o FROM public.gift_orders WHERE confirm_token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid'); END IF;

  IF o.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_confirmed', 'order_id', o.id);
  END IF;
  IF o.status <> 'awaiting_confirmation' THEN
    RETURN jsonb_build_object('status', 'expired', 'order_id', o.id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status = 'held' AND h.expires_at > now())
     OR o.reservation_until IS NULL OR o.reservation_until <= now() THEN
    UPDATE public.gift_stock_holds SET status = 'released' WHERE order_id = o.id AND status = 'held';
    UPDATE public.gift_orders SET status = 'expired' WHERE id = o.id;
    RETURN jsonb_build_object('status', 'expired', 'order_id', o.id);
  END IF;

  UPDATE public.gift_stock_holds SET expires_at = o.reservation_until WHERE order_id = o.id AND status = 'held';
  UPDATE public.gift_orders SET status = 'reserved', confirmed_at = now() WHERE id = o.id;
  RETURN jsonb_build_object('status', 'confirmed', 'order_id', o.id);
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
    SELECT v.id, v.stock_qty, v.stock_unlimited, req.qty
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

    IF NOT r.stock_unlimited THEN
      SELECT r.stock_qty - COALESCE(sum(h.qty), 0) INTO v_available
        FROM public.gift_stock_holds h
       WHERE h.variant_id = r.id AND h.status = 'held' AND h.expires_at > now() AND h.order_id <> p_order_id;

      IF v_available < r.qty THEN
        RAISE EXCEPTION 'sold_out' USING DETAIL = r.id::text;
      END IF;
    END IF;

    INSERT INTO public.gift_stock_holds (order_id, variant_id, qty, expires_at)
    VALUES (p_order_id, r.id, r.qty, p_expires_at);
  END LOOP;

  IF (SELECT count(*) FROM public.gift_stock_holds WHERE order_id = p_order_id AND status = 'held')
     <> (SELECT count(DISTINCT (i->>'variant_id')) FROM jsonb_array_elements(p_items) i) THEN
    RAISE EXCEPTION 'sold_out';  -- unbekannte variant_id
  END IF;
END $$;

-- ── Bei Zahlung: Bestand dekrementieren (idempotent, parallel-sicher) ──────
-- Liefert {"consumed":bool,"oversold":bool}. oversold = Kunde hat bezahlt, Ware aber nicht
-- (mehr) in voller Menge verfügbar (z. B. Hold war schon abgelaufen) -> Betreiber muss erstatten/nachliefern.
-- Abgebucht wird dann nur der FREIE Anteil (nie Bestand, der durch fremde aktive Holds belegt ist, und nie < 0).
-- Sperrreihenfolge (überall gleich, kein Deadlock): Bestellung -> Holds -> Variante.
CREATE OR REPLACE FUNCTION public.gift_consume_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_stock integer;
  v_unlimited boolean;
  v_other integer;
  v_free integer;
  v_deduct integer;
  v_any boolean := false;
  v_oversold boolean := false;
BEGIN
  -- Serialisiert parallele Aufrufe je Bestellung (Webhook-Wiederholung, Admin-Übergabe): der zweite Aufruf
  -- sieht danach nur noch 'consumed'-Holds und bucht nichts doppelt ab.
  PERFORM 1 FROM public.gift_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  FOR r IN
    SELECT h.id, h.variant_id, h.qty, h.status, h.expires_at
      FROM public.gift_stock_holds h
     WHERE h.order_id = p_order_id AND h.status IN ('held','released')
     ORDER BY h.variant_id
       FOR UPDATE OF h
  LOOP
    SELECT stock_qty, stock_unlimited INTO v_stock, v_unlimited FROM public.gift_basket_variants WHERE id = r.variant_id FOR UPDATE;

    IF v_unlimited THEN
      -- unbegrenzter Bestand: kein Abzug, nie "oversold"; Hold nur als verbraucht markieren (Idempotenz)
      UPDATE public.gift_stock_holds SET status = 'consumed' WHERE id = r.id;
      v_any := true;
      CONTINUE;
    END IF;

    IF r.status = 'released' OR r.expires_at <= now() THEN
      -- Späte Zahlung: frei ist, was nach Abzug aller anderen aktiven Holds übrig ist
      SELECT COALESCE(sum(qty), 0) INTO v_other
        FROM public.gift_stock_holds
       WHERE variant_id = r.variant_id AND status = 'held' AND expires_at > now() AND order_id <> p_order_id;
      v_free := greatest(v_stock - v_other, 0);
    ELSE
      v_free := greatest(v_stock, 0);   -- eigener Hold gültig; unter Wert nur, wenn Bestand im Admin gesenkt wurde
    END IF;

    v_deduct := least(r.qty, v_free);
    IF v_deduct < r.qty THEN v_oversold := true; END IF;

    IF v_deduct > 0 THEN
      UPDATE public.gift_basket_variants SET stock_qty = stock_qty - v_deduct WHERE id = r.variant_id;
      INSERT INTO public.gift_stock_log (variant_id, delta, reason, order_id)
      VALUES (r.variant_id, -v_deduct, 'consume', p_order_id);
    END IF;
    UPDATE public.gift_stock_holds SET status = 'consumed' WHERE id = r.id;
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

-- ── Bestandsmodus je Variante (Admin): unlimited | sold_out | fixed ───────────
-- unlimited = Standard (keine Mengenprüfung); sold_out = fest 0 (Shop zeigt "ausverkauft"); fixed = feste Menge p_qty.
-- Wieder freigeben = unlimited oder fixed. Protokoll in gift_stock_log (reason mode_<modus>, delta = Mengenänderung).
CREATE OR REPLACE FUNCTION public.gift_set_stock_mode(p_variant_id uuid, p_mode text, p_qty integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.gift_basket_variants%ROWTYPE;
  v_new integer;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_mode NOT IN ('unlimited','sold_out','fixed') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  IF p_mode = 'fixed' AND (p_qty IS NULL OR p_qty < 0) THEN RAISE EXCEPTION 'invalid_qty'; END IF;
  SELECT * INTO v FROM public.gift_basket_variants WHERE id = p_variant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'variant_not_found'; END IF;

  v_new := CASE p_mode WHEN 'sold_out' THEN 0 WHEN 'fixed' THEN p_qty ELSE v.stock_qty END;
  UPDATE public.gift_basket_variants
     SET stock_unlimited = (p_mode = 'unlimited'), stock_qty = v_new
   WHERE id = p_variant_id;
  INSERT INTO public.gift_stock_log (variant_id, delta, reason, created_by)
  VALUES (p_variant_id, v_new - v.stock_qty, 'mode_' || p_mode, auth.uid());
  RETURN jsonb_build_object('mode', p_mode, 'stock_qty', v_new);
END $$;

-- ── Statuswechsel im Admin (inkl. Bestandslogik für "vor Ort zahlen") ──────
-- Rückgabe {"status":…, "oversold":bool}: oversold = bei Übergabe/Bezahlung vor Ort war nicht mehr die volle Menge
-- verfügbar (z. B. Bestand im Admin gesenkt) -> das Admin-UI weist darauf hin.
CREATE OR REPLACE FUNCTION public.gift_admin_set_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.gift_orders%ROWTYPE;
  v_consume jsonb;
  v_oversold boolean := false;
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
    OR (o.status IN ('pending','awaiting_confirmation') AND p_status = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'invalid_transition % -> %', o.status, p_status;
  END IF;

  IF p_status = 'handed_over' THEN
    IF o.payment_method = 'on_site' THEN
      v_consume := public.gift_consume_stock(o.id);  -- Zahlung + Bestandsabgang bei Übergabe
      v_oversold := COALESCE((v_consume->>'oversold')::boolean, false);
      UPDATE public.gift_orders SET paid_at = COALESCE(paid_at, now()) WHERE id = o.id;
    END IF;
    UPDATE public.gift_orders SET handed_over_at = now() WHERE id = o.id;
  ELSIF p_status = 'cancelled' THEN
    PERFORM public.gift_release_stock(o.id);     -- verbrauchten Bestand NICHT automatisch zurück (Entscheidung 8)
    UPDATE public.gift_orders SET cancelled_at = now() WHERE id = o.id;
  END IF;

  UPDATE public.gift_orders SET status = p_status WHERE id = o.id;
  RETURN jsonb_build_object('status', p_status, 'oversold', v_oversold);
END $$;

-- ── Wieder einbuchen nach Storno/Erstattung (Admin), idempotent über gift_orders.restocked_at ──
-- Bucht genau die Mengen zurück, die gift_consume_stock für diese Bestellung abgebucht hat (Protokoll 'consume'),
-- nicht die Bestellmenge (bei Überverkauf wurde weniger abgebucht). Zweiter Aufruf ist ein No-Op.
CREATE OR REPLACE FUNCTION public.gift_restock_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.gift_orders%ROWTYPE;
  r record;
  v_units integer := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO o FROM public.gift_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.status NOT IN ('cancelled','refunded') THEN RAISE EXCEPTION 'invalid_status %', o.status; END IF;
  IF o.restocked_at IS NOT NULL THEN
    RETURN jsonb_build_object('restocked', false, 'units', 0, 'already', true);
  END IF;

  FOR r IN
    SELECT l.variant_id, -sum(l.delta) AS qty
      FROM public.gift_stock_log l
      JOIN public.gift_basket_variants bv ON bv.id = l.variant_id AND NOT bv.stock_unlimited   -- unbegrenzt: nichts abgebucht, nichts einzubuchen
     WHERE l.order_id = o.id AND l.reason = 'consume'
     GROUP BY l.variant_id
     ORDER BY l.variant_id
  LOOP
    IF r.qty > 0 THEN
      UPDATE public.gift_basket_variants SET stock_qty = stock_qty + r.qty WHERE id = r.variant_id;
      INSERT INTO public.gift_stock_log (variant_id, delta, reason, order_id, created_by)
      VALUES (r.variant_id, r.qty, 'restock_after_cancel', o.id, auth.uid());
      v_units := v_units + r.qty;
    END IF;
  END LOOP;

  UPDATE public.gift_orders SET restocked_at = now() WHERE id = o.id;
  RETURN jsonb_build_object('restocked', v_units > 0, 'units', v_units, 'already', false);
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
          'unlimited', v.stock_unlimited,
          'available', CASE WHEN v.stock_unlimited THEN NULL ELSE greatest(v.stock_qty - COALESCE((
              SELECT sum(h.qty) FROM public.gift_stock_holds h
               WHERE h.variant_id = v.id AND h.status = 'held' AND h.expires_at > now()), 0), 0) END,
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
REVOKE ALL ON FUNCTION public.gift_open_counts(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gift_confirm_reservation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_sweep_expired_holds() TO service_role;
GRANT EXECUTE ON FUNCTION public.gift_open_counts(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gift_confirm_reservation(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gift_reserve_stock(uuid, jsonb, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.gift_consume_stock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gift_release_stock(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.gift_adjust_stock(uuid, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_adjust_stock(uuid, integer, text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gift_admin_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_admin_set_status(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.gift_set_stock_mode(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_set_stock_mode(uuid, text, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gift_restock_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_restock_order(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.gift_public_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gift_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gift_public_catalog() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gift_public_settings() TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Cron (aktiv): Ablauf-Sweep. Muster wie 20260416192913 (pg_cron + pg_net, idempotent: erst unschedule).
--  1) gift-sweep-holds (alle 5 Min, reines SQL, braucht KEIN Secret): gibt abgelaufene Holds/Bestellungen frei
--     (unbestätigte Reservierungen nach 30 Min, nicht abgeholte nach Ladenschluss, nicht bezahlte Checkouts).
--     Der Bestand wird zusätzlich schon jetzt korrekt gezählt (expires_at > now() im Katalog/Reserve), und create-gift-order
--     ruft den Sweep lazy vor jeder Bestellung auf; der Cron sorgt dafür, dass Status/Admin-Liste aktuell bleiben.
--  2) gift-expire-reservations (alle 10 Min, Edge Function): "Reservierung abgelaufen"-Mail, Wiederholung fehlgeschlagener
--     Bestätigungsmails/Rechnungen (max. 3 Versuche, danach Betreiber-Alarm). Aufruf OHNE Secret (Lovable darf keine
--     Migrationen mit Secret-Zugriff einspielen). Die Function ist idempotent, Wiederholungen sind je Bestellung auf 3
--     begrenzt, und ohne Service-Role-Key läuft sie höchstens alle 4 Minuten (gift_claim_cron_run).
-- ═══════════════════════════════════════════════════════════════════════════
-- Drossel für den Ablauf-Sweep (Aufrufe ohne Service-Role-Key, z. B. pg_cron): höchstens ein Lauf je p_min_seconds.
CREATE TABLE IF NOT EXISTS public.gift_cron_runs (
  name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL
);
ALTER TABLE public.gift_cron_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gift_claim_cron_run(p_name text, p_min_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_claimed boolean;
BEGIN
  INSERT INTO public.gift_cron_runs (name, last_run_at) VALUES (p_name, now())
  ON CONFLICT (name) DO UPDATE SET last_run_at = now()
    WHERE public.gift_cron_runs.last_run_at < now() - make_interval(secs => p_min_seconds)
  RETURNING true INTO v_claimed;
  RETURN COALESCE(v_claimed, false);
END $fn$;
REVOKE ALL ON FUNCTION public.gift_claim_cron_run(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_claim_cron_run(text, integer) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE j bigint;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('gift-sweep-holds', 'gift-expire-reservations') LOOP
    PERFORM cron.unschedule(j);
  END LOOP;
END $$;

SELECT cron.schedule('gift-sweep-holds', '*/5 * * * *', $cron$ SELECT public.gift_sweep_expired_holds(); $cron$);

SELECT cron.schedule('gift-expire-reservations', '*/10 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://sovlfqncotxcjqseeawp.supabase.co/functions/v1/gift-expire-reservations',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb);
$cron$);
