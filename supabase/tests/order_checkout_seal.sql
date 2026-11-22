-- SQL-Tests Abdichtung (Migration 20261122110000_order_checkout_seal.sql). NUR gegen eine Wegwerf-/Branch-DB (NIE Produktion),
-- nach der Preisprüf-Migration und nach der Sperr-Migration:
--   psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/order_checkout_seal.sql
-- oder komplett ohne Datenbank: node supabase/tests/run-sql-tests.mjs
-- Rollen werden per SET LOCAL ROLE gewechselt, das JWT über request.jwt.claims simuliert. Alles in einer Transaktion, ROLLBACK am Ende.
BEGIN;

-- Führt ein Statement als Rolle aus. Rückgabe: 'ok' oder SQLSTATE (z. B. 42501 = Recht fehlt / RLS / Trigger-Sperre).
CREATE FUNCTION pg_temp.try_as(p_role text, p_sub uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_sub)::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub::text, ''), true);
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    EXECUTE p_sql;
    RESET ROLE;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN SQLSTATE;
  END;
END $$;

CREATE FUNCTION pg_temp.expect(p_label text, p_got text, p_want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN RAISE EXCEPTION 'FEHLER [%]: erwartet %, erhalten %', p_label, p_want, p_got; END IF;
END $$;

DO $$
DECLARE
  u_admin uuid := gen_random_uuid(); u_staff uuid := gen_random_uuid(); u_cust uuid := gen_random_uuid();
  m uuid; c uuid; i uuid; pkg uuid;
  cat_payload text; evt_payload text; ev record; n integer;
BEGIN
  INSERT INTO user_roles (user_id, role) VALUES (u_admin, 'admin'), (u_staff, 'staff');
  INSERT INTO menus (menu_type, slug, is_published) VALUES ('catering', 'seal-test', true) RETURNING id INTO m;
  INSERT INTO menu_categories (menu_id, name) VALUES (m, 'Buffet') RETURNING id INTO c;
  INSERT INTO menu_items (category_id, name, name_en, price) VALUES (c, 'Lasagne', 'Lasagna', 30) RETURNING id INTO i;
  INSERT INTO packages (name, price, price_per_person) VALUES ('Pro Person', 50, true) RETURNING id INTO pkg;

  -- Echte Server-Werte: 12 Lasagne = 360, 12,34 km einfach, 2 Fahrten => Liefergebühr 154,25 (15425 Cent), Summe 514,25
  cat_payload := format($j$SELECT public.checkout_create_catering_order(%L::jsonb)$j$, jsonb_build_object(
    'id', gen_random_uuid(), 'order_number', 'CAT-BESTELLUNG-22-11-2026-%s', 'customer_name', 'Seal Test', 'customer_email', 'seal@example.invalid',
    'customer_phone', '0', 'delivery_street', 'Teststr. 1', 'delivery_zip', '80333', 'delivery_city', 'München', 'is_pickup', false,
    'desired_date', '2026-12-01', 'desired_time', '12:00',
    'items', jsonb_build_array(jsonb_build_object('id', i, 'name', 'Lasagne', 'name_en', 'Lasagna', 'quantity', 12, 'price', 30)),
    'total_amount', 514.25, 'delivery_cost', 154.25, 'minimum_order_surcharge', 0, 'calculated_distance_km', 12.34,
    'payment_method', 'stripe', 'payment_status', 'paid')::text);   -- payment_status 'paid' aus dem Browser muss ignoriert werden
  evt_payload := format($j$SELECT public.checkout_create_event_booking(%L::jsonb)$j$, jsonb_build_object(
    'id', gen_random_uuid(), 'booking_number', 'EVT-BUCHUNG-22-11-2026-%s', 'customer_name', 'Seal Event', 'customer_email', 'seal-evt@example.invalid',
    'phone', '0', 'event_date', '2026-12-02', 'event_time', '18:00', 'guest_count', 20, 'package_id', pkg, 'total_amount', 1000,
    'status', 'ready', 'payment_status', 'paid')::text);        -- status 'ready' + 'paid' aus dem Browser: ignorieren

  -- 1) Kein Zugriff mehr für Kunden-Rollen: RPCs (anon, eingeloggter Kunde)
  PERFORM pg_temp.expect('anon rpc catering', pg_temp.try_as('anon', NULL, replace(cat_payload, '-%s', '-101')), '42501');
  PERFORM pg_temp.expect('anon rpc event', pg_temp.try_as('anon', NULL, replace(evt_payload, '-%s', '-101')), '42501');
  PERFORM pg_temp.expect('kunde rpc catering', pg_temp.try_as('authenticated', u_cust, replace(cat_payload, '-%s', '-102')), '42501');
  PERFORM pg_temp.expect('kunde rpc event', pg_temp.try_as('authenticated', u_cust, replace(evt_payload, '-%s', '-102')), '42501');

  -- 2) Views: anon ohne INSERT-Recht, eingeloggter Kunde scheitert an der Trigger-Sperre
  PERFORM pg_temp.expect('anon view catering',
    pg_temp.try_as('anon', NULL, $s$INSERT INTO catering_orders (order_number, customer_name, customer_email, total_amount, items) VALUES ('X-1', 'A', 'a@example.invalid', 1, '[]')$s$), '42501');
  PERFORM pg_temp.expect('anon view event',
    pg_temp.try_as('anon', NULL, $s$INSERT INTO event_bookings (booking_number, customer_name, customer_email, total_amount) VALUES ('X-2', 'A', 'a@example.invalid', 1)$s$), '42501');
  PERFORM pg_temp.expect('kunde view catering',
    pg_temp.try_as('authenticated', u_cust, $s$INSERT INTO catering_orders (order_number, customer_name, customer_email, total_amount, items) VALUES ('X-3', 'A', 'a@example.invalid', 1, '[]')$s$), '42501');
  PERFORM pg_temp.expect('kunde view event',
    pg_temp.try_as('authenticated', u_cust, $s$INSERT INTO event_bookings (booking_number, customer_name, customer_email, total_amount) VALUES ('X-4', 'A', 'a@example.invalid', 1)$s$), '42501');

  -- 3) Direkter INSERT in v2_events: anon und Kunde scheitern an RLS (alte Policy entfernt), auch mit Wunschpreis
  PERFORM pg_temp.expect('anon v2_events direkt',
    pg_temp.try_as('anon', NULL, $s$INSERT INTO v2_events (source, amount_total) VALUES ('catering_form', 0.01)$s$), '42501');
  -- mit Bestell-Kennung scheitert es schon am Preis-Trigger (P0001), noch vor der RLS-Prüfung
  PERFORM pg_temp.expect('anon v2_events direkt mit source_catering_id',
    pg_temp.try_as('anon', NULL, $s$INSERT INTO v2_events (source, source_catering_id, amount_total, items) VALUES ('catering_form', gen_random_uuid(), 0.01, '[]')$s$), 'P0001');
  PERFORM pg_temp.expect('kunde v2_events direkt',
    pg_temp.try_as('authenticated', u_cust, $s$INSERT INTO v2_events (source, amount_total) VALUES ('manual', 0.01)$s$), '42501');
  SELECT count(*) INTO n FROM pg_policies WHERE tablename = 'v2_events' AND cmd = 'INSERT';
  PERFORM pg_temp.expect('keine insert-policy mehr', n::text, '0');

  -- 4) Der Server (service_role) legt an; Status/Zahlstatus aus der Nutzlast werden ignoriert
  PERFORM pg_temp.expect('service_role catering', pg_temp.try_as('service_role', NULL, replace(cat_payload, '-%s', '-201')), 'ok');
  SELECT * INTO ev FROM catering_orders WHERE order_number = 'CAT-BESTELLUNG-22-11-2026-201';
  PERFORM pg_temp.expect('catering zahlstatus pending', ev.payment_status, 'pending');
  PERFORM pg_temp.expect('catering status offen', ev.status, 'pending');
  -- einfache Strecke und Gebühr unverändert gespeichert (12,34 km, nicht 24,68)
  PERFORM pg_temp.expect('distanz einfach gespeichert', (ev.calculated_distance_km = 12.34)::text, 'true');
  PERFORM pg_temp.expect('liefergebuehr gespeichert', (ev.delivery_cost = 154.25)::text, 'true');
  PERFORM pg_temp.expect('summe gespeichert', (ev.total_amount = 514.25)::text, 'true');

  PERFORM pg_temp.expect('service_role event', pg_temp.try_as('service_role', NULL, replace(evt_payload, '-%s', '-202')), 'ok');
  SELECT * INTO ev FROM event_bookings WHERE booking_number = 'EVT-BUCHUNG-22-11-2026-202';
  PERFORM pg_temp.expect('event zahlstatus pending', ev.payment_status, 'pending');
  PERFORM pg_temp.expect('event nicht bezahlt/bereit', ev.status, 'menu_pending');
  PERFORM pg_temp.expect('event v2-status offer_chosen',
    (SELECT status::text FROM v2_events WHERE booking_number = 'EVT-BUCHUNG-22-11-2026-202'), 'offer_chosen');

  -- 5) service_role darf weiterhin direkt in die Views (Edge Functions), Admin/Staff mit freien Preisen ebenso
  PERFORM pg_temp.expect('service_role view event',
    pg_temp.try_as('service_role', NULL, $s$INSERT INTO event_bookings (booking_number, customer_name, customer_email, total_amount, status) VALUES ('S-1', 'S', 's@example.invalid', 1, 'confirmed')$s$), 'ok');
  PERFORM pg_temp.expect('standardstatus confirmed ist nicht bezahlt',
    (SELECT status::text FROM v2_events WHERE booking_number = 'S-1'), 'offer_chosen');
  PERFORM pg_temp.expect('admin view catering (freier Preis)',
    pg_temp.try_as('authenticated', u_admin, $s$INSERT INTO catering_orders (order_number, customer_name, customer_email, total_amount, items) VALUES ('A-1', 'Admin', 'adm@example.invalid', 0.5, '[]')$s$), 'ok');
  PERFORM pg_temp.expect('staff view event (freier Preis)',
    pg_temp.try_as('authenticated', u_staff, $s$INSERT INTO event_bookings (booking_number, customer_name, customer_email, total_amount) VALUES ('A-2', 'Staff', 'stf@example.invalid', 0.5)$s$), 'ok');
  PERFORM pg_temp.expect('admin v2_events direkt',
    pg_temp.try_as('authenticated', u_admin, $s$INSERT INTO v2_events (source, amount_total) VALUES ('manual', 0.5)$s$), 'ok');
  PERFORM pg_temp.expect('staff v2_events direkt',
    pg_temp.try_as('authenticated', u_staff, $s$INSERT INTO v2_events (source, amount_total) VALUES ('manual', 0.5)$s$), 'ok');

  -- 6) Preis-Trigger (zweite Verteidigungslinie) ist weiterhin aktiv
  SELECT count(*) INTO n FROM pg_trigger WHERE tgname = 'tg_v2_events_order_price_guard' AND NOT tgisinternal;
  PERFORM pg_temp.expect('guard-trigger aktiv', n::text, '1');

  RAISE NOTICE 'order_checkout_seal: alle Fälle bestanden';
END $$;

ROLLBACK;
