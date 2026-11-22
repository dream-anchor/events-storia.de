-- Z4 Abdichtung (Entscheidung Antoine, 22.11.2026): "Das muss nachgerechnet werden und immer aktuell ausgegeben werden.
-- Und alles abdichten."
--
-- Catering-Bestellungen und EVT-Buchungen werden NUR noch von der Edge Function create-catering-payment (mode 'create',
-- service_role) angelegt. Sie rechnet Positionen, Entfernung (OpenRouteService), Liefergebühr, Mindestbestellwert-Aufschlag
-- und Summe selbst. Diese Migration entzieht dem Browser (anon + eingeloggte Kunden) alle direkten Schreibwege.
--
-- EINSPIELEN ERST NACH: (1) Edge Functions quote-catering-order, create-catering-payment, calculate-delivery,
-- handle-stripe-webhook deployt, (2) Frontend (Checkout nutzt create-catering-payment) live. Sonst scheitert der alte Checkout.
-- (Reihenfolge und Begründung: PR-Beschreibung.) Die Preisprüf-Migration 20261122100000 muss davor eingespielt sein.
--
-- ALLE Schreibwege auf v2_events / catering_orders / event_bookings (Stand 22.11.2026, jeder einzeln geprüft):
--  1. RPC checkout_create_catering_order / checkout_create_event_booking
--       war: anon + authenticated  ->  jetzt: NUR service_role (REVOKE unten). Einziger Aufrufer: create-catering-payment.
--  2. INSTEAD-OF-INSERT der Views catering_orders / event_bookings (Trigger schreiben als SECURITY DEFINER in v2_events,
--       an RLS vorbei)  ->  INSERT-Recht für anon entzogen; die Trigger lehnen zusätzlich jeden Aufrufer ab, der weder
--       service_role noch admin/staff noch verbindungslos (Migration/Cron) ist (authenticated-Kunden).
--  3. Direkter INSERT in v2_events (Policy "Anyone can insert v2_events for active tenant", 20260703)  ->  Policy entfernt.
--       admin/staff schreiben weiter über die bestehenden "manage"-Policies.
--  4. Admin-Panel (refine, CateringOrderEditor, EventBookingEditor)  ->  unverändert (admin/staff, freie Preise bleiben möglich).
--  5. Edge Functions mit service_role (receive-event-inquiry, receive-group-inquiry(-webhook), inbound-maestro-email,
--       create-inquiry-from-inbox-email, handle-stripe-webhook, ...)  ->  unverändert; sie setzen keine Kundenpreise.
--       Anfrageformulare (Event-/Gruppenanfrage) laufen ausschließlich über diese Functions, nicht über anon-INSERT.
--  6. View event_inquiries (INSTEAD-OF-INSERT, anon)  ->  Trigger sanitisiert für Kunden-Rollen: Status fest 'new' (vorher
--       ergab 'confirmed' sofort v2-Status 'paid'), quote_items/selected_*/menu_selection/internal_notes/payment_method verworfen.
--  7. Geschenkkorb-Shop und Mischbestellung (gift_orders, gift_order_items, gift_stock_holds)  ->  eigene Tabellen, Anlage nur
--       über die Edge Function create-gift-order (Serverpreise, service_role); schreiben nicht in v2_events. Die Catering-Seite
--       der Mischbestellung läuft über Weg 1.
--
-- ZUSÄTZLICH (Befund A8): Kunden dürfen Status/Zahlstatus nie setzen. Die RPCs ignorieren payment_status/status aus der
-- Nutzlast. Eine EVT-Buchung entsteht als "offen" (v2-Status offer_chosen); "paid" setzt erst der Stripe-Webhook nach der Zahlung.
-- Der Insert-Trigger der View event_bookings machte bisher aus jedem Status außer ready/menu_pending/completed/cancelled
-- (also auch dem Standardwert 'confirmed') sofort 'paid'; jetzt wird daraus 'offer_chosen'.
--
-- EXPAND-ONLY im Sinne der Daten: keine Tabellen-/Spaltenänderung, keine Datenänderung. Rollback: siehe Dateiende.

