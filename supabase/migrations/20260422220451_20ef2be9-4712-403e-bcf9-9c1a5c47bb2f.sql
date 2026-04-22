
-- =========================================================================
-- VIEW-FILTER-FIX: event_inquiries / event_bookings / catering_orders
-- Strikter Filter nach source_*_id, plus Self-Reference-Patch in Triggern
-- =========================================================================

-- ============== SCHRITT 1: event_inquiries-View neu ==============
DROP VIEW IF EXISTS public.event_inquiries CASCADE;

CREATE VIEW public.event_inquiries
WITH (security_invoker=true) AS
SELECT
  ev.id AS id,
  c.company AS company_name,
  c.name AS contact_name,
  c.email AS email,
  c.phone AS phone,
  ev.guest_count::text AS guest_count,
  ev.occasion AS event_type,
  ev.date AS preferred_date,
  ev.customer_notes AS message,
  ev.created_at AS created_at,
  ev.notification_sent AS notification_sent,
  ev.source::text AS source,
  CASE ev.status::text
    WHEN 'inquiry' THEN 'new'
    WHEN 'offer_draft' THEN 'contacted'
    WHEN 'offer_sent' THEN 'offer_sent'
    WHEN 'offer_chosen' THEN 'contacted'
    WHEN 'paid' THEN 'confirmed'
    WHEN 'completed' THEN 'completed'
    WHEN 'offer_declined' THEN 'declined'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'no_response' THEN 'new'
    WHEN 'payment_failed' THEN 'confirmed'
    ELSE ev.status::text
  END AS status,
  ev.internal_notes,
  ev.updated_at,
  CASE
    WHEN ev.service_type = 'catering' THEN 'catering'::inquiry_type
    ELSE 'event'::inquiry_type
  END AS inquiry_type,
  NULL::text AS room_selection,
  ev.event_time AS time_slot,
  ev.delivery_street,
  ev.delivery_zip,
  ev.delivery_city,
  NULL::text AS delivery_time_slot,
  ev.selected_items,
  ev.selected_packages,
  ev.quote_items,
  ev.quote_notes,
  ev.email_draft,
  ev.lexoffice_quotation_id,
  ev.menu_selection,
  ev.current_offer_version,
  NULL::uuid AS selected_option_id,
  NULL::uuid AS converted_to_booking_id,
  ev.last_edited_by,
  ev.last_edited_at,
  ev.offer_sent_at,
  ev.offer_sent_by,
  ev.reminder_count,
  ev.reminder_sent_at,
  ev.assigned_to,
  ev.assigned_at,
  ev.assigned_by,
  ev.priority::text AS priority,
  ev.archived_at,
  ev.archived_by,
  ev.offer_phase,
  ev.offer_slug,
  ev.invoice_lexoffice_id AS lexoffice_invoice_id,
  ev.payment_type,
  ev.deposit_percent,
  COALESCE((SELECT SUM(amount_cents)/100.0 FROM v2_payments
            WHERE event_id = ev.id AND status = 'paid'), 0)::numeric(10,2)
    AS paid_amount,
  COALESCE(ev.amount_total - (SELECT SUM(amount_cents)/100.0 FROM v2_payments
                              WHERE event_id = ev.id AND status = 'paid'),
           ev.amount_total, 0)::numeric(10,2) AS remaining_amount,
  ev.event_end_date,
  ev.is_test,
  ev.venue,
  ev.location_type,
  ev.location_name,
  ev.location_street,
  ev.location_postal_code,
  ev.location_city,
  ev.location_country,
  ev.company_street,
  ev.company_postal_code,
  ev.company_city,
  ev.company_country,
  ev.billing_address_different,
  ev.billing_company_name,
  ev.billing_street,
  ev.billing_postal_code,
  ev.billing_city,
  ev.billing_country,
  ev.deposit_due_days,
  ev.offer_validity_days
FROM v2_events ev
LEFT JOIN v2_customers c ON c.id = ev.customer_id
WHERE ev.source_inquiry_id IS NOT NULL
  AND ev.archived IS NOT TRUE;

CREATE TRIGGER tg_event_inquiries_insert
  INSTEAD OF INSERT ON public.event_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_insert_trigger();
CREATE TRIGGER tg_event_inquiries_update
  INSTEAD OF UPDATE ON public.event_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_update_trigger();
CREATE TRIGGER tg_event_inquiries_delete
  INSTEAD OF DELETE ON public.event_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_delete_trigger();


-- ============== SCHRITT 2: event_inquiries_insert_trigger Patch ==============
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
    new_event_id   -- self-reference
  );

  NEW.id := new_event_id;
  RETURN NEW;
END $function$;


-- ============== SCHRITT 3: event_bookings-View neu ==============
DROP VIEW IF EXISTS public.event_bookings CASCADE;

