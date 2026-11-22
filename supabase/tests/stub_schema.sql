-- Stub-Schema für die SQL-Tests der Bestell-Abdichtung (order_price_guard.sql, order_checkout_seal.sql).
-- NUR für eine Wegwerf-Datenbank (PGlite oder leere Postgres-Instanz), NIE gegen Supabase/Produktion.
-- Bildet nach, was die Migrationen 20261122100000 und 20261122110000 brauchen: Rollen, auth.role()/uid(), has_role(),
-- Katalog-Tabellen, v2_events (mit RLS und der alten anon-Policy), die Views catering_orders/event_bookings samt
-- Insert-Triggern und RPCs im Zustand VOR der Abdichtung (wie 20260422220451, 20260509180114, 20260515203611, 20260703120000).
-- Ablauf: stub_schema.sql -> 20261122100000_order_price_guard.sql -> order_price_guard.sql -> 20261122110000_order_checkout_seal.sql -> order_checkout_seal.sql
-- (Runner: supabase/tests/run-sql-tests.mjs)

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
-- JWT-Simulation: die Tests setzen request.jwt.claims bzw. request.jwt.claim.role / .sub
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
                  NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
                         NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.role(), auth.uid() TO anon, authenticated, service_role;

CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');
CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Katalog
CREATE TABLE public.menus (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), menu_type text, slug text, is_published boolean DEFAULT false, tenant_id uuid);
CREATE TABLE public.menu_categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), menu_id uuid, name text, deleted_at timestamptz, archived_at timestamptz, tenant_id uuid);
CREATE TABLE public.menu_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid, name text, name_en text, price numeric, deleted_at timestamptz, archived_at timestamptz, tenant_id uuid);
CREATE TABLE public.packages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, name_en text, price numeric NOT NULL, price_per_person boolean, is_active boolean DEFAULT true, min_guests integer, max_guests integer, tenant_id uuid);

-- v2
CREATE TYPE public.v2_event_status AS ENUM ('inquiry', 'offer_draft', 'offer_sent', 'offer_chosen', 'paid', 'offer_declined', 'completed', 'cancelled');
CREATE TYPE public.v2_event_location AS ENUM ('in_house', 'external');
CREATE TYPE public.v2_event_service AS ENUM ('restaurant', 'catering');
CREATE TYPE public.v2_event_source AS ENUM ('manual', 'catering_form', 'website', 'email_inbound', 'phone');
CREATE TYPE public.v2_event_priority AS ENUM ('low', 'normal', 'high');
CREATE TYPE public.v2_payment_status AS ENUM ('draft', 'paid', 'refunded', 'failed');
CREATE TYPE public.v2_payment_type AS ENUM ('full', 'deposit');
CREATE TABLE public.tenants (id uuid PRIMARY KEY, status text);
CREATE TABLE public.v2_customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text, phone text, company text,
  address_street text, address_zip text, address_city text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.v2_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid, status public.v2_event_status NOT NULL DEFAULT 'inquiry',
  location public.v2_event_location, service_type public.v2_event_service, date date, event_time text, time_from time,
  guest_count integer, amount_total numeric, package_id uuid, location_id uuid, booking_number text, menu_confirmed boolean DEFAULT false,
  menu_selection jsonb, invoice_lexoffice_id text, lexoffice_document_type text, source public.v2_event_source,
  internal_notes text, customer_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  source_booking_id uuid UNIQUE, source_catering_id uuid UNIQUE, source_inquiry_id uuid, is_test boolean DEFAULT false, items jsonb,
  billing_name text, billing_street text, billing_postal_code text, billing_city text, billing_country text,
  delivery_address text, delivery_street text, delivery_zip text, delivery_city text, delivery_floor text,
  has_elevator boolean, is_pickup boolean, calculated_distance_km numeric, delivery_cost_cents integer,
  minimum_order_surcharge_cents integer, tenant_id uuid,
  occasion text, event_end_date date, notification_sent boolean, selected_items jsonb, selected_packages jsonb, quote_items jsonb,
  venue text, location_type text, location_name text, location_street text, location_postal_code text, location_city text, location_country text,
  company_street text, company_postal_code text, company_city text, company_country text, billing_address_different boolean,
  billing_company_name text, priority public.v2_event_priority, payment_method text, invoice_due_days integer);
CREATE TABLE public.v2_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.v2_events(id),
  amount_cents integer, payment_type public.v2_payment_type, status public.v2_payment_status DEFAULT 'draft');

