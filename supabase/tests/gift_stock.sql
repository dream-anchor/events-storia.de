-- SQL-Tests Geschenkkorb-Bestand. Lauf gegen eine Wegwerf-/Branch-DB (NIE Produktion):
--   psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/gift_stock.sql
-- Alles in einer Transaktion mit ROLLBACK am Ende. Voraussetzung: Migrationen 20261120100000-200, 20261121120000 und 20261123100000 angewendet.
-- Echter Parallel-Test (zwei Sessions) siehe Kommentar ganz unten.
BEGIN;

-- Hilfsfunktion Abschnitt 14: Bestellung als unbestätigte Vor-Ort-Reservierung für heute (Berlin) + p_days vorbereiten
CREATE FUNCTION pg_temp.prep(p_order uuid, p_tok text, p_days int) RETURNS void LANGUAGE sql AS $f$
  UPDATE gift_orders SET status = 'awaiting_confirmation', payment_method = 'on_site', confirm_token_hash = repeat(p_tok, 64), confirmed_at = NULL,
         handover_date = (now() AT TIME ZONE 'Europe/Berlin')::date + p_days, reservation_until = now() + make_interval(days => p_days, hours => 5),
         is_test = false, stock_conflict_at = NULL, stock_conflict_notified_at = NULL WHERE id = p_order $f$;
CREATE FUNCTION pg_temp.avail(p_key text) RETURNS int LANGUAGE sql AS $f$
  SELECT (v->>'available')::int FROM jsonb_array_elements(gift_public_catalog()) b, jsonb_array_elements(b->'variants') v WHERE v->>'key' = p_key $f$;

DO $$
DECLARE
  v_basket uuid; v_var uuid; v_unl uuid; o1 uuid; o2 uuid; o3 uuid; res jsonb; n int; caught boolean;
