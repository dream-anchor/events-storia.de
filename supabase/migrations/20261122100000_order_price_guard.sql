-- Z4 Preisprüfung in der Datenbank (Einheit I3, Teil 2): Catering-Bestellungen und EVT-Buchungen
-- dürfen die Browser-Preise nicht mehr einfach übernehmen — auch nicht auf Wegen OHNE Stripe
-- (Rechnung, Anfrage, direkter RPC-/Tabellenzugriff).
--
-- Warum ein Trigger auf v2_events (und nicht nur in den RPCs):
--  * checkout_create_catering_order / checkout_create_event_booking sind nur EIN Weg. Die Policy
--    "Anyone can insert v2_events for active tenant" (20260703120000) erlaubt anon außerdem das direkte
--    INSERT in v2_events (inkl. amount_total, items, source_catering_id / source_booking_id).
--  * catering_orders / event_bookings sind Views mit INSTEAD OF-Triggern, die ebenfalls in v2_events schreiben.
--  => Ein BEFORE-INSERT-Trigger auf v2_events ist der einzige Engpass, den alle Wege passieren.
--
-- Wer wird geprüft: nur Aufrufer mit Rolle anon/authenticated, die weder admin noch staff sind.
-- NICHT geprüft (Admin-Ausnahmen bleiben möglich): service_role (Edge Functions), admin/staff (Admin-Panel,
-- manuelle Preise), Verbindungen ohne JWT (Migrationen, SQL-Editor, Cron). UPDATEs sind nicht betroffen.
--
-- Regeln = 1:1 wie supabase/functions/_shared/cateringPricing.ts (Catering) bzw. src/lib/eventPricing.ts (Event):
--  Catering: Positionen aus menu_items (nur Catering-Menü + veröffentlicht, Artikel/Kategorie nicht gelöscht/archiviert),
--   Namensprüfung, Chafing-Dish fix 25,00 EUR, Einzelpreis +-1 Cent, Liefergebühr/Aufschlag passend zur gemeldeten
--   Entfernung (+-0,05 km, Chafing-Toleranz), Summe = Positionen + Aufschlag + Liefergebühr +-1 Cent.
--  Event: Betrag = Paketpreis (pro Person / pauschal / "Gesamte Location" gestaffelt) +-1 Cent.
-- GRENZE: Die Entfernung steht als calculated_distance_km im Datensatz und kann die DB nicht selbst prüfen
-- (kein Routing in SQL). Bei Stripe/Billie prüft create-catering-payment sie zusätzlich per OpenRouteService.
--
-- EXPAND-ONLY: keine Tabellen-/Spaltenänderung, keine Datenänderung; Rollback = DROP TRIGGER + DROP FUNCTION (unten).

-- ---------------------------------------------------------------------------
-- Tarif-Helfer (rein, IMMUTABLE): gespiegelt aus calculate-delivery/index.ts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_guard_min_order_cents(p_km numeric)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_km <= 1 THEN 5000 WHEN p_km <= 8 THEN 15000 ELSE 20000 END;
$$;

CREATE OR REPLACE FUNCTION public.order_guard_delivery_fee_cents(p_km numeric, p_pizza_only boolean)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_trips integer;
  v_net numeric;
BEGIN
  IF p_km <= 1 THEN RETURN 0; END IF;
  v_trips := CASE WHEN p_pizza_only THEN 1 ELSE 2 END;
  IF p_km <= 8 THEN
    v_net := 50 * v_trips;
  ELSE
    v_net := round((50 * v_trips + p_km * v_trips * 1.2) * 100) / 100;
  END IF;
  RETURN round(v_net * 1.19 * 100)::integer;   -- brutto, 19 % USt
END;
$$;