-- RLS wie im Original: admin/staff "manage", plus die zu offene Insert-Policy (20260703120000)
ALTER TABLE public.v2_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage v2_events" ON public.v2_events TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can manage v2_events" ON public.v2_events TO authenticated
  USING (public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Anyone can insert v2_events for active tenant" ON public.v2_events FOR INSERT
  WITH CHECK (tenant_id IS NULL OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v2_events.tenant_id AND t.status = 'active'));
GRANT ALL ON public.v2_events, public.v2_customers, public.v2_payments TO anon, authenticated, service_role;
GRANT SELECT ON public.menus, public.menu_categories, public.menu_items, public.packages, public.user_roles, public.tenants TO anon, authenticated, service_role;

-- Views (vereinfacht, gleiche Spalten wie benötigt)
CREATE VIEW public.event_bookings AS
SELECT ev.id, ev.booking_number, c.email AS customer_email, c.name AS customer_name, c.company AS company_name, c.phone,
  ev.package_id, ev.guest_count, ev.date AS event_date, ev.event_time, ev.location_id, ev.menu_selection, ev.menu_confirmed,
  ev.amount_total AS total_amount,
  CASE WHEN EXISTS (SELECT 1 FROM public.v2_payments p WHERE p.event_id = ev.id AND p.status = 'paid') THEN 'paid' ELSE 'pending' END AS payment_status,
  CASE ev.status::text WHEN 'paid' THEN CASE WHEN ev.menu_confirmed THEN 'ready' ELSE 'menu_pending' END
    WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' ELSE 'menu_pending' END AS status,
  ev.internal_notes, ev.created_at, ev.updated_at, ev.invoice_lexoffice_id AS lexoffice_invoice_id, ev.lexoffice_document_type
FROM public.v2_events ev LEFT JOIN public.v2_customers c ON c.id = ev.customer_id
WHERE ev.source_booking_id IS NOT NULL;

CREATE VIEW public.catering_orders AS
SELECT ev.id, ev.booking_number AS order_number, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
  c.company AS company_name, ev.delivery_address, ev.is_pickup, ev.date AS desired_date, ev.time_from AS desired_time,
  ev.customer_notes AS notes, ev.items, ev.amount_total AS total_amount,
  CASE ev.status::text WHEN 'inquiry' THEN 'pending' WHEN 'offer_chosen' THEN 'confirmed' WHEN 'paid' THEN 'confirmed'
    WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' ELSE 'pending' END AS status,
  ev.created_at, ev.billing_name, ev.billing_street, ev.billing_postal_code AS billing_zip, ev.billing_city, ev.billing_country,
  (COALESCE(ev.delivery_cost_cents, 0)::numeric / 100) AS delivery_cost,
  (COALESCE(ev.minimum_order_surcharge_cents, 0)::numeric / 100) AS minimum_order_surcharge,
  ev.calculated_distance_km, ev.invoice_lexoffice_id AS lexoffice_invoice_id, 'stripe'::text AS payment_method,
  CASE WHEN EXISTS (SELECT 1 FROM public.v2_payments p WHERE p.event_id = ev.id AND p.status = 'paid') THEN 'paid' ELSE 'pending' END AS payment_status,
  ev.lexoffice_document_type, NULL::uuid AS user_id, ev.delivery_street, ev.delivery_zip, ev.delivery_city, ev.delivery_floor,
  ev.has_elevator, ev.internal_notes, NULL::text AS reference_number, ev.is_test
FROM public.v2_events ev LEFT JOIN public.v2_customers c ON c.id = ev.customer_id
WHERE ev.source_catering_id IS NOT NULL;
GRANT ALL ON public.event_bookings, public.catering_orders TO anon, authenticated, service_role;

