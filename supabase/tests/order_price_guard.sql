-- SQL-Tests Preisprüfung (Migration 20261122100000_order_price_guard.sql). Lauf gegen eine Wegwerf-/Branch-DB (NIE Produktion):
--   psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/order_price_guard.sql
-- oder komplett (Stub-Schema + beide Migrationen + beide Testdateien) ohne Datenbank: node supabase/tests/run-sql-tests.mjs
-- Entfernung = EINFACHE Strecke (calculated_distance_km). Die Beträge stammen aus der Server-Rechnung (_shared/cateringPricing.ts):
-- 12,34 km einfach, 2 Fahrten: netto 129,62 / brutto 154,25; Pizza-only (1 Fahrt): netto 64,81 / brutto 77,12.
-- Alles in einer Transaktion mit ROLLBACK am Ende. Die Rolle wird per JWT-Einstellung simuliert (auth.role() liest sie),
-- die Zeilen werden direkt in v2_events geschrieben (der Trigger sitzt dort, jeder Weg läuft hier durch).
BEGIN;

CREATE FUNCTION pg_temp.try_catering(p_items jsonb, p_pickup boolean, p_km numeric, p_delivery int, p_surcharge int, p_total numeric)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_cust uuid; v_id uuid := gen_random_uuid(); v_detail text;
BEGIN
  SELECT id INTO v_cust FROM v2_customers WHERE email = 'guard-test@example.invalid';
  BEGIN
    INSERT INTO v2_events (id, customer_id, source, source_catering_id, items, is_pickup, calculated_distance_km,
                           delivery_cost_cents, minimum_order_surcharge_cents, amount_total)
    VALUES (v_id, v_cust, 'catering_form', v_id, p_items, p_pickup, p_km, p_delivery, p_surcharge, p_total);
    RAISE EXCEPTION 'GUARD_OK';   -- Unterblock zurückrollen, Zeile bleibt nicht stehen
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'GUARD_OK' THEN RETURN 'ok'; END IF;
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RETURN COALESCE(replace(v_detail, 'order_price_guard:', ''), SQLERRM);
  END;
END $$;

CREATE FUNCTION pg_temp.try_event(p_pkg uuid, p_guests int, p_total numeric)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_cust uuid; v_id uuid := gen_random_uuid(); v_detail text;
BEGIN
  SELECT id INTO v_cust FROM v2_customers WHERE email = 'guard-test@example.invalid';
  BEGIN
    INSERT INTO v2_events (id, customer_id, source, source_booking_id, package_id, guest_count, amount_total)
    VALUES (v_id, v_cust, 'manual', v_id, p_pkg, p_guests, p_total);
    RAISE EXCEPTION 'GUARD_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'GUARD_OK' THEN RETURN 'ok'; END IF;
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RETURN COALESCE(replace(v_detail, 'order_price_guard:', ''), SQLERRM);
  END;
END $$;