-- ---------------------------------------------------------------------------
-- Fehler mit deutscher Meldung (landet im Checkout als "Fehler beim Absenden: ...")
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_guard_reject(p_code text, p_message text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '%', p_message USING DETAIL = 'order_price_guard:' || p_code, ERRCODE = 'P0001';
END;
$$;

-- ---------------------------------------------------------------------------
-- Catering-Prüfung
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_guard_catering(
  p_items jsonb,
  p_is_pickup boolean,
  p_km numeric,
  p_delivery_cents integer,
  p_surcharge_cents integer,
  p_total numeric
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  c_chafing constant text := 'chafing-dish';
  c_pizza_slug constant text := 'pizze-napoletane';
  v_line jsonb;
  v_id text;
  v_qty numeric;
  v_price numeric;
  v_unit integer;
  v_items_cents bigint := 0;
  v_chafing_cents bigint := 0;
  v_menu_lines integer := 0;
  v_pizza_lines integer := 0;
  v_has_chafing boolean := false;
  v_item record;
  v_norm_name text;
  v_norm_name_en text;
  v_delivery integer := 0;
  v_surcharge integer := 0;
  v_km_lo numeric;
  v_km_hi numeric;
  v_variant boolean;
  v_in_range boolean := false;
  v_lo integer;
  v_hi integer;
  v_min_lo integer;
  v_min_hi integer;
  v_s_lo bigint;
  v_s_hi bigint;
  v_expected bigint;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    PERFORM public.order_guard_reject('invalid_items', 'Die Bestellpositionen sind ungültig. Bitte laden Sie die Seite neu und bestellen Sie erneut.');
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- IS DISTINCT FROM: fehlende Schlüssel liefern NULL und dürfen die Prüfung nicht umgehen
    IF jsonb_typeof(v_line) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_line->'id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_line->'quantity') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_line->'price') IS DISTINCT FROM 'number' THEN
      PERFORM public.order_guard_reject('invalid_items', 'Die Bestellpositionen sind ungültig. Bitte laden Sie die Seite neu und bestellen Sie erneut.');
    END IF;
    v_id := v_line->>'id';
    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'price')::numeric;
    IF v_qty <> trunc(v_qty) OR v_qty < 1 OR v_qty > 10000 THEN
      PERFORM public.order_guard_reject('invalid_items', 'Die Bestellpositionen sind ungültig. Bitte laden Sie die Seite neu und bestellen Sie erneut.');
    END IF;

    IF v_id = c_chafing THEN
      v_unit := 2500;   -- Leihgerät, Checkout.tsx CHAFING_DISH.price = 25,00 EUR brutto
      v_has_chafing := true;
    ELSE
      IF v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        PERFORM public.order_guard_reject('unknown_item', 'Eine Position ist nicht mehr im Angebot. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.');
      END IF;
      SELECT mi.name, mi.name_en, mi.price, mi.deleted_at AS item_deleted, mi.archived_at AS item_archived,
             mc.id AS cat_id, m.id AS menu_id, m.slug AS menu_slug
        INTO v_item
        FROM public.menu_items mi
        LEFT JOIN public.menu_categories mc
               ON mc.id = mi.category_id AND mc.deleted_at IS NULL AND mc.archived_at IS NULL
        LEFT JOIN public.menus m
               ON m.id = mc.menu_id AND m.menu_type = 'catering' AND m.is_published IS TRUE
       WHERE mi.id = v_id::uuid;
      IF NOT FOUND THEN
        PERFORM public.order_guard_reject('unknown_item', 'Eine Position ist nicht mehr im Angebot. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.');
      END IF;
      IF v_item.item_deleted IS NOT NULL OR v_item.item_archived IS NOT NULL
         OR v_item.menu_id IS NULL OR v_item.price IS NULL THEN
        PERFORM public.order_guard_reject('item_unavailable', 'Eine Position ist nicht mehr verfügbar. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.');
      END IF;
      v_norm_name := btrim(CASE WHEN jsonb_typeof(v_line->'name') = 'string' THEN v_line->>'name' ELSE '' END);
      v_norm_name_en := btrim(CASE WHEN jsonb_typeof(v_line->'name_en') = 'string' THEN v_line->>'name_en' ELSE '' END);
      IF v_norm_name <> btrim(COALESCE(v_item.name, '')) OR v_norm_name_en <> btrim(COALESCE(v_item.name_en, '')) THEN
        PERFORM public.order_guard_reject('name_mismatch', 'Die Bezeichnung einer Position hat sich geändert. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.');
      END IF;
      v_unit := round(v_item.price * 100)::integer;
      v_menu_lines := v_menu_lines + 1;
      IF v_item.menu_slug = c_pizza_slug THEN v_pizza_lines := v_pizza_lines + 1; END IF;
    END IF;

    IF abs(round(v_price * 100) - v_unit) > 1 THEN
      PERFORM public.order_guard_reject('price_mismatch', 'Die Preise haben sich geändert. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.');
    END IF;
    v_items_cents := v_items_cents + v_unit::bigint * v_qty::bigint;
    IF v_id = c_chafing THEN v_chafing_cents := v_chafing_cents + v_unit::bigint * v_qty::bigint; END IF;
  END LOOP;

  IF p_total IS NULL THEN
    PERFORM public.order_guard_reject('total_mismatch', 'Der Gesamtbetrag stimmt nicht. Bitte laden Sie die Seite neu und bestellen Sie erneut.');
  END IF;

  IF COALESCE(p_is_pickup, false) THEN
    -- Abholung: weder Liefergebühr noch Aufschlag
    IF COALESCE(p_delivery_cents, 0) > 1 THEN
      PERFORM public.order_guard_reject('delivery_mismatch', 'Die Lieferkosten stimmen nicht. Bitte laden Sie die Seite neu und geben Sie die Adresse erneut ein.');
    END IF;
    IF COALESCE(p_surcharge_cents, 0) > 1 THEN
      PERFORM public.order_guard_reject('surcharge_mismatch', 'Der Mindestbestellwert-Aufschlag stimmt nicht. Bitte laden Sie die Seite neu und bestellen Sie erneut.');
    END IF;
  ELSE
    IF p_km IS NULL OR p_km < 0 OR p_km > 500 THEN
      PERFORM public.order_guard_reject('delivery_unverifiable', 'Die Lieferkosten konnten nicht geprüft werden. Bitte geben Sie die Adresse erneut ein.');
    END IF;
    v_km_lo := greatest(0, p_km - 0.05);   -- Routing-Drift/Rundung der Entfernung (calculate-delivery rundet auf 0,1 km)
    v_km_hi := p_km + 0.05;
    -- Pizza-only: Chafing-Zeilen zählen nicht; steckt eine im Warenkorb, sind beide Varianten zulässig (wie TS)
    FOREACH v_variant IN ARRAY (
      CASE WHEN v_has_chafing AND v_menu_lines > 0 AND v_pizza_lines = v_menu_lines THEN ARRAY[true, false]
           ELSE ARRAY[v_menu_lines > 0 AND v_pizza_lines = v_menu_lines] END
    ) LOOP
      v_lo := public.order_guard_delivery_fee_cents(v_km_lo, v_variant);
      v_hi := public.order_guard_delivery_fee_cents(v_km_hi, v_variant);
      IF COALESCE(p_delivery_cents, 0) >= v_lo - 1 AND COALESCE(p_delivery_cents, 0) <= v_hi + 1 THEN
        v_in_range := true;
      END IF;
    END LOOP;
    IF NOT v_in_range THEN
      PERFORM public.order_guard_reject('delivery_mismatch', 'Die Lieferkosten stimmen nicht. Bitte laden Sie die Seite neu und geben Sie die Adresse erneut ein.');
    END IF;
    v_delivery := COALESCE(p_delivery_cents, 0);

    -- Aufschlag: Client rechnet OHNE das im Checkout zugewählte Chafing-Leihgerät -> Wert zwischen "mit" und "ohne Chafing"
    v_min_lo := public.order_guard_min_order_cents(v_km_lo);
    v_min_hi := public.order_guard_min_order_cents(v_km_hi);
    v_s_lo := greatest(0, least(v_min_lo, v_min_hi) - v_items_cents);
    v_s_hi := greatest(0, greatest(v_min_lo, v_min_hi) - (v_items_cents - v_chafing_cents));
    IF COALESCE(p_surcharge_cents, 0) < v_s_lo - 1 OR COALESCE(p_surcharge_cents, 0) > v_s_hi + 1 THEN
      PERFORM public.order_guard_reject('surcharge_mismatch', 'Der Mindestbestellwert-Aufschlag stimmt nicht. Bitte laden Sie die Seite neu und bestellen Sie erneut.');
    END IF;
    v_surcharge := COALESCE(p_surcharge_cents, 0);
  END IF;

  v_expected := v_items_cents + v_surcharge + v_delivery;
  IF abs(round(p_total * 100) - v_expected) > 1 THEN
    PERFORM public.order_guard_reject('total_mismatch', 'Der Gesamtbetrag stimmt nicht. Bitte laden Sie die Seite neu und bestellen Sie erneut.');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- EVT-Buchung (Eventpaket): Betrag gegen packages nachrechnen, wie src/lib/eventPricing.ts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_guard_event_booking(p_package_id uuid, p_guests integer, p_total numeric)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  c_location_id constant uuid := 'b147ea52-9907-445f-9f39-b7ddecbb0ddf';   -- "Gesamte Location"
  c_location_price constant numeric := 8500;
  c_location_guests constant integer := 70;
  v_pkg record;
  v_expected numeric;
BEGIN
  IF p_package_id IS NULL OR p_guests IS NULL OR p_guests < 1 OR p_total IS NULL THEN
    PERFORM public.order_guard_reject('invalid_booking', 'Die Buchungsdaten sind unvollständig. Bitte laden Sie die Seite neu und buchen Sie erneut.');
  END IF;
  SELECT id, price, price_per_person, is_active INTO v_pkg FROM public.packages WHERE id = p_package_id;
  IF NOT FOUND OR COALESCE(v_pkg.is_active, true) IS NOT TRUE THEN
    PERFORM public.order_guard_reject('unknown_package', 'Dieses Eventpaket ist nicht mehr verfügbar. Bitte laden Sie die Seite neu.');
  END IF;

  IF COALESCE(v_pkg.price_per_person, false) THEN
    v_expected := v_pkg.price * p_guests;
  ELSIF v_pkg.id = c_location_id OR v_pkg.price = c_location_price THEN
    v_expected := c_location_price + greatest(0, p_guests - c_location_guests) * (c_location_price / c_location_guests);
  ELSE
    v_expected := v_pkg.price;
  END IF;

  IF abs(round(p_total * 100) - round(v_expected * 100)) > 1 THEN
    PERFORM public.order_guard_reject('price_mismatch', 'Der Preis des Eventpakets hat sich geändert. Bitte laden Sie die Seite neu und buchen Sie erneut.');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger-Funktion + Trigger auf v2_events (nur INSERT; nur Zeilen, die Catering-Bestellung/EVT-Buchung sind)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_events_order_price_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.role();
BEGIN
  -- Ausnahmen: service_role (Edge Functions), Verbindungen ohne JWT-Rolle (Migrationen, SQL, Cron)
  IF v_role IS NULL OR v_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  -- Ausnahme: Admin/Staff (manuelle Preise, Admin-Panel)
  IF auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RETURN NEW;
  END IF;

  IF NEW.source_catering_id IS NOT NULL THEN
    PERFORM public.order_guard_catering(
      NEW.items,
      NEW.is_pickup,
      NEW.calculated_distance_km,
      NEW.delivery_cost_cents,
      NEW.minimum_order_surcharge_cents,
      NEW.amount_total
    );
  ELSIF NEW.source_booking_id IS NOT NULL THEN
    PERFORM public.order_guard_event_booking(NEW.package_id, NEW.guest_count, NEW.amount_total);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_v2_events_order_price_guard ON public.v2_events;
CREATE TRIGGER tg_v2_events_order_price_guard
  BEFORE INSERT ON public.v2_events
  FOR EACH ROW
  WHEN (NEW.source_catering_id IS NOT NULL OR NEW.source_booking_id IS NOT NULL)
  EXECUTE FUNCTION public.v2_events_order_price_guard();

-- Kein direkter Aufruf der Helfer durch Clients (Trigger läuft als Funktionseigentümer)
REVOKE ALL ON FUNCTION public.order_guard_min_order_cents(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_guard_delivery_fee_cents(numeric, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_guard_reject(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_guard_catering(jsonb, boolean, numeric, integer, integer, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_guard_event_booking(uuid, integer, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v2_events_order_price_guard() FROM PUBLIC, anon, authenticated;

-- Rollback (nur im Notfall, NICHT mitlaufen lassen):
--   DROP TRIGGER IF EXISTS tg_v2_events_order_price_guard ON public.v2_events;
--   DROP FUNCTION IF EXISTS public.v2_events_order_price_guard();
--   DROP FUNCTION IF EXISTS public.order_guard_event_booking(uuid, integer, numeric);
--   DROP FUNCTION IF EXISTS public.order_guard_catering(jsonb, boolean, numeric, integer, integer, numeric);
--   DROP FUNCTION IF EXISTS public.order_guard_reject(text, text);
--   DROP FUNCTION IF EXISTS public.order_guard_delivery_fee_cents(numeric, boolean);
--   DROP FUNCTION IF EXISTS public.order_guard_min_order_cents(numeric);
