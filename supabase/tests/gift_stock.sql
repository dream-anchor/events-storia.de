-- SQL-Tests Geschenkkorb-Bestand. Lauf gegen eine Wegwerf-/Branch-DB (NIE Produktion):
--   psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/gift_stock.sql
-- Alles in einer Transaktion mit ROLLBACK am Ende. Voraussetzung: Migrationen 20261120100000-200 angewendet.
-- Echter Parallel-Test (zwei Sessions) siehe Kommentar ganz unten.
BEGIN;

DO $$
DECLARE
  v_basket uuid; v_var uuid; o1 uuid; o2 uuid; o3 uuid; res jsonb; n int; caught boolean;
BEGIN
  INSERT INTO gift_baskets (slug, size_key, name_de, name_en, price_cents, active) VALUES ('t-korb','klein','T','T',9900,true) RETURNING id INTO v_basket;
  INSERT INTO gift_basket_variants (basket_id, key, label_de, label_en, stock_qty) VALUES (v_basket,'w1','W1','W1',1) RETURNING id INTO v_var;
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

  RAISE NOTICE 'gift_stock.sql: alle Assertions grün';
END $$;

ROLLBACK;

-- ECHTER PARALLEL-TEST (manuell, zwei psql-Sessions auf einer Test-DB, Variante mit stock_qty = 1):
--   Session A: BEGIN; SELECT gift_reserve_stock(<orderA>, '[{"variant_id":"<v>","qty":1}]', now()+interval '35 min'); -- noch nicht committen
--   Session B: BEGIN; SELECT gift_reserve_stock(<orderB>, ...);   -- blockiert an FOR UPDATE
--   Session A: COMMIT;   -> B wird freigegeben und wirft 'sold_out'.
