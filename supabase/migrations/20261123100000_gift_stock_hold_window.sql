-- ═══════════════════════════════════════════════════════════════════════════
-- Geschenkkorb-Shop: Bestand bei "Zahlung vor Ort" erst ab 2 Tagen vor der Abholung belegen (Z10, Inhaber 23.11.2026)
--
-- Hintergrund: Körbe sind zeitlich unbegrenzt im Voraus bestellbar (730 Tage Sicherheitslimit), auch mit Zahlung vor Ort.
-- Körbe für ferne Termine werden kurz vorher neu gepackt. Bisher setzte gift_confirm_reservation einen Hold bis zum
-- Abholtag und blockierte den Bestand monatelang.
--
-- Neu:
--  * Hold-Status 'deferred' = bestätigte Vor-Ort-Reservierung, deren Abholtag NACH (heute Berlin + 2 Tage) liegt. Zählt NICHT
--    gegen den Bestand (Katalog/gift_reserve_stock zählen nur 'held'), ist aber ein fester Anspruch des Kunden.
--  * gift_activate_deferred_holds(): macht 'deferred' -> 'held' (bis reservation_until), sobald der Abholtag im 2-Tage-Fenster
--    liegt. Läuft im Sweep (pg_cron alle 5 Min). Reicht der Bestand dann nicht, wird der Hold TROTZDEM gesetzt (Zusage an den
--    Kunden bleibt bestehen, keine stille Stornierung), die Bestellung aber mit stock_conflict_at markiert: Admin-Badge +
--    Betreiber-Alarm (gift-expire-reservations). Der Betreiber entscheidet manuell (nachpacken/umbuchen/absagen).
--  * Ein unbestätigter 30-Min-Opt-in-Hold für einen fernen Termin ist ebenfalls 'deferred' (belegt nichts, Entscheidung 23.11. e).
--  * Status 'ready' belegt den Bestand sofort, auch vor D-2 (Entscheidung c): gift_admin_set_status aktiviert dann sofort.
--  * Bestätigung nach Mitternacht (Termin rutscht ins Fenster): gleiche Konfliktprüfung wie bei der Aktivierung.
--  * Der Konflikthinweis verschwindet automatisch, sobald der Bestand wieder reicht (Entscheidung d, im Sweep).
--  * Online bezahlte Körbe (Stripe) bleiben UNVERÄNDERT: Hold nur während der Zahlung, Abbuchung bei Zahlung.
--
-- Funktionen (jeweils vollständige letzte Fassung als Basis): gift_release_stock, gift_confirm_reservation, gift_open_counts
-- (Basis 20261121120000), gift_reserve_stock (neuer optionaler Parameter), gift_consume_stock, gift_sweep_expired_holds.
-- gift_public_catalog bleibt unverändert: Verfügbarkeit = Bestand minus aktive 'held'-Holds.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Schema ────────────────────────────────────────────────────────────────
ALTER TABLE public.gift_stock_holds DROP CONSTRAINT IF EXISTS gift_stock_holds_status_check;
ALTER TABLE public.gift_stock_holds
  ADD CONSTRAINT gift_stock_holds_status_check CHECK (status IN ('held','consumed','released','deferred'));

ALTER TABLE public.gift_orders ADD COLUMN IF NOT EXISTS stock_conflict_at timestamptz;          -- Bestand reichte beim Eintritt ins Fenster nicht
ALTER TABLE public.gift_orders ADD COLUMN IF NOT EXISTS stock_conflict_notified_at timestamptz; -- Betreiber-Alarm verschickt

-- Länge des Fensters in Tagen vor der Abholung (eine Stelle; Gegenstück im Code: _shared/giftHoldWindow.ts)
CREATE OR REPLACE FUNCTION public.gift_hold_window_days() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 2 $$;