-- ---------------------------------------------------------------------------
-- Wer darf Bestellungen/Buchungen anlegen? service_role, Verbindungen ohne Kunden-JWT (Migration/SQL/Cron), admin/staff.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_insert_allowed()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('anon', 'authenticated') THEN
    RETURN true;
  END IF;
  RETURN auth.uid() IS NOT NULL
     AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
END;
$$;
REVOKE ALL ON FUNCTION public.order_insert_allowed() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1) RPCs: nur service_role; Status/Zahlstatus werden nicht mehr aus der Nutzlast übernommen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_create_event_booking(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE((payload->>'id')::uuid, gen_random_uuid());
BEGIN
  IF NOT public.order_insert_allowed() THEN
    RAISE EXCEPTION 'Buchungen dürfen nur über den Checkout-Server angelegt werden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.event_bookings (
    id, booking_number, customer_name, customer_email, phone, company_name,
    event_date, event_time, guest_count, package_id, total_amount,
    payment_status, status, internal_notes, menu_selection
  ) VALUES (
    v_id,
    payload->>'booking_number',
    payload->>'customer_name',
    payload->>'customer_email',
    payload->>'phone',
    payload->>'company_name',
    (payload->>'event_date')::date,
    payload->>'event_time',
    NULLIF(payload->>'guest_count','')::integer,
    NULLIF(payload->>'package_id','')::uuid,
    NULLIF(payload->>'total_amount','')::numeric,
    'pending',        -- fest: nie aus der Nutzlast
    'menu_pending',   -- fest: offen (v2-Status offer_chosen); bezahlt setzt erst der Stripe-Webhook
    payload->>'internal_notes',
    NULLIF(payload->'menu_selection','null')
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_create_catering_order(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE((payload->>'id')::uuid, gen_random_uuid());
BEGIN
  IF NOT public.order_insert_allowed() THEN
    RAISE EXCEPTION 'Bestellungen dürfen nur über den Checkout-Server angelegt werden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.catering_orders (
    id, order_number, customer_name, customer_email, customer_phone, company_name,
    delivery_street, delivery_zip, delivery_city, delivery_floor, has_elevator,
    delivery_address, is_pickup, desired_date, desired_time, notes, items,
    total_amount, billing_name, billing_street, billing_zip, billing_city, billing_country,
    delivery_cost, minimum_order_surcharge, calculated_distance_km,
    payment_method, payment_status, user_id, reference_number
  ) VALUES (
    v_id,
    payload->>'order_number',
    payload->>'customer_name',
    payload->>'customer_email',
    payload->>'customer_phone',
    payload->>'company_name',
    payload->>'delivery_street',
    payload->>'delivery_zip',
    payload->>'delivery_city',
    payload->>'delivery_floor',
    COALESCE((payload->>'has_elevator')::boolean,false),
    payload->>'delivery_address',
    COALESCE((payload->>'is_pickup')::boolean,false),
    NULLIF(payload->>'desired_date','')::date,
    NULLIF(payload->>'desired_time','')::time,
    payload->>'notes',
    COALESCE(payload->'items','[]'::jsonb),
    NULLIF(payload->>'total_amount','')::numeric,
    payload->>'billing_name',
    payload->>'billing_street',
    payload->>'billing_zip',
    payload->>'billing_city',
    payload->>'billing_country',
    NULLIF(payload->>'delivery_cost','')::numeric,
    NULLIF(payload->>'minimum_order_surcharge','')::numeric,
    NULLIF(payload->>'calculated_distance_km','')::numeric,   -- EINFACHE Strecke in km (Fahrtenzahl steht nicht im Datensatz)
    payload->>'payment_method',
    'pending',        -- fest: nie aus der Nutzlast
    NULLIF(payload->>'user_id','')::uuid,
    payload->>'reference_number'
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_create_event_booking(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_create_catering_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_create_event_booking(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_create_catering_order(jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Views: INSERT für anon entziehen; Trigger lehnen Kunden-Rollen ab (Definitionen wie 20260422220451, plus Zugriffsprüfung)
-- ---------------------------------------------------------------------------
REVOKE INSERT ON public.catering_orders FROM anon;
REVOKE INSERT ON public.event_bookings FROM anon;

CREATE OR REPLACE FUNCTION public.event_bookings_insert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_customer_id uuid; new_event_id uuid;
BEGIN
  IF NOT public.order_insert_allowed() THEN
    RAISE EXCEPTION 'Buchungen dürfen nur über den Checkout-Server angelegt werden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO new_customer_id FROM v2_customers
  WHERE lower(email) = lower(NEW.customer_email)
    AND lower(COALESCE(name,'')) = lower(COALESCE(NEW.customer_name,''))
  LIMIT 1;
  IF new_customer_id IS NULL THEN
    INSERT INTO v2_customers (name, email, phone, company, created_at, updated_at)
    VALUES (NEW.customer_name, NEW.customer_email, NEW.phone, NEW.company_name, now(), now())
    RETURNING id INTO new_customer_id;
  END IF;

  new_event_id := COALESCE(NEW.id, gen_random_uuid());

  INSERT INTO v2_events (
    id, customer_id, status, location, service_type,
    date, event_time, guest_count, amount_total, package_id, location_id,
    booking_number, menu_confirmed, menu_selection,
    invoice_lexoffice_id, lexoffice_document_type, source,
    internal_notes, created_at, updated_at,
    source_booking_id
  ) VALUES (
    new_event_id, new_customer_id,
    CASE NEW.status
      WHEN 'ready' THEN 'paid'::v2_event_status
      WHEN 'menu_pending' THEN 'offer_chosen'::v2_event_status
      WHEN 'completed' THEN 'completed'::v2_event_status
      WHEN 'cancelled' THEN 'cancelled'::v2_event_status
      ELSE 'offer_chosen'::v2_event_status   -- früher 'paid': ein unbekannter/Standardstatus ('confirmed') bedeutet NICHT bezahlt
    END,
    'in_house'::v2_event_location, 'restaurant'::v2_event_service,
    NEW.event_date, NEW.event_time, NEW.guest_count, NEW.total_amount,
    NEW.package_id, NEW.location_id,
    NEW.booking_number, COALESCE(NEW.menu_confirmed,false), NEW.menu_selection,
    NEW.lexoffice_invoice_id, NEW.lexoffice_document_type,
    'manual'::v2_event_source, NEW.internal_notes,
    COALESCE(NEW.created_at, now()), now(),
    new_event_id   -- self-reference
  );

  NEW.id := new_event_id;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.catering_orders_insert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_customer_id uuid; new_event_id uuid;
BEGIN
  IF NOT public.order_insert_allowed() THEN
    RAISE EXCEPTION 'Bestellungen dürfen nur über den Checkout-Server angelegt werden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO new_customer_id FROM v2_customers
  WHERE lower(email) = lower(NEW.customer_email)
    AND lower(COALESCE(name,'')) = lower(COALESCE(NEW.customer_name,''))
  LIMIT 1;
  IF new_customer_id IS NULL THEN
    INSERT INTO v2_customers (name, email, phone, company, address_street, address_zip, address_city, created_at, updated_at)
    VALUES (NEW.customer_name, NEW.customer_email, NEW.customer_phone, NEW.company_name,
            NEW.delivery_street, NEW.delivery_zip, NEW.delivery_city, now(), now())
    RETURNING id INTO new_customer_id;
  END IF;

  new_event_id := COALESCE(NEW.id, gen_random_uuid());

  INSERT INTO v2_events (
    id, customer_id, status, location, service_type,
    date, time_from, amount_total, is_test, source,
    internal_notes, customer_notes,
    invoice_lexoffice_id, lexoffice_document_type, items,
    billing_name, billing_street, billing_postal_code, billing_city, billing_country,
    delivery_address, delivery_street, delivery_zip, delivery_city, delivery_floor,
    has_elevator, is_pickup, calculated_distance_km,
    delivery_cost_cents, minimum_order_surcharge_cents, booking_number,
    created_at, updated_at,
    source_catering_id
  ) VALUES (
    new_event_id, new_customer_id,
    CASE COALESCE(NEW.status,'pending')
      WHEN 'pending' THEN 'inquiry'::v2_event_status
      WHEN 'confirmed' THEN 'offer_chosen'::v2_event_status
      WHEN 'completed' THEN 'completed'::v2_event_status
      WHEN 'cancelled' THEN 'cancelled'::v2_event_status
      ELSE 'inquiry'::v2_event_status
    END,
    'external'::v2_event_location, 'catering'::v2_event_service,
    NEW.desired_date, NEW.desired_time, NEW.total_amount,
    COALESCE(NEW.is_test,false), 'catering_form'::v2_event_source,
    NEW.internal_notes, NEW.notes,
    NEW.lexoffice_invoice_id, NEW.lexoffice_document_type, NEW.items,
    NEW.billing_name, NEW.billing_street, NEW.billing_zip, NEW.billing_city,
    COALESCE(NEW.billing_country,'Deutschland'),
    NEW.delivery_address, NEW.delivery_street, NEW.delivery_zip, NEW.delivery_city,
    NEW.delivery_floor, COALESCE(NEW.has_elevator,false), COALESCE(NEW.is_pickup,false),
    NEW.calculated_distance_km,
    (COALESCE(NEW.delivery_cost,0) * 100)::integer,
    (COALESCE(NEW.minimum_order_surcharge,0) * 100)::integer,
    NEW.order_number,
    COALESCE(NEW.created_at, now()), now(),
    new_event_id   -- self-reference
  );

  NEW.id := new_event_id;
  RETURN NEW;
END $function$;

-- ---------------------------------------------------------------------------
-- 2b) View event_inquiries: Kunden-Rollen dürfen nur eine Anfrage anlegen (Befund B7). Definition wie 20260501200216, plus Sanitisierung.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_inquiries_insert_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_customer_id uuid;
  new_event_id uuid;
  v_service v2_event_service;
  v_loc v2_event_location;
  v_source v2_event_source;
BEGIN
  -- Abdichtung (22.11.2026): Kunden-Rollen (anon, eingeloggte Kunden ohne admin/staff) legen nur eine ANFRAGE an. Status fest 'new'
  -- (vorher machte 'confirmed' daraus sofort 'paid'), Preis-/Positions-/Menüfelder und interne Notizen werden verworfen.
  -- service_role (receive-event-inquiry, receive-group-inquiry, ...) und admin/staff bleiben unverändert.
  IF NOT public.order_insert_allowed() THEN
    NEW.status := 'new';
    NEW.quote_items := NULL;
    NEW.selected_items := NULL;
    NEW.selected_packages := NULL;
    NEW.menu_selection := NULL;
    NEW.internal_notes := NULL;
    NEW.payment_method := NULL;
    NEW.invoice_due_days := NULL;
    NEW.is_test := false;               -- Standardwerte der Tabelle (priority 'normal', notification_sent false)
    NEW.notification_sent := false;
    NEW.priority := 'normal';
    NEW.created_at := now();            -- kein rückdatiertes created_at
  END IF;

  SELECT id INTO new_customer_id FROM v2_customers
  WHERE lower(email) = lower(NEW.email)
    AND lower(COALESCE(name, '')) = lower(COALESCE(NEW.contact_name, ''))
  LIMIT 1;

  IF new_customer_id IS NULL THEN
    INSERT INTO v2_customers (name, email, phone, company, created_at, updated_at)
    VALUES (NEW.contact_name, NEW.email, NEW.phone, NEW.company_name, now(), now())
    RETURNING id INTO new_customer_id;
  END IF;

  IF NEW.inquiry_type::text = 'catering' THEN
    v_service := 'catering'; v_loc := 'external';
  ELSE
    v_service := 'restaurant'; v_loc := 'in_house';
  END IF;

  v_source := CASE
    WHEN NEW.source IS NULL OR NEW.source = '' THEN 'website'::v2_event_source
    WHEN NEW.source LIKE 'package_inquiry%' THEN 'website'::v2_event_source
    WHEN NEW.source IN ('website','website_contact_form','ristorante-website') THEN 'website'::v2_event_source
    WHEN NEW.source IN ('manual_entry','manual','test') THEN 'manual'::v2_event_source
    WHEN NEW.source = 'email_inbound' THEN 'email_inbound'::v2_event_source
    WHEN NEW.source = 'phone' THEN 'phone'::v2_event_source
    WHEN NEW.source = 'catering_form' THEN 'catering_form'::v2_event_source
    ELSE 'website'::v2_event_source
  END;

  new_event_id := COALESCE(NEW.id, gen_random_uuid());

  INSERT INTO v2_events (
    id, customer_id, status, location, service_type,
    date, event_end_date, event_time, guest_count, occasion,
    customer_notes, internal_notes, source, is_test, notification_sent,
    created_at, updated_at, selected_items, selected_packages, quote_items, menu_selection,
    venue, location_type, location_name, location_street, location_postal_code, location_city, location_country,
    company_street, company_postal_code, company_city, company_country,
    billing_address_different, billing_company_name, billing_street, billing_postal_code, billing_city, billing_country,
    delivery_street, delivery_zip, delivery_city, priority,
    payment_method, invoice_due_days,
    source_inquiry_id
  ) VALUES (
    new_event_id, new_customer_id,
    CASE COALESCE(NEW.status,'new')
      WHEN 'new' THEN 'inquiry'::v2_event_status
      WHEN 'contacted' THEN 'offer_draft'::v2_event_status
      WHEN 'offer_sent' THEN 'offer_sent'::v2_event_status
      WHEN 'confirmed' THEN 'paid'::v2_event_status
      WHEN 'declined' THEN 'offer_declined'::v2_event_status
      WHEN 'cancelled' THEN 'cancelled'::v2_event_status
      WHEN 'completed' THEN 'completed'::v2_event_status
      ELSE 'inquiry'::v2_event_status
    END,
    v_loc, v_service,
    NEW.preferred_date, NEW.event_end_date, NEW.time_slot,
    NULLIF(regexp_replace(COALESCE(NEW.guest_count,''), '[^0-9]', '', 'g'), '')::integer,
    NEW.event_type, NEW.message, NEW.internal_notes,
    v_source, COALESCE(NEW.is_test,false), COALESCE(NEW.notification_sent,false),
    COALESCE(NEW.created_at, now()), now(),
    COALESCE(NEW.selected_items, '[]'::jsonb),
    COALESCE(NEW.selected_packages, '[]'::jsonb),
    COALESCE(NEW.quote_items, '[]'::jsonb),
    COALESCE(NEW.menu_selection, '{}'::jsonb),
    NEW.venue, NEW.location_type, NEW.location_name, NEW.location_street,
    NEW.location_postal_code, NEW.location_city, COALESCE(NEW.location_country,'Deutschland'),
    NEW.company_street, NEW.company_postal_code, NEW.company_city, COALESCE(NEW.company_country,'Deutschland'),
    COALESCE(NEW.billing_address_different,false), NEW.billing_company_name, NEW.billing_street,
    NEW.billing_postal_code, NEW.billing_city, COALESCE(NEW.billing_country,'Deutschland'),
    NEW.delivery_street, NEW.delivery_zip, NEW.delivery_city,
    COALESCE(NEW.priority,'normal')::v2_event_priority,
    COALESCE(NEW.payment_method, 'deposit_online'),
    NEW.invoice_due_days,
    new_event_id
  );

  NEW.id := new_event_id;
  RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION public.event_inquiries_insert_trigger() FROM PUBLIC, anon, authenticated;

-- Trigger-Funktionen nicht direkt aufrufbar (wie 20260501231257 / 20260502080638)
REVOKE EXECUTE ON FUNCTION public.event_bookings_insert_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.catering_orders_insert_trigger() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Direkter INSERT in v2_events: anonyme/Kunden-Policy entfernen (admin/staff: bestehende "manage"-Policies)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert v2_events for active tenant" ON public.v2_events;
DROP POLICY IF EXISTS "Anyone can insert v2_events" ON public.v2_events;

-- Rollback (nur im Notfall, NICHT mitlaufen lassen). Danach ist der alte Checkout wieder lauffähig, aber ungeschützt:
--   GRANT EXECUTE ON FUNCTION public.checkout_create_event_booking(jsonb) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.checkout_create_catering_order(jsonb) TO anon, authenticated;
--   GRANT INSERT ON public.catering_orders TO anon;
--   GRANT INSERT ON public.event_bookings TO anon;
--   CREATE POLICY "Anyone can insert v2_events for active tenant" ON public.v2_events FOR INSERT
--     WITH CHECK (tenant_id IS NULL OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v2_events.tenant_id AND t.status = 'active'));
--   (Die RPCs/Trigger-Funktionen mit order_insert_allowed() vertragen den Rollback: für anon wirft die Prüfung dann weiterhin;
--    für volle Rückkehr die Definitionen aus 20260509180114, 20260515203611 und 20260422220451 erneut einspielen.)