-- Insert-Trigger im Zustand VOR der Abdichtung (20260422220451, Schritte 3b/4b)
CREATE FUNCTION public.event_bookings_insert_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE new_customer_id uuid; new_event_id uuid;
BEGIN
  SELECT id INTO new_customer_id FROM v2_customers WHERE lower(email) = lower(NEW.customer_email) AND lower(COALESCE(name,'')) = lower(COALESCE(NEW.customer_name,'')) LIMIT 1;
  IF new_customer_id IS NULL THEN
    INSERT INTO v2_customers (name, email, phone, company) VALUES (NEW.customer_name, NEW.customer_email, NEW.phone, NEW.company_name) RETURNING id INTO new_customer_id;
  END IF;
  new_event_id := COALESCE(NEW.id, gen_random_uuid());
  INSERT INTO v2_events (id, customer_id, status, location, service_type, date, event_time, guest_count, amount_total, package_id, location_id,
    booking_number, menu_confirmed, menu_selection, invoice_lexoffice_id, lexoffice_document_type, source, internal_notes, created_at, updated_at, source_booking_id)
  VALUES (new_event_id, new_customer_id,
    CASE NEW.status WHEN 'ready' THEN 'paid'::v2_event_status WHEN 'menu_pending' THEN 'offer_chosen'::v2_event_status
      WHEN 'completed' THEN 'completed'::v2_event_status WHEN 'cancelled' THEN 'cancelled'::v2_event_status ELSE 'paid'::v2_event_status END,
    'in_house'::v2_event_location, 'restaurant'::v2_event_service, NEW.event_date, NEW.event_time, NEW.guest_count, NEW.total_amount,
    NEW.package_id, NEW.location_id, NEW.booking_number, COALESCE(NEW.menu_confirmed,false), NEW.menu_selection,
    NEW.lexoffice_invoice_id, NEW.lexoffice_document_type, 'manual'::v2_event_source, NEW.internal_notes, COALESCE(NEW.created_at, now()), now(), new_event_id);
  NEW.id := new_event_id;
  RETURN NEW;
END $f$;
CREATE TRIGGER tg_event_bookings_insert INSTEAD OF INSERT ON public.event_bookings FOR EACH ROW EXECUTE FUNCTION public.event_bookings_insert_trigger();

CREATE FUNCTION public.catering_orders_insert_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE new_customer_id uuid; new_event_id uuid;
BEGIN
  SELECT id INTO new_customer_id FROM v2_customers WHERE lower(email) = lower(NEW.customer_email) AND lower(COALESCE(name,'')) = lower(COALESCE(NEW.customer_name,'')) LIMIT 1;
  IF new_customer_id IS NULL THEN
    INSERT INTO v2_customers (name, email, phone, company, address_street, address_zip, address_city)
    VALUES (NEW.customer_name, NEW.customer_email, NEW.customer_phone, NEW.company_name, NEW.delivery_street, NEW.delivery_zip, NEW.delivery_city) RETURNING id INTO new_customer_id;
  END IF;
  new_event_id := COALESCE(NEW.id, gen_random_uuid());
  INSERT INTO v2_events (id, customer_id, status, location, service_type, date, time_from, amount_total, is_test, source, internal_notes, customer_notes,
    invoice_lexoffice_id, lexoffice_document_type, items, billing_name, billing_street, billing_postal_code, billing_city, billing_country,
    delivery_address, delivery_street, delivery_zip, delivery_city, delivery_floor, has_elevator, is_pickup, calculated_distance_km,
    delivery_cost_cents, minimum_order_surcharge_cents, booking_number, created_at, updated_at, source_catering_id)
  VALUES (new_event_id, new_customer_id,
    CASE COALESCE(NEW.status,'pending') WHEN 'pending' THEN 'inquiry'::v2_event_status WHEN 'confirmed' THEN 'offer_chosen'::v2_event_status
      WHEN 'completed' THEN 'completed'::v2_event_status WHEN 'cancelled' THEN 'cancelled'::v2_event_status ELSE 'inquiry'::v2_event_status END,
    'external'::v2_event_location, 'catering'::v2_event_service, NEW.desired_date, NEW.desired_time, NEW.total_amount,
    COALESCE(NEW.is_test,false), 'catering_form'::v2_event_source, NEW.internal_notes, NEW.notes,
    NEW.lexoffice_invoice_id, NEW.lexoffice_document_type, NEW.items, NEW.billing_name, NEW.billing_street, NEW.billing_zip, NEW.billing_city,
    COALESCE(NEW.billing_country,'Deutschland'), NEW.delivery_address, NEW.delivery_street, NEW.delivery_zip, NEW.delivery_city,
    NEW.delivery_floor, COALESCE(NEW.has_elevator,false), COALESCE(NEW.is_pickup,false), NEW.calculated_distance_km,
    (COALESCE(NEW.delivery_cost,0) * 100)::integer, (COALESCE(NEW.minimum_order_surcharge,0) * 100)::integer, NEW.order_number,
    COALESCE(NEW.created_at, now()), now(), new_event_id);
  NEW.id := new_event_id;
  RETURN NEW;
END $f$;
CREATE TRIGGER tg_catering_orders_insert INSTEAD OF INSERT ON public.catering_orders FOR EACH ROW EXECUTE FUNCTION public.catering_orders_insert_trigger();