BEGIN
  INSERT INTO gift_baskets (slug, size_key, name_de, name_en, price_cents, active) VALUES ('t-korb','klein','T','T',9900,true) RETURNING id INTO v_basket;
  INSERT INTO gift_basket_variants (basket_id, key, label_de, label_en, stock_qty, stock_unlimited) VALUES (v_basket,'w1','W1','W1',1,false) RETURNING id INTO v_var;   -- feste Menge
  INSERT INTO gift_orders (customer_name,customer_email,handover,handover_date,items_total_cents,total_cents) VALUES ('a','a@x.de','pickup',current_date,9900,9900) RETURNING id INTO o1;
  INSERT INTO gift_orders (customer_name,customer_email,handover,handover_date,items_total_cents,total_cents) VALUES ('b','b@x.de','pickup',current_date,9900,9900) RETURNING id INTO o2;
  INSERT INTO gift_orders (customer_name,customer_email,handover,handover_date,items_total_cents,total_cents) VALUES ('c','c@x.de','pickup',current_date,9900,9900) RETURNING id INTO o3;

  -- 1) letzter Korb: erste Reservierung klappt, zweite scheitert mit sold_out
  PERFORM gift_reserve_stock(o1, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '35 minutes');
  caught := false;
  BEGIN
    PERFORM gift_reserve_stock(o2, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '35 minutes');
  EXCEPTION WHEN OTHERS THEN caught := (SQLERRM = 'sold_out');
  END;
  ASSERT caught, 'zweite Reservierung muss sold_out liefern';

  -- 2) Katalog zeigt verfügbar = 0
  ASSERT (SELECT (v->>'available')::int FROM jsonb_array_elements(gift_public_catalog()) b, jsonb_array_elements(b->'variants') v WHERE b->>'slug'='t-korb') = 0, 'available muss 0 sein';

  -- 3) Freigabe -> wieder 1 verfügbar, zweiter Kunde kann reservieren
  ASSERT gift_release_stock(o1) = 1;
  PERFORM gift_reserve_stock(o2, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '35 minutes');

  -- 4) Zahlung: dekrementiert genau einmal (idempotent)
  res := gift_consume_stock(o2);
  ASSERT (res->>'consumed')::boolean AND NOT (res->>'oversold')::boolean, 'consume ok';
  ASSERT (SELECT stock_qty FROM gift_basket_variants WHERE id=v_var) = 0, 'Bestand 0 nach Zahlung';
  res := gift_consume_stock(o2);
  ASSERT NOT (res->>'consumed')::boolean, 'zweiter consume ist No-Op';
  ASSERT (SELECT stock_qty FROM gift_basket_variants WHERE id=v_var) = 0;

  -- 5) späte Zahlung nach Ablauf bei leerem Bestand -> oversold
  UPDATE gift_basket_variants SET stock_qty = 1 WHERE id = v_var;
  PERFORM gift_reserve_stock(o1, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '35 minutes');
  UPDATE gift_stock_holds SET expires_at = now() - interval '1 minute' WHERE order_id = o1;   -- Hold läuft ab
  SELECT count(*) INTO n FROM gift_sweep_expired_holds();
  ASSERT n >= 1, 'Sweep verfällt Bestellung';
  PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '35 minutes');
  res := gift_consume_stock(o1);   -- o1 zahlt spät, o3 hält den letzten Korb
  ASSERT (res->>'oversold')::boolean, 'späte Zahlung ohne Bestand = oversold';

  -- 6) Menge > Bestand -> sold_out
  UPDATE gift_basket_variants SET stock_qty = 2 WHERE id = v_var;
  caught := false;
  BEGIN
    PERFORM gift_reserve_stock(o2, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',5)), now() + interval '35 minutes');
  EXCEPTION WHEN OTHERS THEN caught := (SQLERRM = 'sold_out');
  END;
  ASSERT caught, 'Menge über Bestand = sold_out';

  -- 7) Überverkauf: bucht nur den FREIEN Anteil (nie fremde aktive Holds), zweiter consume ist No-Op
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  UPDATE gift_basket_variants SET stock_qty = 3 WHERE id = v_var;
  PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '35 minutes');   -- fremder aktiver Hold: 1
  INSERT INTO gift_stock_holds (order_id, variant_id, qty, expires_at, status) VALUES (o1, v_var, 3, now() - interval '1 minute', 'held');   -- später Zahler will 3
  res := gift_consume_stock(o1);
  ASSERT (res->>'oversold')::boolean, 'Überverkauf wird gemeldet';
  ASSERT (SELECT stock_qty FROM gift_basket_variants WHERE id=v_var) = 1, 'nur freier Anteil (3 - 1 fremder Hold = 2) abgebucht, Rest 1';
  res := gift_consume_stock(o1);
  ASSERT NOT (res->>'consumed')::boolean, 'zweiter consume nach Überverkauf ist No-Op';
  ASSERT (SELECT stock_qty FROM gift_basket_variants WHERE id=v_var) = 1, 'Bestand nach zweitem consume unverändert';
  ASSERT (SELECT -sum(delta) FROM gift_stock_log WHERE order_id = o1 AND reason = 'consume') = 2, 'Protokoll: 2 abgebucht';

  -- 8) Double-Opt-in: awaiting_confirmation -> confirmed (Hold bis reservation_until), zweiter Klick idempotent
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  UPDATE gift_basket_variants SET stock_qty = 3 WHERE id = v_var;
  UPDATE gift_orders SET status = 'awaiting_confirmation', payment_method = 'on_site', confirm_token_hash = repeat('a', 64),
         reservation_until = now() + interval '5 hours', is_test = false WHERE id = o2;
  PERFORM gift_reserve_stock(o2, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes');
  ASSERT (gift_open_counts('on_site', 'b@x.de', NULL)->>'by_email')::int = 1, 'offene unbestätigte Reservierung zählt';
  ASSERT gift_confirm_reservation(repeat('a', 64))->>'status' = 'confirmed', 'Bestätigung klappt';
  ASSERT (SELECT status FROM gift_orders WHERE id = o2) = 'reserved', 'Status reserved';
  ASSERT (SELECT expires_at FROM gift_stock_holds WHERE order_id = o2) > now() + interval '4 hours', 'Hold bis Ladenschluss verlängert';
  ASSERT gift_confirm_reservation(repeat('a', 64))->>'status' = 'already_confirmed', 'zweiter Klick idempotent';
  ASSERT gift_confirm_reservation(repeat('c', 64))->>'status' = 'invalid', 'unbekannter Token';

  -- 9) Unbestätigt + abgelaufen: zählt nicht mehr, Bestätigung scheitert mit expired, Sweep verfällt die Bestellung
  UPDATE gift_orders SET status = 'awaiting_confirmation', payment_method = 'on_site', confirm_token_hash = repeat('b', 64),
         reservation_until = now() + interval '5 hours', is_test = false WHERE id = o3;
  PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes');
  ASSERT (gift_open_counts('on_site', 'c@x.de', NULL)->>'by_email')::int = 1;
  UPDATE gift_stock_holds SET expires_at = now() - interval '1 minute' WHERE order_id = o3;
  ASSERT (gift_open_counts('on_site', 'c@x.de', NULL)->>'by_email')::int = 0, 'abgelaufene Reservierung zählt nicht (auch ohne Sweep)';
  SELECT count(*) INTO n FROM gift_sweep_expired_holds();
  ASSERT n >= 1 AND (SELECT status FROM gift_orders WHERE id = o3) = 'expired', 'Sweep verfällt unbestätigte Reservierung';
  ASSERT gift_confirm_reservation(repeat('b', 64))->>'status' = 'expired', 'Bestätigung nach Ablauf = expired';

  -- 10) Standard UNBEGRENZT: neue Variante ohne Angabe, beliebig reservier-/zahlbar, kein Abzug, kein oversold, Katalog available = null
  INSERT INTO gift_basket_variants (basket_id, key, label_de, label_en) VALUES (v_basket,'w2','W2','W2') RETURNING id INTO v_unl;
  ASSERT (SELECT stock_unlimited FROM gift_basket_variants WHERE id = v_unl), 'Default = unbegrenzt';
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  PERFORM gift_reserve_stock(o1, jsonb_build_array(jsonb_build_object('variant_id',v_unl,'qty',10)), now() + interval '35 minutes');
  PERFORM gift_reserve_stock(o2, jsonb_build_array(jsonb_build_object('variant_id',v_unl,'qty',10)), now() + interval '35 minutes');
  ASSERT (SELECT (v->>'unlimited')::boolean AND (v->'available') = 'null'::jsonb FROM jsonb_array_elements(gift_public_catalog()) b, jsonb_array_elements(b->'variants') v WHERE v->>'key' = 'w2'), 'Katalog: unlimited, available null';
  res := gift_consume_stock(o1);
  ASSERT (res->>'consumed')::boolean AND NOT (res->>'oversold')::boolean, 'unbegrenzt: kein oversold';
  ASSERT (SELECT stock_qty FROM gift_basket_variants WHERE id = v_unl) = 0 AND NOT EXISTS (SELECT 1 FROM gift_stock_log WHERE variant_id = v_unl), 'unbegrenzt: kein Abzug, kein Protokoll';
  ASSERT NOT (gift_consume_stock(o1)->>'consumed')::boolean, 'unbegrenzt: zweiter consume No-Op';

  -- 11) Betreiber stellt auf ausverkauft und wieder frei
  PERFORM gift_set_stock_mode(v_unl, 'sold_out');
  caught := false;
  BEGIN
    PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_unl,'qty',1)), now() + interval '35 minutes');
  EXCEPTION WHEN OTHERS THEN caught := (SQLERRM = 'sold_out');
  END;
  ASSERT caught, 'ausverkauft: Reservierung scheitert mit sold_out';
  ASSERT (SELECT (v->>'available')::int FROM jsonb_array_elements(gift_public_catalog()) b, jsonb_array_elements(b->'variants') v WHERE v->>'key' = 'w2') = 0, 'Katalog: ausverkauft = 0';
  PERFORM gift_set_stock_mode(v_unl, 'unlimited');
  PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_unl,'qty',1)), now() + interval '35 minutes');
  PERFORM gift_set_stock_mode(v_unl, 'fixed', 4);
  ASSERT (SELECT stock_qty FROM gift_basket_variants WHERE id = v_unl) = 4 AND NOT (SELECT stock_unlimited FROM gift_basket_variants WHERE id = v_unl), 'feste Menge 4';

  -- 12) IP-Hash wird gelöscht, sobald die Bestellung abgeschlossen ist (Datenschutz)
  UPDATE gift_orders SET client_ip_hash = 'abc', status = 'reserved' WHERE id = o3;
  ASSERT (SELECT client_ip_hash FROM gift_orders WHERE id = o3) = 'abc', 'offene Bestellung behält den Hash';
  UPDATE gift_orders SET status = 'cancelled' WHERE id = o3;
  ASSERT (SELECT client_ip_hash FROM gift_orders WHERE id = o3) IS NULL, 'abgeschlossen: Hash gelöscht';

  -- 13) Übergabe 'with_catering' (Mischbestellung): nur mit Catering-Bestellnummer, ungültige Werte bleiben verboten
  INSERT INTO gift_orders (customer_name,customer_email,handover,handover_date,items_total_cents,total_cents,catering_order_number)
    VALUES ('m','m@x.de','with_catering',current_date,9900,9900,'CAT-TEST-1');
  caught := false;
  BEGIN
    INSERT INTO gift_orders (customer_name,customer_email,handover,handover_date,items_total_cents,total_cents) VALUES ('m','m@x.de','with_catering',current_date,9900,9900);
  EXCEPTION WHEN check_violation THEN caught := true;
  END;
  ASSERT caught, 'with_catering ohne catering_order_number wird abgelehnt';
  caught := false;
  BEGIN
    INSERT INTO gift_orders (customer_name,customer_email,handover,handover_date,items_total_cents,total_cents) VALUES ('m','m@x.de','bogus',current_date,9900,9900);
  EXCEPTION WHEN check_violation THEN caught := true;
  END;
  ASSERT caught, 'unbekannter handover-Wert wird abgelehnt';

  -- ── 14) Z10: Vor-Ort-Reservierung belegt Bestand erst ab 2 Tagen vor Abholung (Fenster D-2, Berliner Datum) ──
  -- 14a) Unbestätigter Opt-in für fernen Termin belegt KEINEN Bestand und verfällt nach 30 Min
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  UPDATE gift_basket_variants SET stock_qty = 1, stock_unlimited = false WHERE id = v_var;
  PERFORM pg_temp.prep(o1, '1', 30);
  PERFORM gift_reserve_stock(o1, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes', false);
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o1) = 'deferred', 'ferner Opt-in-Hold ist deferred';
  ASSERT pg_temp.avail('w1') = 1, 'Katalog direkt nach dem Anlegen unverändert';
  ASSERT (gift_open_counts('on_site', 'a@x.de', NULL)->>'by_email')::int = 1, 'unbestätigter ferner Opt-in zählt für die Missbrauchsgrenze';
  UPDATE gift_stock_holds SET expires_at = now() - interval '1 minute' WHERE order_id = o1;
  SELECT count(*) INTO n FROM gift_sweep_expired_holds();
  ASSERT (SELECT status FROM gift_orders WHERE id = o1) = 'expired' AND (SELECT status FROM gift_stock_holds WHERE order_id = o1) = 'released', 'unbestätigter ferner Opt-in verfällt';

  -- 14b) Bestätigung bei fernem Termin: bleibt deferred bis reservation_until, Katalog unverändert, andere Kunden können den Korb reservieren
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  PERFORM pg_temp.prep(o1, '1', 30);
  PERFORM gift_reserve_stock(o1, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes', false);
  ASSERT gift_confirm_reservation(repeat('1', 64))->>'status' = 'confirmed';
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o1) = 'deferred' AND (SELECT expires_at FROM gift_stock_holds WHERE order_id = o1) > now() + interval '29 days', 'deferred bis reservation_until';
  ASSERT pg_temp.avail('w1') = 1, 'bestätigte ferne Reservierung zieht nichts ab';
  PERFORM pg_temp.prep(o2, '2', 1);
  PERFORM gift_reserve_stock(o2, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes');   -- anderer Kunde bekommt den letzten Korb
  ASSERT (gift_open_counts('on_site', 'a@x.de', NULL)->>'by_email')::int = 1, 'zurückgestellte Reservierung zählt für die Missbrauchsgrenze';
  SELECT count(*) INTO n FROM gift_sweep_expired_holds();
  ASSERT (SELECT status FROM gift_orders WHERE id = o1) = 'reserved', 'Sweep lässt zurückgestellte Reservierung bestehen';
  ASSERT NOT EXISTS (SELECT 1 FROM gift_activate_deferred_holds()), 'außerhalb des Fensters: keine Aktivierung';

  -- 14c) Eintritt ins Fenster: o2 hält den letzten Korb -> Überbuchung markiert, Hold trotzdem gesetzt; Nachpacken räumt den Hinweis auf
  UPDATE gift_orders SET handover_date = (now() AT TIME ZONE 'Europe/Berlin')::date + 2 WHERE id = o1;
  SELECT count(*) INTO n FROM gift_activate_deferred_holds() WHERE conflict;
  ASSERT n = 1, 'Konflikt wird gemeldet';
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o1) = 'held', 'Hold nach Aktivierung belegt';
  ASSERT (SELECT stock_conflict_at FROM gift_orders WHERE id = o1) IS NOT NULL, 'Konflikt markiert';
  ASSERT NOT EXISTS (SELECT 1 FROM gift_activate_deferred_holds() WHERE conflict), 'Aktivierung ist idempotent';
  ASSERT (SELECT stock_conflict_at FROM gift_orders WHERE id = o1) IS NOT NULL, 'Konflikt bleibt, solange der Bestand fehlt';
  UPDATE gift_orders SET stock_conflict_notified_at = now() WHERE id = o1;
  UPDATE gift_basket_variants SET stock_qty = 2 WHERE id = v_var;   -- Nachpacken im Admin
  PERFORM gift_activate_deferred_holds();
  ASSERT (SELECT stock_conflict_at IS NULL AND stock_conflict_notified_at IS NULL FROM gift_orders WHERE id = o1), 'Hinweis verschwindet samt Alarm-Marker, sobald der Bestand reicht';

  -- 14d) Bestätigung über Mitternacht (Termin war beim Anlegen Tag+3, beim Klick Tag+2): gleiche Konfliktprüfung
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  UPDATE gift_basket_variants SET stock_qty = 1 WHERE id = v_var;
  PERFORM pg_temp.prep(o3, '3', 1);
  PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes');
  PERFORM gift_confirm_reservation(repeat('3', 64));   -- o3 hält den letzten Korb (im Fenster, geprüft)
  PERFORM pg_temp.prep(o1, '4', 3);
  PERFORM gift_reserve_stock(o1, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes', false);
  UPDATE gift_orders SET handover_date = (now() AT TIME ZONE 'Europe/Berlin')::date + 2 WHERE id = o1;   -- Mitternacht vergeht
  ASSERT gift_confirm_reservation(repeat('4', 64))->>'status' = 'confirmed';
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o1) = 'held', 'Hold nach Bestätigung im Fenster belegt';
  ASSERT (SELECT stock_conflict_at FROM gift_orders WHERE id = o1) IS NOT NULL, 'Bestätigung über Mitternacht markiert die Überbuchung';

  -- 14e) "Bereit" belegt den Bestand sofort, auch vor D-2; reicht er nicht: Konflikt
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  UPDATE gift_orders SET stock_conflict_at = NULL WHERE id IN (o1, o2, o3);
  PERFORM pg_temp.prep(o3, '5', 1);
  PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes');
  PERFORM gift_confirm_reservation(repeat('5', 64));
  PERFORM pg_temp.prep(o2, '6', 40);
  PERFORM gift_reserve_stock(o2, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes', false);
  PERFORM gift_confirm_reservation(repeat('6', 64));
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o2) = 'deferred';
  res := gift_admin_set_status(o2, 'ready');
  ASSERT (res->>'conflict')::boolean, 'Bereit ohne Bestand: Konflikt';
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o2) = 'held' AND (SELECT stock_conflict_at FROM gift_orders WHERE id = o2) IS NOT NULL, 'Bereit belegt sofort und markiert';
  -- mit ausreichendem Bestand: kein Konflikt
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o3);
  PERFORM pg_temp.prep(o1, '7', 50);
  PERFORM gift_reserve_stock(o1, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes', false);
  PERFORM gift_confirm_reservation(repeat('7', 64));
  UPDATE gift_basket_variants SET stock_qty = 5 WHERE id = v_var;
  res := gift_admin_set_status(o1, 'ready');
  ASSERT NOT (res->>'conflict')::boolean AND (SELECT stock_conflict_at FROM gift_orders WHERE id = o1) IS NULL, 'Bereit mit Bestand: kein Konflikt';
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o1) = 'held';

  -- 14f) Übergabe einer zurückgestellten Reservierung (vor dem Fenster) bei fehlendem Bestand: oversold sofort sichtbar
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  UPDATE gift_basket_variants SET stock_qty = 1 WHERE id = v_var;
  PERFORM pg_temp.prep(o3, '8', 1);
  PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes');
  PERFORM gift_confirm_reservation(repeat('8', 64));
  PERFORM pg_temp.prep(o1, '9', 30);
  PERFORM gift_reserve_stock(o1, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes', false);
  PERFORM gift_confirm_reservation(repeat('9', 64));
  res := gift_consume_stock(o1);
  ASSERT (res->>'oversold')::boolean, 'deferred + fremder aktiver Hold: oversold sofort';
  ASSERT (SELECT stock_qty FROM gift_basket_variants WHERE id = v_var) = 1, 'fremder Hold bleibt unangetastet';

  -- 14g) Abgelaufenes reservation_until einer zurückgestellten Reservierung: verfällt bei der Aktivierung
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  PERFORM pg_temp.prep(o2, 'a', 30);
  PERFORM gift_reserve_stock(o2, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',1)), now() + interval '30 minutes', false);
  PERFORM gift_confirm_reservation(repeat('a', 64));
  UPDATE gift_orders SET handover_date = (now() AT TIME ZONE 'Europe/Berlin')::date + 1, reservation_until = now() - interval '1 hour' WHERE id = o2;
  PERFORM gift_activate_deferred_holds();
  ASSERT (SELECT status FROM gift_orders WHERE id = o2) = 'expired' AND (SELECT status FROM gift_stock_holds WHERE order_id = o2) = 'released', 'abgelaufene zurückgestellte Reservierung verfällt';

  -- 14h) Storno gibt zurückgestellte Holds frei
  DELETE FROM gift_stock_holds WHERE order_id IN (o1, o2, o3);
  PERFORM pg_temp.prep(o3, 'b', 40);
  PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',5)), now() + interval '30 minutes', false);   -- ohne Bestandsprüfung
  PERFORM gift_confirm_reservation(repeat('b', 64));
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o3) = 'deferred';
  ASSERT gift_release_stock(o3) = 1, 'Storno gibt einen Hold frei';
  ASSERT (SELECT status FROM gift_stock_holds WHERE order_id = o3) = 'released', 'Storno gibt zurückgestellten Hold frei';

  -- 14i) Online (Stripe) unverändert: Standardaufruf prüft den Bestand weiterhin
  caught := false;
  BEGIN
    PERFORM gift_reserve_stock(o3, jsonb_build_array(jsonb_build_object('variant_id',v_var,'qty',5)), now() + interval '35 minutes');
  EXCEPTION WHEN OTHERS THEN caught := (SQLERRM = 'sold_out');
  END;
  ASSERT caught, 'Standardaufruf (online) prüft den Bestand unverändert';

  RAISE NOTICE 'gift_stock.sql: alle Assertions grün';
END $$;

ROLLBACK;

-- ECHTER PARALLEL-TEST (manuell, zwei psql-Sessions auf einer Test-DB, Variante mit stock_qty = 1):
--   Session A: BEGIN; SELECT gift_reserve_stock(<orderA>, '[{"variant_id":"<v>","qty":1}]', now()+interval '35 min'); -- noch nicht committen
--   Session B: BEGIN; SELECT gift_reserve_stock(<orderB>, ...);   -- blockiert an FOR UPDATE
--   Session A: COMMIT;   -> B wird freigegeben und wirft 'sold_out'.