CREATE VIEW public.event_bookings
WITH (security_invoker=true) AS
SELECT
  ev.id,
  ev.booking_number,
  c.email AS customer_email,
  c.name AS customer_name,
  c.company AS company_name,
  c.phone,
  ev.package_id,
  ev.guest_count,
  ev.date AS event_date,
  ev.event_time,
  ev.location_id,
  ev.menu_selection,
  ev.menu_confirmed,
  ev.amount_total AS total_amount,
  CASE
    WHEN EXISTS (SELECT 1 FROM v2_payments WHERE event_id = ev.id AND status = 'paid'::v2_payment_status) THEN 'paid'
    WHEN EXISTS (SELECT 1 FROM v2_payments WHERE event_id = ev.id AND status = 'refunded'::v2_payment_status) THEN 'refunded'
    ELSE 'pending'
  END AS payment_status,
  (SELECT stripe_payment_intent_id FROM v2_payments WHERE event_id = ev.id ORDER BY created_at DESC LIMIT 1) AS stripe_payment_intent_id,
  NULL::text AS stripe_payment_link_id,
  CASE ev.status::text
    WHEN 'paid' THEN CASE WHEN ev.menu_confirmed THEN 'ready' ELSE 'menu_pending' END
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'offer_chosen' THEN 'menu_pending'
    ELSE 'menu_pending'
  END AS status,
  ev.internal_notes,
  ev.source_inquiry_id,
  (SELECT id FROM v2_offer_options WHERE event_id = ev.id AND is_chosen = true LIMIT 1) AS source_option_id,
  ev.created_at,
  ev.updated_at,
  ev.invoice_lexoffice_id AS lexoffice_invoice_id,
  ev.lexoffice_document_type,
  NULL::text AS lexoffice_contact_id
FROM v2_events ev
LEFT JOIN v2_customers c ON c.id = ev.customer_id
WHERE ev.source_booking_id IS NOT NULL
  AND ev.archived IS NOT TRUE;

CREATE TRIGGER tg_event_bookings_insert
  INSTEAD OF INSERT ON public.event_bookings
  FOR EACH ROW EXECUTE FUNCTION public.event_bookings_insert_trigger();
CREATE TRIGGER tg_event_bookings_update
  INSTEAD OF UPDATE ON public.event_bookings
  FOR EACH ROW EXECUTE FUNCTION public.event_bookings_update_trigger();


-- ============== SCHRITT 3b: event_bookings_insert_trigger Patch ==============
CREATE OR REPLACE FUNCTION public.event_bookings_insert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_customer_id uuid; new_event_id uuid;
BEGIN
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
      ELSE 'paid'::v2_event_status
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


-- ============== SCHRITT 4: catering_orders-View neu ==============
DROP VIEW IF EXISTS public.catering_orders CASCADE;

CREATE VIEW public.catering_orders
WITH (security_invoker=true) AS
SELECT
  ev.id,
  ev.booking_number AS order_number,
  c.name AS customer_name,
  c.email AS customer_email,
  c.phone AS customer_phone,
  c.company AS company_name,
  ev.delivery_address,
  ev.is_pickup,
  ev.date AS desired_date,
  ev.time_from AS desired_time,
  ev.customer_notes AS notes,
  ev.items,
  ev.amount_total AS total_amount,
  CASE ev.status::text
    WHEN 'inquiry' THEN 'pending'
    WHEN 'offer_chosen' THEN 'confirmed'
    WHEN 'paid' THEN 'confirmed'
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'pending'
  END AS status,
  ev.created_at,
  ev.billing_name,
  ev.billing_street,
  ev.billing_postal_code AS billing_zip,
  ev.billing_city,
  ev.billing_country,
  (COALESCE(ev.delivery_cost_cents, 0)::numeric / 100::numeric) AS delivery_cost,
  (COALESCE(ev.minimum_order_surcharge_cents, 0)::numeric / 100::numeric) AS minimum_order_surcharge,
  ev.calculated_distance_km,
  ev.invoice_lexoffice_id AS lexoffice_invoice_id,
  NULL::text AS lexoffice_contact_id,
  'stripe'::text AS payment_method,
  CASE
    WHEN EXISTS (SELECT 1 FROM v2_payments WHERE event_id = ev.id AND status = 'paid'::v2_payment_status) THEN 'paid'
    ELSE 'pending'
  END AS payment_status,
  ev.lexoffice_document_type,
  NULL::uuid AS user_id,
  ev.delivery_street,
  ev.delivery_zip,
  ev.delivery_city,
  ev.delivery_floor,
  ev.has_elevator,
  ev.internal_notes,
  NULL::text AS cancellation_reason,
  NULL::timestamp with time zone AS cancelled_at,
  NULL::text AS lexoffice_credit_note_id,
  (SELECT stripe_payment_intent_id FROM v2_payments WHERE event_id = ev.id ORDER BY created_at DESC LIMIT 1) AS stripe_payment_intent_id,
  NULL::text AS reference_number,
  ev.is_test,
  ev.reminder_sent_at,
  NULL::timestamp with time zone AS last_customer_message_at,
  NULL::timestamp with time zone AS last_our_reply_at
FROM v2_events ev
LEFT JOIN v2_customers c ON c.id = ev.customer_id
WHERE ev.source_catering_id IS NOT NULL
  AND ev.archived IS NOT TRUE;

CREATE TRIGGER tg_catering_orders_insert
  INSTEAD OF INSERT ON public.catering_orders
  FOR EACH ROW EXECUTE FUNCTION public.catering_orders_insert_trigger();
CREATE TRIGGER tg_catering_orders_update
  INSTEAD OF UPDATE ON public.catering_orders
  FOR EACH ROW EXECUTE FUNCTION public.catering_orders_update_trigger();


-- ============== SCHRITT 4b: catering_orders_insert_trigger Patch ==============
CREATE OR REPLACE FUNCTION public.catering_orders_insert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_customer_id uuid; new_event_id uuid;
BEGIN
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