-- RPCs im Zustand VOR der Abdichtung (20260509180114 / 20260515203611): anon + authenticated, Status aus der Nutzlast
CREATE FUNCTION public.checkout_create_event_booking(payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_id uuid := COALESCE((payload->>'id')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.event_bookings (id, booking_number, customer_name, customer_email, phone, company_name, event_date, event_time, guest_count,
    package_id, total_amount, payment_status, status, internal_notes, menu_selection)
  VALUES (v_id, payload->>'booking_number', payload->>'customer_name', payload->>'customer_email', payload->>'phone', payload->>'company_name',
    (payload->>'event_date')::date, payload->>'event_time', NULLIF(payload->>'guest_count','')::integer, NULLIF(payload->>'package_id','')::uuid,
    NULLIF(payload->>'total_amount','')::numeric, COALESCE(payload->>'payment_status','pending'), COALESCE(payload->>'status','confirmed'),
    payload->>'internal_notes', NULLIF(payload->'menu_selection','null'));
  RETURN v_id;
END $f$;
CREATE FUNCTION public.checkout_create_catering_order(payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_id uuid := COALESCE((payload->>'id')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.catering_orders (id, order_number, customer_name, customer_email, customer_phone, company_name, delivery_street, delivery_zip, delivery_city,
    delivery_floor, has_elevator, delivery_address, is_pickup, desired_date, desired_time, notes, items, total_amount, billing_name, billing_street, billing_zip,
    billing_city, billing_country, delivery_cost, minimum_order_surcharge, calculated_distance_km, payment_method, payment_status, user_id, reference_number)
  VALUES (v_id, payload->>'order_number', payload->>'customer_name', payload->>'customer_email', payload->>'customer_phone', payload->>'company_name',
    payload->>'delivery_street', payload->>'delivery_zip', payload->>'delivery_city', payload->>'delivery_floor', COALESCE((payload->>'has_elevator')::boolean,false),
    payload->>'delivery_address', COALESCE((payload->>'is_pickup')::boolean,false), NULLIF(payload->>'desired_date','')::date, NULLIF(payload->>'desired_time','')::time,
    payload->>'notes', COALESCE(payload->'items','[]'::jsonb), NULLIF(payload->>'total_amount','')::numeric, payload->>'billing_name', payload->>'billing_street',
    payload->>'billing_zip', payload->>'billing_city', payload->>'billing_country', NULLIF(payload->>'delivery_cost','')::numeric,
    NULLIF(payload->>'minimum_order_surcharge','')::numeric, NULLIF(payload->>'calculated_distance_km','')::numeric, payload->>'payment_method',
    COALESCE(payload->>'payment_status','pending'), NULLIF(payload->>'user_id','')::uuid, payload->>'reference_number');
  RETURN v_id;
END $f$;
GRANT EXECUTE ON FUNCTION public.checkout_create_event_booking(jsonb), public.checkout_create_catering_order(jsonb) TO anon, authenticated, service_role;

-- View event_inquiries (vereinfacht) + Insert-Trigger im Zustand VOR der Abdichtung (20260501200216)
CREATE VIEW public.event_inquiries AS
SELECT ev.id, c.email, c.name AS contact_name, c.phone, c.company AS company_name, 'event'::text AS inquiry_type, ev.source::text AS source,
  CASE ev.status::text WHEN 'inquiry' THEN 'new' WHEN 'paid' THEN 'confirmed' ELSE ev.status::text END AS status,
  ev.date AS preferred_date, ev.event_end_date, ev.event_time AS time_slot, ev.guest_count::text AS guest_count, ev.occasion AS event_type,
  ev.customer_notes AS message, ev.internal_notes, ev.is_test, ev.notification_sent, ev.created_at, ev.selected_items, ev.selected_packages,
  ev.quote_items, ev.menu_selection, ev.venue, ev.location_type, ev.location_name, ev.location_street, ev.location_postal_code,
  ev.location_city, ev.location_country, ev.company_street, ev.company_postal_code, ev.company_city, ev.company_country,
  ev.billing_address_different, ev.billing_company_name, ev.billing_street, ev.billing_postal_code, ev.billing_city, ev.billing_country,
  ev.delivery_street, ev.delivery_zip, ev.delivery_city, ev.priority::text AS priority, ev.payment_method, ev.invoice_due_days
FROM public.v2_events ev LEFT JOIN public.v2_customers c ON c.id = ev.customer_id
WHERE ev.source_inquiry_id IS NOT NULL;
GRANT ALL ON public.event_inquiries TO anon, authenticated, service_role;
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
CREATE TRIGGER tg_event_inquiries_insert INSTEAD OF INSERT ON public.event_inquiries FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_insert_trigger();