CREATE FUNCTION pg_temp.try_both(p_pkg uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_cust uuid; v_id uuid := gen_random_uuid(); v_detail text;
BEGIN
  SELECT id INTO v_cust FROM v2_customers WHERE email = 'guard-test@example.invalid';
  BEGIN
    INSERT INTO v2_events (id, customer_id, source, source_booking_id, source_catering_id, package_id, guest_count, amount_total)
    VALUES (v_id, v_cust, 'manual', v_id, gen_random_uuid(), p_pkg, 10, 500);
    RAISE EXCEPTION 'GUARD_OK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'GUARD_OK' THEN RETURN 'ok'; END IF;
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RETURN COALESCE(replace(v_detail, 'order_price_guard:', ''), SQLERRM);
  END;
END $$;

CREATE FUNCTION pg_temp.expect(p_label text, p_got text, p_want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN RAISE EXCEPTION 'FEHLER [%]: erwartet %, erhalten %', p_label, p_want, p_got; END IF;
END $$;

DO $$
DECLARE
  m_buf uuid; m_piz uuid; m_unp uuid; c_buf uuid; c_piz uuid; c_unp uuid;
  i_lasagne uuid; i_pizza uuid; i_unp uuid;
  p_pp uuid; p_flat uuid; p_loc uuid; p_off uuid; p_rng uuid;
  m_oth uuid; c_oth uuid; i_oth uuid;
  L jsonb; ch jsonb := '{"id":"chafing-dish","name":"Chafing Dish (Leihgerät)","name_en":"Chafing Dish (rental)","quantity":2,"price":25}';
BEGIN
  INSERT INTO v2_customers (name, email) VALUES ('Guard Test', 'guard-test@example.invalid');
  INSERT INTO menus (menu_type, slug, is_published) VALUES ('catering', 'buffet-test', true) RETURNING id INTO m_buf;
  INSERT INTO menus (menu_type, slug, is_published) VALUES ('catering', 'pizze-napoletane', true) RETURNING id INTO m_piz;
  INSERT INTO menus (menu_type, slug, is_published) VALUES ('catering', 'unveroeffentlicht-test', false) RETURNING id INTO m_unp;
  INSERT INTO menu_categories (menu_id, name) VALUES (m_buf, 'Buffet') RETURNING id INTO c_buf;
  INSERT INTO menu_categories (menu_id, name) VALUES (m_piz, 'Pizza') RETURNING id INTO c_piz;
  INSERT INTO menu_categories (menu_id, name) VALUES (m_unp, 'Entwurf') RETURNING id INTO c_unp;
  INSERT INTO menu_items (category_id, name, name_en, price) VALUES (c_buf, 'Lasagne', 'Lasagna', 30) RETURNING id INTO i_lasagne;
  INSERT INTO menu_items (category_id, name, name_en, price) VALUES (c_piz, 'Margherita', 'Margherita', 10) RETURNING id INTO i_pizza;
  INSERT INTO menu_items (category_id, name, name_en, price) VALUES (c_unp, 'Entwurf', 'Draft', 20) RETURNING id INTO i_unp;
  INSERT INTO packages (name, price, price_per_person) VALUES ('Pro Person', 50, true) RETURNING id INTO p_pp;
  INSERT INTO packages (name, price, price_per_person) VALUES ('Pauschal', 500, false) RETURNING id INTO p_flat;
  INSERT INTO packages (name, price, price_per_person) VALUES ('Location Test', 8500, false) RETURNING id INTO p_loc;
  INSERT INTO packages (name, price, price_per_person, is_active) VALUES ('Inaktiv', 100, true, false) RETURNING id INTO p_off;
  INSERT INTO packages (name, price, price_per_person, min_guests, max_guests) VALUES ('Mit Grenzen', 50, true, 10, 50) RETURNING id INTO p_rng;
  -- fremder Mandant: Katalog darf nicht verkauft werden
  INSERT INTO menus (menu_type, slug, is_published, tenant_id) VALUES ('catering', 'fremd', true, gen_random_uuid()) RETURNING id INTO m_oth;
  INSERT INTO menu_categories (menu_id, name) VALUES (m_oth, 'Fremd') RETURNING id INTO c_oth;
  INSERT INTO menu_items (category_id, name, name_en, price) VALUES (c_oth, 'Fremdgericht', 'Foreign dish', 10) RETURNING id INTO i_oth;

  -- Aufrufer = anonymer Kunde
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);

  -- Positions-Helfer
  -- 10 x Lasagne (30,00) = 300,00; Namen wie im Katalog
  L := jsonb_build_array(jsonb_build_object('id', i_lasagne, 'name', 'Lasagne', 'name_en', 'Lasagna', 'quantity', 10, 'price', 30));

  -- 1) Abholung, korrekt
  PERFORM pg_temp.expect('abholung ok', pg_temp.try_catering(L, true, NULL, 0, 0, 300), 'ok');
  -- 2) manipulierter Einzelpreis (Summe passend zum falschen Preis)
  PERFORM pg_temp.expect('preis manipuliert', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_lasagne, 'name', 'Lasagne', 'name_en', 'Lasagna', 'quantity', 10, 'price', 1)), true, NULL, 0, 0, 10), 'price_mismatch');
  -- 3) manipulierte Summe
  PERFORM pg_temp.expect('summe manipuliert', pg_temp.try_catering(L, true, NULL, 0, 0, 100), 'total_mismatch');
  -- 4) 1 Cent Abweichung ist erlaubt, 2 Cent nicht
  PERFORM pg_temp.expect('1 cent toleranz', pg_temp.try_catering(L, true, NULL, 0, 0, 300.01), 'ok');
  PERFORM pg_temp.expect('2 cent abweichung', pg_temp.try_catering(L, true, NULL, 0, 0, 300.02), 'total_mismatch');
  -- 5) Name falsch
  PERFORM pg_temp.expect('name falsch', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_lasagne, 'name', 'Anderes', 'name_en', 'Lasagna', 'quantity', 10, 'price', 30)), true, NULL, 0, 0, 300), 'name_mismatch');
  -- 6) unbekannte ID / Nicht-UUID / unveröffentlichtes Menü
  PERFORM pg_temp.expect('unbekannte id', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'name', 'x', 'quantity', 1, 'price', 1)), true, NULL, 0, 0, 1), 'unknown_item');
  PERFORM pg_temp.expect('keine uuid', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', 'abc', 'name', 'x', 'quantity', 1, 'price', 1)), true, NULL, 0, 0, 1), 'unknown_item');
  PERFORM pg_temp.expect('unveroeffentlicht', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_unp, 'name', 'Entwurf', 'name_en', 'Draft', 'quantity', 1, 'price', 20)), true, NULL, 0, 0, 20), 'item_unavailable');
  -- 7) ungültige Positionen
  PERFORM pg_temp.expect('menge 0', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_lasagne, 'name', 'Lasagne', 'name_en', 'Lasagna', 'quantity', 0, 'price', 30)), true, NULL, 0, 0, 0), 'invalid_items');
  PERFORM pg_temp.expect('menge 1.5', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_lasagne, 'name', 'Lasagne', 'name_en', 'Lasagna', 'quantity', 1.5, 'price', 30)), true, NULL, 0, 0, 45), 'invalid_items');
  PERFORM pg_temp.expect('preis fehlt', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_lasagne, 'name', 'Lasagne', 'name_en', 'Lasagna', 'quantity', 1)), true, NULL, 0, 0, 30), 'invalid_items');
  PERFORM pg_temp.expect('leere items', pg_temp.try_catering('[]'::jsonb, true, NULL, 0, 0, 0), 'invalid_items');
  PERFORM pg_temp.expect('items null', pg_temp.try_catering(NULL, true, NULL, 0, 0, 100), 'invalid_items');
  -- 8) Abholung darf keine Lieferkosten tragen
  PERFORM pg_temp.expect('abholung mit lieferung', pg_temp.try_catering(L, true, NULL, 1000, 0, 310), 'delivery_mismatch');
  -- 9) Chafing: Festpreis 25,00
  PERFORM pg_temp.expect('chafing ok', pg_temp.try_catering(L || ch, true, NULL, 0, 0, 350), 'ok');
  PERFORM pg_temp.expect('chafing preis', pg_temp.try_catering(L || jsonb_set(ch, '{price}', '1'), true, NULL, 0, 0, 302), 'price_mismatch');
  -- 10) Lieferung 5 km, kein Pizza-only: 2 Fahrten = 100 netto = 119,00 brutto; 300 EUR >= 150 Mindestwert
  PERFORM pg_temp.expect('lieferung ok', pg_temp.try_catering(L, false, 5.0, 11900, 0, 419), 'ok');
  PERFORM pg_temp.expect('lieferung gratis', pg_temp.try_catering(L, false, 5.0, 0, 0, 300), 'delivery_mismatch');
  -- 11) km-Toleranz +-0,05
  PERFORM pg_temp.expect('km toleranz', pg_temp.try_catering(L, false, 5.04, 11900, 0, 419), 'ok');
  -- 12) Mindestbestellwert-Aufschlag: 1 x Lasagne (30) bei 0,9 km => Aufschlag 20, Summe 50
  PERFORM pg_temp.expect('aufschlag ok', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_lasagne, 'name', 'Lasagne', 'name_en', 'Lasagna', 'quantity', 1, 'price', 30)), false, 0.9, 0, 2000, 50), 'ok');
  PERFORM pg_temp.expect('aufschlag fehlt', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_lasagne, 'name', 'Lasagne', 'name_en', 'Lasagna', 'quantity', 1, 'price', 30)), false, 0.9, 0, 0, 30), 'surcharge_mismatch');
  -- 13) > 8 km: gespeichert wird die EINFACHE Strecke. 12,34 km, 2 Fahrten: netto 129,62, brutto 154,25; 300 EUR >= 200 Mindestwert
  PERFORM pg_temp.expect('12 km einfach ok', pg_temp.try_catering(L, false, 12.0, 15327, 0, 453.27), 'ok');
  PERFORM pg_temp.expect('12,34 km einfach ok', pg_temp.try_catering(L, false, 12.34, 15425, 0, 454.25), 'ok');
  -- Regression des Altfehlers: der Checkout speicherte Strecke x Fahrten (12,34 x 2 = 24,68) zur Gebühr für 12,34 km -> abgelehnt
  PERFORM pg_temp.expect('alter fehler strecke x fahrten', pg_temp.try_catering(L, false, 24.68, 15425, 0, 454.25), 'delivery_mismatch');
  PERFORM pg_temp.expect('km 8,00 ist noch Pauschale', pg_temp.try_catering(L, false, 8.0, 11900, 0, 419), 'ok');
  PERFORM pg_temp.expect('km 8,01 ist Kilometertarif', pg_temp.try_catering(L, false, 8.01, 14187, 0, 441.87), 'ok');
  -- 14) Pizza-only: eine Fahrt => 50 netto = 59,50; 10 x 10 = 100 < 150 => Aufschlag 50; Summe 209,50
  PERFORM pg_temp.expect('pizza only ok', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_pizza, 'name', 'Margherita', 'name_en', 'Margherita', 'quantity', 10, 'price', 10)), false, 5.0, 5950, 5000, 209.5), 'ok');
  -- Pizza-only 12,34 km einfach: 1 Fahrt, netto 64,81, brutto 77,12; 10 x 10 = 100 < 200 => Aufschlag 100; Summe 277,12
  PERFORM pg_temp.expect('pizza 12,34 km ok', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_pizza, 'name', 'Margherita', 'name_en', 'Margherita', 'quantity', 10, 'price', 10)), false, 12.34, 7712, 10000, 277.12), 'ok');
  PERFORM pg_temp.expect('pizza mit 2 fahrten', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_pizza, 'name', 'Margherita', 'name_en', 'Margherita', 'quantity', 10, 'price', 10)), false, 5.0, 11900, 5000, 269), 'delivery_mismatch');
  -- 15) Lieferung ohne Entfernung ist nicht prüfbar
  PERFORM pg_temp.expect('km fehlt', pg_temp.try_catering(L, false, NULL, 11900, 0, 419), 'delivery_unverifiable');

  -- 16) EVT-Buchung
  PERFORM pg_temp.expect('event pro person ok', pg_temp.try_event(p_pp, 20, 1000), 'ok');
  PERFORM pg_temp.expect('event pro person manipuliert', pg_temp.try_event(p_pp, 20, 100), 'price_mismatch');
  PERFORM pg_temp.expect('event pauschal ok', pg_temp.try_event(p_flat, 30, 500), 'ok');
  PERFORM pg_temp.expect('event pauschal manipuliert', pg_temp.try_event(p_flat, 30, 1), 'price_mismatch');
  PERFORM pg_temp.expect('event location 80 gaeste ok', pg_temp.try_event(p_loc, 80, 9714.29), 'ok');
  PERFORM pg_temp.expect('event location 60 gaeste ok', pg_temp.try_event(p_loc, 60, 8500), 'ok');
  PERFORM pg_temp.expect('event location manipuliert', pg_temp.try_event(p_loc, 80, 8500), 'price_mismatch');
  PERFORM pg_temp.expect('event paket inaktiv', pg_temp.try_event(p_off, 10, 1000), 'unknown_package');
  PERFORM pg_temp.expect('event ohne paket', pg_temp.try_event(NULL, 10, 1000), 'invalid_booking');

  -- 16b) Mandant, Gästegrenzen, beide Quell-IDs
  PERFORM pg_temp.expect('fremder mandant', pg_temp.try_catering(jsonb_build_array(jsonb_build_object('id', i_oth, 'name', 'Fremdgericht', 'name_en', 'Foreign dish', 'quantity', 1, 'price', 10)), true, NULL, 0, 0, 10), 'item_unavailable');
  PERFORM pg_temp.expect('gaeste im rahmen', pg_temp.try_event(p_rng, 20, 1000), 'ok');
  PERFORM pg_temp.expect('gaeste unter minimum', pg_temp.try_event(p_rng, 5, 250), 'guests_out_of_range');
  PERFORM pg_temp.expect('gaeste ueber maximum', pg_temp.try_event(p_rng, 51, 2550), 'guests_out_of_range');
  PERFORM pg_temp.expect('quell-ids beide', pg_temp.try_both(p_flat), 'invalid_booking');

  -- 17) Ausnahmen: service_role und Verbindung ohne JWT werden NICHT geprüft (manuelle Preise, Edge Functions, Migrationen)
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM pg_temp.expect('service_role frei', pg_temp.try_catering(L, true, NULL, 0, 0, 1), 'ok');
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM pg_temp.expect('ohne jwt frei', pg_temp.try_event(p_pp, 20, 1), 'ok');

  -- 18) Zeilen ohne source_catering_id/source_booking_id (z. B. Anfragen) sind nicht betroffen
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  INSERT INTO v2_events (customer_id, source, amount_total) VALUES ((SELECT id FROM v2_customers WHERE email = 'guard-test@example.invalid'), 'manual', 1);

  RAISE NOTICE 'order_price_guard: alle Fälle bestanden';
END $$;

ROLLBACK;
-- Zusätzlich manuell (Admin-Ausnahme): als eingeloggter admin/staff (JWT mit sub = Nutzer mit user_roles-Eintrag) denselben
-- manipulierten Datensatz einfügen => muss durchgehen. Dieser Fall braucht ein echtes Auth-Konto und steht deshalb nicht im Skript.