-- ── Freigeben: auch zurückgestellte Holds (Storno) ─────────────────────────
CREATE OR REPLACE FUNCTION public.gift_release_stock(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.gift_stock_holds SET status = 'released' WHERE order_id = p_order_id AND status IN ('held','deferred');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ── Offene Reservierungen zählen: zurückgestellte (bestätigte, noch nicht belegende) zählen mit ──
-- Sonst könnte jemand beliebig viele Reservierungen für ferne Termine anlegen (Missbrauchsgrenze je E-Mail/IP).
CREATE OR REPLACE FUNCTION public.gift_open_counts(p_payment_method text, p_email text, p_ip_hash text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH open_orders AS (
    SELECT o.customer_email, o.client_ip_hash
      FROM public.gift_orders o
     WHERE o.payment_method = p_payment_method
       AND o.handover <> 'with_catering'
       AND o.status IN ('pending','awaiting_confirmation','reserved')
       AND NOT o.is_test
       AND EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id
                    AND h.status IN ('held','deferred') AND h.expires_at > now())
  )
  SELECT jsonb_build_object(
    'by_email', (SELECT count(*) FROM open_orders WHERE customer_email = p_email),
    'by_ip',    CASE WHEN p_ip_hash IS NULL THEN 0 ELSE (SELECT count(*) FROM open_orders WHERE client_ip_hash = p_ip_hash) END
  );
$$;

-- ── Double-Opt-in einlösen ─────────────────────────────────────────────────
-- Wie bisher, aber: liegt der Abholtag nach (heute Berlin + gift_hold_window_days()), werden die Holds auf 'deferred'
-- gestellt statt bis Ladenschluss verlängert. Der Bestand wird erst von gift_activate_deferred_holds belegt.
CREATE OR REPLACE FUNCTION public.gift_confirm_reservation(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gift_orders%ROWTYPE; v_far boolean;
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

  IF NOT EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status IN ('held','deferred') AND h.expires_at > now())
     OR o.reservation_until IS NULL OR o.reservation_until <= now() THEN
    UPDATE public.gift_stock_holds SET status = 'released' WHERE order_id = o.id AND status IN ('held','deferred');
    UPDATE public.gift_orders SET status = 'expired' WHERE id = o.id;
    RETURN jsonb_build_object('status', 'expired', 'order_id', o.id);
  END IF;

  v_far := o.handover_date > (now() AT TIME ZONE 'Europe/Berlin')::date + public.gift_hold_window_days();
  UPDATE public.gift_orders SET status = 'reserved', confirmed_at = now() WHERE id = o.id;
  IF v_far THEN
    -- fernes Datum: Anspruch merken, Bestand noch nicht belegen (expires_at = Ende der Reservierung, gilt ab Aktivierung)
    UPDATE public.gift_stock_holds SET expires_at = o.reservation_until WHERE order_id = o.id AND status = 'deferred';
  ELSE
    -- im Fenster (auch: Bestellung vor Mitternacht für Tag+3, Klick danach): gültige Holds verlängern, zurückgestellte jetzt
    -- belegen MIT Konfliktprüfung (Überbuchung wird markiert und alarmiert, nie still)
    UPDATE public.gift_stock_holds SET expires_at = o.reservation_until WHERE order_id = o.id AND status = 'held';
    PERFORM public.gift_activate_order_holds(o.id);
  END IF;
  RETURN jsonb_build_object('status', 'confirmed', 'order_id', o.id, 'deferred', v_far);
END $$;

-- ── Reservieren ────────────────────────────────────────────────────────────
-- Neu: p_check_stock (Standard true). Für Vor-Ort-Bestellungen mit Abholtag außerhalb des Fensters ruft create-gift-order mit
-- false auf: Der 30-Minuten-Hold (Double-Opt-in) entsteht als 'deferred', belegt also keinen Bestand und prüft die heutige Menge
-- nicht (Korb wird erst kurz vorher gepackt). Aktive/gelöschte Körbe und Mengen werden weiterhin geprüft.
-- Der alte Aufruf mit 3 Argumenten funktioniert unverändert (Standardwert).
DROP FUNCTION IF EXISTS public.gift_reserve_stock(uuid, jsonb, timestamptz);
CREATE OR REPLACE FUNCTION public.gift_reserve_stock(p_order_id uuid, p_items jsonb, p_expires_at timestamptz, p_check_stock boolean DEFAULT true)
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

    IF p_check_stock AND NOT r.stock_unlimited THEN
      SELECT r.stock_qty - COALESCE(sum(h.qty), 0) INTO v_available
        FROM public.gift_stock_holds h
       WHERE h.variant_id = r.id AND h.status = 'held' AND h.expires_at > now() AND h.order_id <> p_order_id;

      IF v_available < r.qty THEN
        RAISE EXCEPTION 'sold_out' USING DETAIL = r.id::text;
      END IF;
    END IF;

    -- ohne Bestandsprüfung (ferner Termin) belegt der Hold nichts: 'deferred' (Entscheidung 23.11. e)
    INSERT INTO public.gift_stock_holds (order_id, variant_id, qty, expires_at, status)
    VALUES (p_order_id, r.id, r.qty, p_expires_at, CASE WHEN p_check_stock THEN 'held' ELSE 'deferred' END);
  END LOOP;

  IF (SELECT count(*) FROM public.gift_stock_holds WHERE order_id = p_order_id AND status IN ('held','deferred'))
     <> (SELECT count(DISTINCT (i->>'variant_id')) FROM jsonb_array_elements(p_items) i) THEN
    RAISE EXCEPTION 'sold_out';  -- unbekannte variant_id
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.gift_reserve_stock(uuid, jsonb, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_reserve_stock(uuid, jsonb, timestamptz, boolean) TO service_role;

-- ── Bei Zahlung/Übergabe: Bestand dekrementieren ───────────────────────────
-- Wie bisher; zusätzlich werden zurückgestellte Holds berücksichtigt (Übergabe vor Eintritt ins Fenster, z. B. Admin gibt früher
-- aus). Ein zurückgestellter Hold hat nie Bestand belegt und wird deshalb wie ein freigegebener behandelt: frei ist, was nach
-- Abzug fremder aktiver Holds übrig ist; reicht es nicht, meldet oversold das sofort.
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
  PERFORM 1 FROM public.gift_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  FOR r IN
    SELECT h.id, h.variant_id, h.qty, h.status, h.expires_at
      FROM public.gift_stock_holds h
     WHERE h.order_id = p_order_id AND h.status IN ('held','released','deferred')
     ORDER BY h.variant_id
       FOR UPDATE OF h
  LOOP
    SELECT stock_qty, stock_unlimited INTO v_stock, v_unlimited FROM public.gift_basket_variants WHERE id = r.variant_id FOR UPDATE;

    IF v_unlimited THEN
      UPDATE public.gift_stock_holds SET status = 'consumed' WHERE id = r.id;
      v_any := true;
      CONTINUE;
    END IF;

    IF r.status IN ('released','deferred') OR r.expires_at <= now() THEN
      SELECT COALESCE(sum(qty), 0) INTO v_other
        FROM public.gift_stock_holds
       WHERE variant_id = r.variant_id AND status = 'held' AND expires_at > now() AND order_id <> p_order_id;
      v_free := greatest(v_stock - v_other, 0);
    ELSE
      v_free := greatest(v_stock, 0);   -- eigener Hold gültig
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

-- ── Zurückgestellte Holds EINER Bestellung belegen (mit Konfliktprüfung) ───
-- Aufrufer hält die Bestellungssperre. Setzt 'deferred' -> 'held' bis reservation_until. Reicht der Bestand nicht, wird der Hold
-- TROTZDEM gesetzt (bestätigte Zusage, keine stille Stornierung) und gift_orders.stock_conflict_at gesetzt (Admin-Badge +
-- Betreiber-Alarm). Liefert true bei Konflikt. Varianten werden in ID-Reihenfolge gesperrt.
CREATE OR REPLACE FUNCTION public.gift_activate_order_holds(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h record;
  v_until timestamptz;
  v_stock integer;
  v_unlimited boolean;
  v_other integer;
  v_conflict boolean := false;
BEGIN
  SELECT reservation_until INTO v_until FROM public.gift_orders WHERE id = p_order_id;
  FOR h IN
    SELECT x.id, x.variant_id, x.qty, x.expires_at FROM public.gift_stock_holds x
     WHERE x.order_id = p_order_id AND x.status = 'deferred' ORDER BY x.variant_id FOR UPDATE OF x
  LOOP
    SELECT stock_qty, stock_unlimited INTO v_stock, v_unlimited FROM public.gift_basket_variants WHERE id = h.variant_id FOR UPDATE;
    IF NOT v_unlimited THEN
      SELECT COALESCE(sum(qty), 0) INTO v_other
        FROM public.gift_stock_holds
       WHERE variant_id = h.variant_id AND status = 'held' AND expires_at > now() AND order_id <> p_order_id;
      IF v_stock - v_other < h.qty THEN v_conflict := true; END IF;
    END IF;
    UPDATE public.gift_stock_holds SET status = 'held', expires_at = COALESCE(v_until, h.expires_at) WHERE id = h.id;
  END LOOP;
  IF v_conflict THEN
    UPDATE public.gift_orders SET stock_conflict_at = COALESCE(stock_conflict_at, now()) WHERE id = p_order_id;
  END IF;
  RETURN v_conflict;
END $$;
REVOKE ALL ON FUNCTION public.gift_activate_order_holds(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_activate_order_holds(uuid) TO service_role;

-- ── Zurückgestellte Holds aktivieren (Eintritt ins 2-Tage-Fenster) + Konflikthinweis aufräumen ──
-- Liefert je aktivierter Bestellung, ob der Bestand NICHT reichte (conflict). Reservierungen, deren Ende (reservation_until)
-- schon vorbei ist (Sweep stand lange), verfallen. Danach: Konflikthinweise, die nicht mehr zutreffen (Bestand wurde erhöht,
-- Konkurrenz storniert), werden samt Alarm-Marker zurückgesetzt, ein neuer Konflikt alarmiert dann wieder (Entscheidung d).
-- Sperren: zuerst alle betroffenen Varianten in ID-Reihenfolge, dann die Bestellungen mit SKIP LOCKED (wartet nie auf eine
-- Bestellung, die gerade reserviert/bestätigt wird). Ein Deadlock überspringt die Bestellung bis zum nächsten Lauf.
CREATE OR REPLACE FUNCTION public.gift_activate_deferred_holds()
RETURNS TABLE (order_id uuid, order_number text, conflict boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  r record;
  v_conflict boolean;
BEGIN
  PERFORM 1 FROM public.gift_basket_variants v
   WHERE v.id IN (SELECT x.variant_id FROM public.gift_stock_holds x
                    JOIN public.gift_orders o ON o.id = x.order_id
                   WHERE x.status = 'deferred' AND o.status IN ('reserved','ready') AND o.payment_method = 'on_site'
                     AND o.handover_date <= (now() AT TIME ZONE 'Europe/Berlin')::date + public.gift_hold_window_days())
   ORDER BY v.id FOR UPDATE;

  FOR r IN
    SELECT o.id, o.order_number, o.reservation_until
      FROM public.gift_orders o
     WHERE o.status IN ('reserved','ready') AND o.payment_method = 'on_site'
       AND o.handover_date <= (now() AT TIME ZONE 'Europe/Berlin')::date + public.gift_hold_window_days()
       AND EXISTS (SELECT 1 FROM public.gift_stock_holds x WHERE x.order_id = o.id AND x.status = 'deferred')
     ORDER BY o.id
       FOR UPDATE OF o SKIP LOCKED
  LOOP
    BEGIN
      IF r.reservation_until IS NULL OR r.reservation_until <= now() THEN
        UPDATE public.gift_stock_holds SET status = 'released' WHERE order_id = r.id AND status = 'deferred';
        UPDATE public.gift_orders SET status = 'expired' WHERE id = r.id AND status = 'reserved';
        CONTINUE;
      END IF;
      v_conflict := public.gift_activate_order_holds(r.id);
      order_id := r.id; order_number := r.order_number; conflict := v_conflict;
      RETURN NEXT;
    EXCEPTION WHEN deadlock_detected THEN
      NULL;  -- nächster Lauf (Sweep alle 5 Min)
    END;
  END LOOP;

  BEGIN
    UPDATE public.gift_orders o SET stock_conflict_at = NULL, stock_conflict_notified_at = NULL
     WHERE o.stock_conflict_at IS NOT NULL AND o.status IN ('reserved','ready')
       AND NOT EXISTS (
         SELECT 1 FROM public.gift_stock_holds h JOIN public.gift_basket_variants v ON v.id = h.variant_id
          WHERE h.order_id = o.id AND h.status IN ('held','deferred') AND NOT v.stock_unlimited
            AND v.stock_qty - COALESCE((SELECT sum(x.qty) FROM public.gift_stock_holds x
                                         WHERE x.variant_id = h.variant_id AND x.status = 'held' AND x.expires_at > now()
                                           AND x.order_id <> o.id), 0) < h.qty);
  EXCEPTION WHEN deadlock_detected THEN
    NULL;
  END;
END $$;

REVOKE ALL ON FUNCTION public.gift_activate_deferred_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_activate_deferred_holds() TO service_role;
REVOKE ALL ON FUNCTION public.gift_hold_window_days() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_hold_window_days() TO service_role;

-- ── Sweep: zuerst zurückgestellte Holds aktivieren, dann Abgelaufenes freigeben ──
-- Sonst identisch zur Fassung aus 20261120100100, zusätzlich verfallen abgelaufene 'deferred'-Holds (unbestätigte ferne
-- Opt-ins nach 30 Min, Reservierungen nach reservation_until). Die Aktivierung darf den Sweep nie blockieren; Fehler hier
-- nur als WARNING, die Edge Function gift-expire-reservations ruft sie zusätzlich eigenständig auf und meldet Fehler.
CREATE OR REPLACE FUNCTION public.gift_sweep_expired_holds()
RETURNS TABLE (order_id uuid, payment_method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE r record;
BEGIN
  BEGIN
    PERFORM public.gift_activate_deferred_holds();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'gift_activate_deferred_holds fehlgeschlagen: %', SQLERRM;
  END;

  FOR r IN
    SELECT o.id, o.payment_method
      FROM public.gift_orders o
     WHERE o.status IN ('pending','awaiting_confirmation','reserved')
       AND (
         EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status IN ('held','deferred') AND h.expires_at <= now())
         OR (NOT EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status IN ('held','deferred'))
             AND EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = o.id AND h.status = 'released'))
       )
     ORDER BY o.id
       FOR UPDATE OF o
  LOOP
    UPDATE public.gift_stock_holds h SET status = 'released'
     WHERE h.order_id = r.id AND h.status IN ('held','deferred') AND h.expires_at <= now();

    IF NOT EXISTS (SELECT 1 FROM public.gift_stock_holds h WHERE h.order_id = r.id AND h.status IN ('held','deferred')) THEN
      UPDATE public.gift_orders SET status = 'expired' WHERE id = r.id;
      order_id := r.id; payment_method := r.payment_method;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- Datenschutz: IP-Hash abgeschlossener Bestellungen löschen (der Trigger erledigt es beim Statuswechsel, hier Altbestände)
  UPDATE public.gift_orders SET client_ip_hash = NULL
   WHERE client_ip_hash IS NOT NULL AND status IN ('handed_over','cancelled','expired','refunded');
END $$;

-- ── Statuswechsel im Admin: 'ready' belegt den Bestand sofort (Entscheidung c) ──
-- Vollständige letzte Fassung aus 20261120100100, zusätzlich: bei 'ready' werden zurückgestellte Holds sofort belegt und
-- geprüft; Konflikt = derselbe Marker/Alarm wie bei der Aktivierung. Rückgabe zusätzlich {"conflict":bool}.
CREATE OR REPLACE FUNCTION public.gift_admin_set_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.gift_orders%ROWTYPE;
  v_consume jsonb;
  v_oversold boolean := false;
  v_conflict boolean := false;
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
  ELSIF p_status = 'ready' AND o.payment_method = 'on_site' THEN
    v_conflict := public.gift_activate_order_holds(o.id);   -- 'Bereit' belegt den Bestand sofort, auch vor D-2
  END IF;

  UPDATE public.gift_orders SET status = p_status WHERE id = o.id;
  RETURN jsonb_build_object('status', p_status, 'oversold', v_oversold, 'conflict', v_conflict);
END $$;
