
-- ============================================================
-- SCHRITT 1: Legacy-Tabellen umbenennen
-- ============================================================
ALTER TABLE public.event_inquiries RENAME TO _legacy_event_inquiries;
ALTER TABLE public.event_bookings RENAME TO _legacy_event_bookings;
ALTER TABLE public.catering_orders RENAME TO _legacy_catering_orders;
ALTER TABLE public.inquiry_offer_options RENAME TO _legacy_inquiry_offer_options;
ALTER TABLE public.inquiry_offer_history RENAME TO _legacy_inquiry_offer_history;
ALTER TABLE public.inquiry_comments RENAME TO _legacy_inquiry_comments;
ALTER TABLE public.inquiry_tasks RENAME TO _legacy_inquiry_tasks;
ALTER TABLE public.event_payments RENAME TO _legacy_event_payments;
ALTER TABLE public.offer_customer_responses RENAME TO _legacy_offer_customer_responses;
ALTER TABLE public.email_messages RENAME TO _legacy_email_messages;
ALTER TABLE public.customer_profiles RENAME TO _legacy_customer_profiles;

-- ============================================================
-- SCHRITT 2: VIEW event_inquiries
-- ============================================================
CREATE VIEW public.event_inquiries WITH (security_invoker=true) AS
SELECT
  ev.id,
  c.company AS company_name,
  c.name AS contact_name,
  c.email,
  c.phone,
  ev.guest_count::text AS guest_count,
  ev.occasion AS event_type,
  ev.date AS preferred_date,
  ev.customer_notes AS message,
  ev.created_at,
  ev.notification_sent,
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
  (SELECT id FROM v2_offer_options WHERE event_id = ev.id AND is_chosen = true LIMIT 1) AS selected_option_id,
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
  COALESCE((SELECT SUM(amount_cents)/100.0 FROM v2_payments WHERE event_id = ev.id AND status = 'paid'), 0)::numeric(10,2) AS paid_amount,
  COALESCE(ev.amount_total - COALESCE((SELECT SUM(amount_cents)/100.0 FROM v2_payments WHERE event_id = ev.id AND status = 'paid'), 0), ev.amount_total, 0)::numeric(10,2) AS remaining_amount,
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
WHERE ev.archived IS NOT TRUE;

-- ============================================================
-- SCHRITT 3: Trigger für event_inquiries
-- ============================================================
CREATE OR REPLACE FUNCTION public.event_inquiries_update_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v2_status v2_event_status;
BEGIN
  v2_status := CASE NEW.status
    WHEN 'new' THEN 'inquiry'::v2_event_status
    WHEN 'contacted' THEN 'offer_draft'::v2_event_status
    WHEN 'offer_sent' THEN 'offer_sent'::v2_event_status
    WHEN 'confirmed' THEN 'paid'::v2_event_status
    WHEN 'declined' THEN 'offer_declined'::v2_event_status
    WHEN 'cancelled' THEN 'cancelled'::v2_event_status
    WHEN 'completed' THEN 'completed'::v2_event_status
    ELSE NULL
  END;

  UPDATE v2_events SET
    status = COALESCE(v2_status, status),
    internal_notes = NEW.internal_notes,
    customer_notes = NEW.message,
    offer_slug = NEW.offer_slug,
    offer_sent_at = NEW.offer_sent_at,
    offer_sent_by = NEW.offer_sent_by,
    offer_phase = NEW.offer_phase,
    assigned_to = NEW.assigned_to,
    assigned_at = NEW.assigned_at,
    assigned_by = NEW.assigned_by,
    priority = COALESCE(NEW.priority, 'normal')::v2_event_priority,
    archived_at = NEW.archived_at,
    archived_by = NEW.archived_by,
    notification_sent = NEW.notification_sent,
    reminder_count = NEW.reminder_count,
    reminder_sent_at = NEW.reminder_sent_at,
    invoice_lexoffice_id = NEW.lexoffice_invoice_id,
    lexoffice_quotation_id = NEW.lexoffice_quotation_id,
    selected_items = NEW.selected_items,
    selected_packages = NEW.selected_packages,
    quote_items = NEW.quote_items,
    quote_notes = NEW.quote_notes,
    email_draft = NEW.email_draft,
    menu_selection = NEW.menu_selection,
    current_offer_version = NEW.current_offer_version,
    last_edited_by = NEW.last_edited_by,
    last_edited_at = NEW.last_edited_at,
    guest_count = NULLIF(regexp_replace(COALESCE(NEW.guest_count, ''), '[^0-9]', '', 'g'), '')::integer,
    occasion = NEW.event_type,
    date = NEW.preferred_date,
    event_end_date = NEW.event_end_date,
    event_time = NEW.time_slot,
    delivery_street = NEW.delivery_street,
    delivery_zip = NEW.delivery_zip,
    delivery_city = NEW.delivery_city,
    venue = NEW.venue,
    location_type = NEW.location_type,
    location_name = NEW.location_name,
    location_street = NEW.location_street,
    location_postal_code = NEW.location_postal_code,
    location_city = NEW.location_city,
    location_country = NEW.location_country,
    company_street = NEW.company_street,
    company_postal_code = NEW.company_postal_code,
    company_city = NEW.company_city,
    company_country = NEW.company_country,
    billing_address_different = NEW.billing_address_different,
    billing_company_name = NEW.billing_company_name,
    billing_street = NEW.billing_street,
    billing_postal_code = NEW.billing_postal_code,
    billing_city = NEW.billing_city,
    billing_country = NEW.billing_country,
    deposit_percent = NEW.deposit_percent,
    deposit_due_days = NEW.deposit_due_days,
    offer_validity_days = NEW.offer_validity_days,
    payment_type = NEW.payment_type,
    is_test = NEW.is_test,
    updated_at = now()
  WHERE id = OLD.id;

  IF NEW.email IS DISTINCT FROM OLD.email
     OR NEW.contact_name IS DISTINCT FROM OLD.contact_name
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.company_name IS DISTINCT FROM OLD.company_name THEN
    UPDATE v2_customers SET
      email = NEW.email,
      name = NEW.contact_name,
      phone = NEW.phone,
      company = NEW.company_name,
      updated_at = now()
    WHERE id = (SELECT customer_id FROM v2_events WHERE id = OLD.id);
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER tg_event_inquiries_update
  INSTEAD OF UPDATE ON public.event_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_update_trigger();

CREATE OR REPLACE FUNCTION public.event_inquiries_delete_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE v2_events SET archived = true, archived_at = now(), archived_by = 'via_view_delete'
  WHERE id = OLD.id;
  RETURN OLD;
END $$;

CREATE TRIGGER tg_event_inquiries_delete
  INSTEAD OF DELETE ON public.event_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_delete_trigger();

CREATE OR REPLACE FUNCTION public.event_inquiries_insert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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

  INSERT INTO v2_events (
    id, customer_id, status, location, service_type,
    date, event_end_date, event_time, guest_count, occasion,
    customer_notes, internal_notes, source, is_test, notification_sent,
    created_at, updated_at, selected_items, selected_packages, quote_items, menu_selection,
    venue, location_type, location_name, location_street, location_postal_code, location_city, location_country,
    company_street, company_postal_code, company_city, company_country,
    billing_address_different, billing_company_name, billing_street, billing_postal_code, billing_city, billing_country,
    delivery_street, delivery_zip, delivery_city, priority
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), new_customer_id,
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
    COALESCE(NEW.priority,'normal')::v2_event_priority
  ) RETURNING id INTO new_event_id;

  NEW.id := new_event_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_event_inquiries_insert
  INSTEAD OF INSERT ON public.event_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_insert_trigger();

-- ============================================================
-- SCHRITT 4: VIEW event_bookings + Trigger
-- ============================================================
CREATE VIEW public.event_bookings WITH (security_invoker=true) AS
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
    WHEN EXISTS (SELECT 1 FROM v2_payments WHERE event_id = ev.id AND status = 'paid') THEN 'paid'
    WHEN EXISTS (SELECT 1 FROM v2_payments WHERE event_id = ev.id AND status = 'refunded') THEN 'refunded'
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
WHERE (ev.status::text IN ('paid','completed','offer_chosen','cancelled')
       OR ev.source_booking_id IS NOT NULL
       OR ev.booking_number IS NOT NULL)
  AND ev.archived IS NOT TRUE;

CREATE OR REPLACE FUNCTION public.event_bookings_update_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE v2_events SET
    package_id = NEW.package_id,
    guest_count = NEW.guest_count,
    date = NEW.event_date,
    event_time = NEW.event_time,
    location_id = NEW.location_id,
    menu_selection = NEW.menu_selection,
    menu_confirmed = NEW.menu_confirmed,
    menu_confirmed_at = CASE
      WHEN NEW.menu_confirmed = true AND (OLD.menu_confirmed IS NULL OR OLD.menu_confirmed = false)
        THEN now() ELSE menu_confirmed_at END,
    amount_total = NEW.total_amount,
    booking_number = NEW.booking_number,
    internal_notes = NEW.internal_notes,
    invoice_lexoffice_id = NEW.lexoffice_invoice_id,
    lexoffice_document_type = NEW.lexoffice_document_type,
    status = CASE NEW.status
      WHEN 'ready' THEN 'paid'::v2_event_status
      WHEN 'menu_pending' THEN
        CASE WHEN EXISTS(SELECT 1 FROM v2_payments WHERE event_id = OLD.id AND status = 'paid')
          THEN 'paid'::v2_event_status ELSE 'offer_chosen'::v2_event_status END
      WHEN 'completed' THEN 'completed'::v2_event_status
      WHEN 'cancelled' THEN 'cancelled'::v2_event_status
      ELSE status
    END,
    updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_event_bookings_update
  INSTEAD OF UPDATE ON public.event_bookings
  FOR EACH ROW EXECUTE FUNCTION public.event_bookings_update_trigger();

CREATE TRIGGER tg_event_bookings_delete
  INSTEAD OF DELETE ON public.event_bookings
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_delete_trigger();

CREATE OR REPLACE FUNCTION public.event_bookings_insert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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

  INSERT INTO v2_events (
    id, customer_id, status, location, service_type,
    date, event_time, guest_count, amount_total, package_id, location_id,
    booking_number, menu_confirmed, menu_selection,
    invoice_lexoffice_id, lexoffice_document_type, source,
    internal_notes, created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), new_customer_id,
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
    COALESCE(NEW.created_at, now()), now()
  ) RETURNING id INTO new_event_id;

  NEW.id := new_event_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_event_bookings_insert
  INSTEAD OF INSERT ON public.event_bookings
  FOR EACH ROW EXECUTE FUNCTION public.event_bookings_insert_trigger();

-- ============================================================
-- SCHRITT 5: VIEW catering_orders + Trigger
-- ============================================================
CREATE VIEW public.catering_orders WITH (security_invoker=true) AS
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
  (COALESCE(ev.delivery_cost_cents, 0)::numeric / 100) AS delivery_cost,
  (COALESCE(ev.minimum_order_surcharge_cents, 0)::numeric / 100) AS minimum_order_surcharge,
  ev.calculated_distance_km,
  ev.invoice_lexoffice_id AS lexoffice_invoice_id,
  NULL::text AS lexoffice_contact_id,
  'stripe'::text AS payment_method,
  CASE WHEN EXISTS (SELECT 1 FROM v2_payments WHERE event_id = ev.id AND status = 'paid') THEN 'paid' ELSE 'pending' END AS payment_status,
  ev.lexoffice_document_type,
  NULL::uuid AS user_id,
  ev.delivery_street,
  ev.delivery_zip,
  ev.delivery_city,
  ev.delivery_floor,
  ev.has_elevator,
  ev.internal_notes,
  NULL::text AS cancellation_reason,
  NULL::timestamptz AS cancelled_at,
  NULL::text AS lexoffice_credit_note_id,
  (SELECT stripe_payment_intent_id FROM v2_payments WHERE event_id = ev.id ORDER BY created_at DESC LIMIT 1) AS stripe_payment_intent_id,
  NULL::text AS reference_number,
  ev.is_test,
  ev.reminder_sent_at,
  NULL::timestamptz AS last_customer_message_at,
  NULL::timestamptz AS last_our_reply_at
FROM v2_events ev
LEFT JOIN v2_customers c ON c.id = ev.customer_id
WHERE (ev.service_type = 'catering' OR ev.source_catering_id IS NOT NULL)
  AND ev.archived IS NOT TRUE;

CREATE OR REPLACE FUNCTION public.catering_orders_update_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE v2_events SET
    delivery_address = NEW.delivery_address,
    is_pickup = NEW.is_pickup,
    date = NEW.desired_date,
    time_from = NEW.desired_time,
    customer_notes = NEW.notes,
    items = NEW.items,
    amount_total = NEW.total_amount,
    status = CASE NEW.status
      WHEN 'pending' THEN 'inquiry'::v2_event_status
      WHEN 'confirmed' THEN 'offer_chosen'::v2_event_status
      WHEN 'completed' THEN 'completed'::v2_event_status
      WHEN 'cancelled' THEN 'cancelled'::v2_event_status
      ELSE status
    END,
    billing_name = NEW.billing_name,
    billing_street = NEW.billing_street,
    billing_postal_code = NEW.billing_zip,
    billing_city = NEW.billing_city,
    billing_country = NEW.billing_country,
    delivery_cost_cents = (COALESCE(NEW.delivery_cost,0) * 100)::integer,
    minimum_order_surcharge_cents = (COALESCE(NEW.minimum_order_surcharge,0) * 100)::integer,
    calculated_distance_km = NEW.calculated_distance_km,
    invoice_lexoffice_id = NEW.lexoffice_invoice_id,
    lexoffice_document_type = NEW.lexoffice_document_type,
    delivery_street = NEW.delivery_street,
    delivery_zip = NEW.delivery_zip,
    delivery_city = NEW.delivery_city,
    delivery_floor = NEW.delivery_floor,
    has_elevator = NEW.has_elevator,
    internal_notes = NEW.internal_notes,
    is_test = NEW.is_test,
    reminder_sent_at = NEW.reminder_sent_at,
    booking_number = NEW.order_number,
    updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_catering_orders_update
  INSTEAD OF UPDATE ON public.catering_orders
  FOR EACH ROW EXECUTE FUNCTION public.catering_orders_update_trigger();

CREATE TRIGGER tg_catering_orders_delete
  INSTEAD OF DELETE ON public.catering_orders
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_delete_trigger();

CREATE OR REPLACE FUNCTION public.catering_orders_insert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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

  INSERT INTO v2_events (
    id, customer_id, status, location, service_type,
    date, time_from, amount_total, is_test, source,
    internal_notes, customer_notes,
    invoice_lexoffice_id, lexoffice_document_type, items,
    billing_name, billing_street, billing_postal_code, billing_city, billing_country,
    delivery_address, delivery_street, delivery_zip, delivery_city, delivery_floor,
    has_elevator, is_pickup, calculated_distance_km,
    delivery_cost_cents, minimum_order_surcharge_cents, booking_number,
    created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), new_customer_id,
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
    COALESCE(NEW.created_at, now()), now()
  ) RETURNING id INTO new_event_id;

  NEW.id := new_event_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_catering_orders_insert
  INSTEAD OF INSERT ON public.catering_orders
  FOR EACH ROW EXECUTE FUNCTION public.catering_orders_insert_trigger();

-- ============================================================
-- SCHRITT 6: VIEW inquiry_comments + Trigger
-- ============================================================
CREATE VIEW public.inquiry_comments WITH (security_invoker=true) AS
SELECT c.id, c.event_id AS inquiry_id, c.author_email, c.content, c.parent_id, c.created_at, c.updated_at
FROM v2_event_comments c;

CREATE OR REPLACE FUNCTION public.inquiry_comments_insert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO v2_event_comments (id, event_id, author_email, content, parent_id, created_at, updated_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.inquiry_id, NEW.author_email, NEW.content, NEW.parent_id,
          COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
  RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_inquiry_comments_insert INSTEAD OF INSERT ON public.inquiry_comments
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_comments_insert_trigger();

CREATE OR REPLACE FUNCTION public.inquiry_comments_update_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE v2_event_comments SET content = NEW.content, updated_at = now() WHERE id = OLD.id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_inquiry_comments_update INSTEAD OF UPDATE ON public.inquiry_comments
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_comments_update_trigger();

CREATE OR REPLACE FUNCTION public.inquiry_comments_delete_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN DELETE FROM v2_event_comments WHERE id = OLD.id; RETURN OLD; END $$;

CREATE TRIGGER tg_inquiry_comments_delete INSTEAD OF DELETE ON public.inquiry_comments
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_comments_delete_trigger();

-- ============================================================
-- SCHRITT 7: VIEW inquiry_offer_options + Trigger
-- ============================================================
CREATE VIEW public.inquiry_offer_options WITH (security_invoker=true) AS
SELECT
  o.id,
  o.event_id AS inquiry_id,
  o.version AS offer_version,
  o.package_id,
  o.label AS option_label,
  o.guest_count,
  o.menu_selection,
  o.amount_total AS total_amount,
  o.stripe_payment_link_id,
  o.stripe_payment_link_url,
  o.is_active,
  o.sort_order,
  o.created_at,
  o.updated_at,
  o.version AS created_in_version,
  CASE o.offer_mode::text
    WHEN 'alacarte' THEN 'alacarte'
    WHEN 'partial_menu' THEN 'partial_menu'
    WHEN 'full_menu' THEN 'full_menu'
    WHEN 'package' THEN 'paket'
    WHEN 'email' THEN 'email'
    ELSE 'menu'
  END::text AS offer_mode,
  NULL::integer AS selected_quantity
FROM v2_offer_options o;

CREATE OR REPLACE FUNCTION public.inquiry_offer_options_insert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid; v_mode v2_offer_mode;
BEGIN
  v_mode := CASE NEW.offer_mode
    WHEN 'alacarte' THEN 'alacarte'::v2_offer_mode
    WHEN 'a_la_carte' THEN 'alacarte'::v2_offer_mode
    WHEN 'partial_menu' THEN 'partial_menu'::v2_offer_mode
    WHEN 'teil_menu' THEN 'partial_menu'::v2_offer_mode
    WHEN 'full_menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'fest_menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'paket' THEN 'package'::v2_offer_mode
    WHEN 'package' THEN 'package'::v2_offer_mode
    WHEN 'email' THEN 'email'::v2_offer_mode
    ELSE NULL
  END;

  INSERT INTO v2_offer_options (
    id, event_id, label, package_id, offer_mode, menu_selection,
    guest_count, amount_total, version, is_active,
    stripe_payment_link_id, stripe_payment_link_url, sort_order,
    created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), NEW.inquiry_id, COALESCE(NEW.option_label,'A'),
    NEW.package_id, v_mode, NEW.menu_selection,
    NEW.guest_count, NEW.total_amount, COALESCE(NEW.offer_version,1), COALESCE(NEW.is_active,true),
    NEW.stripe_payment_link_id, NEW.stripe_payment_link_url, COALESCE(NEW.sort_order,0),
    COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
  ) RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_inquiry_offer_options_insert INSTEAD OF INSERT ON public.inquiry_offer_options
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_offer_options_insert_trigger();

CREATE OR REPLACE FUNCTION public.inquiry_offer_options_update_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_mode v2_offer_mode;
BEGIN
  v_mode := CASE NEW.offer_mode
    WHEN 'alacarte' THEN 'alacarte'::v2_offer_mode
    WHEN 'a_la_carte' THEN 'alacarte'::v2_offer_mode
    WHEN 'partial_menu' THEN 'partial_menu'::v2_offer_mode
    WHEN 'teil_menu' THEN 'partial_menu'::v2_offer_mode
    WHEN 'full_menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'fest_menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'paket' THEN 'package'::v2_offer_mode
    WHEN 'package' THEN 'package'::v2_offer_mode
    WHEN 'email' THEN 'email'::v2_offer_mode
    ELSE NULL
  END;
  UPDATE v2_offer_options SET
    label = NEW.option_label, package_id = NEW.package_id, offer_mode = v_mode,
    menu_selection = NEW.menu_selection, guest_count = NEW.guest_count,
    amount_total = NEW.total_amount, version = COALESCE(NEW.offer_version,1),
    is_active = NEW.is_active,
    stripe_payment_link_id = NEW.stripe_payment_link_id,
    stripe_payment_link_url = NEW.stripe_payment_link_url,
    sort_order = NEW.sort_order, updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_inquiry_offer_options_update INSTEAD OF UPDATE ON public.inquiry_offer_options
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_offer_options_update_trigger();

CREATE OR REPLACE FUNCTION public.inquiry_offer_options_delete_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN DELETE FROM v2_offer_options WHERE id = OLD.id; RETURN OLD; END $$;

CREATE TRIGGER tg_inquiry_offer_options_delete INSTEAD OF DELETE ON public.inquiry_offer_options
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_offer_options_delete_trigger();

-- ============================================================
-- SCHRITT 8: Read-Only Views + zusätzliche Trigger-Views
-- ============================================================
CREATE VIEW public.inquiry_offer_history WITH (security_invoker=true) AS
SELECT h.id, h.event_id AS inquiry_id, h.version, h.sent_at, h.sent_by,
       h.email_content, h.pdf_url, h.options_snapshot, h.created_at
FROM v2_event_offer_history h;

CREATE VIEW public.inquiry_tasks WITH (security_invoker=true) AS
SELECT t.id, t.event_id AS inquiry_id, t.title, t.description,
       t.due_date, t.assigned_to, t.status::text AS status,
       t.priority::text AS priority, t.completed_at, t.completed_by,
       t.created_by, t.created_at, t.updated_at, t.reminder_sent
FROM v2_event_tasks t;

CREATE OR REPLACE FUNCTION public.inquiry_tasks_insert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO v2_event_tasks (id, event_id, title, description, due_date,
    assigned_to, status, priority, created_by, created_at, updated_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.inquiry_id, NEW.title, NEW.description,
    NEW.due_date, NEW.assigned_to,
    CASE NEW.status WHEN 'pending' THEN 'open'::v2_task_status
                    WHEN 'in_progress' THEN 'in_progress'::v2_task_status
                    WHEN 'done' THEN 'done'::v2_task_status
                    WHEN 'completed' THEN 'done'::v2_task_status
                    WHEN 'cancelled' THEN 'cancelled'::v2_task_status
                    ELSE 'open'::v2_task_status END,
    COALESCE(NEW.priority,'normal')::v2_event_priority,
    NEW.created_by, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
  RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_inquiry_tasks_insert INSTEAD OF INSERT ON public.inquiry_tasks
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_tasks_insert_trigger();

CREATE OR REPLACE FUNCTION public.inquiry_tasks_update_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE v2_event_tasks SET
    title = NEW.title, description = NEW.description, due_date = NEW.due_date,
    assigned_to = NEW.assigned_to,
    status = CASE NEW.status WHEN 'pending' THEN 'open'::v2_task_status
                             WHEN 'in_progress' THEN 'in_progress'::v2_task_status
                             WHEN 'done' THEN 'done'::v2_task_status
                             WHEN 'completed' THEN 'done'::v2_task_status
                             WHEN 'cancelled' THEN 'cancelled'::v2_task_status
                             ELSE 'open'::v2_task_status END,
    priority = COALESCE(NEW.priority,'normal')::v2_event_priority,
    completed_at = NEW.completed_at, completed_by = NEW.completed_by,
    reminder_sent = NEW.reminder_sent, updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_inquiry_tasks_update INSTEAD OF UPDATE ON public.inquiry_tasks
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_tasks_update_trigger();

CREATE OR REPLACE FUNCTION public.inquiry_tasks_delete_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN DELETE FROM v2_event_tasks WHERE id = OLD.id; RETURN OLD; END $$;

CREATE TRIGGER tg_inquiry_tasks_delete INSTEAD OF DELETE ON public.inquiry_tasks
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_tasks_delete_trigger();

CREATE VIEW public.email_messages WITH (security_invoker=true) AS
SELECT em.id, em.event_id AS inquiry_id, em.direction::text AS direction,
       em.from_email, em.to_email, em.subject, em.body_text, em.body_html,
       em.attachments, em.resend_message_id, em.resend_status, em.in_reply_to,
       em.created_at
FROM v2_event_emails em;

CREATE VIEW public.event_payments WITH (security_invoker=true) AS
SELECT p.id, p.event_id AS inquiry_id, p.payment_type::text AS payment_type,
       p.amount_cents, p.due_date, p.due_days_before_event,
       p.status::text AS status,
       p.stripe_checkout_session_id, p.stripe_payment_intent_id, p.stripe_payment_link_url,
       p.paid_at, p.paid_via, p.lexoffice_invoice_id, p.lexoffice_invoice_number,
       p.email_sent_at, p.email_resend_id, p.reminder_sent_at, p.notes,
       p.created_by, p.created_at, p.updated_at
FROM v2_payments p;

CREATE VIEW public.offer_customer_responses WITH (security_invoker=true) AS
SELECT o.id, o.event_id AS inquiry_id, o.id AS selected_option_id,
       o.chosen_notes AS customer_notes, o.chosen_at AS responded_at,
       NULL::text AS ip_address, NULL::text AS user_agent,
       o.chosen_at AS created_at
FROM v2_offer_options o
WHERE o.is_chosen = true;

CREATE OR REPLACE FUNCTION public.offer_customer_responses_insert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE v2_offer_options SET
    is_chosen = true,
    chosen_at = COALESCE(NEW.responded_at, now()),
    chosen_notes = NEW.customer_notes
  WHERE id = NEW.selected_option_id;

  UPDATE v2_offer_options SET is_active = false
  WHERE event_id = (SELECT event_id FROM v2_offer_options WHERE id = NEW.selected_option_id)
    AND id != NEW.selected_option_id;

  NEW.id := NEW.selected_option_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_offer_customer_responses_insert INSTEAD OF INSERT ON public.offer_customer_responses
  FOR EACH ROW EXECUTE FUNCTION public.offer_customer_responses_insert_trigger();

CREATE VIEW public.customer_profiles WITH (security_invoker=true) AS
SELECT c.id, c.auth_user_id AS user_id, c.name, c.email, c.phone, c.company,
       c.address_street AS delivery_street, c.address_city AS delivery_city,
       c.address_zip AS delivery_zip, 'Deutschland'::text AS delivery_country,
       NULL::text AS billing_name, NULL::text AS billing_street, NULL::text AS billing_city,
       NULL::text AS billing_zip, 'Deutschland'::text AS billing_country,
       c.created_at, c.updated_at,
       NULL::text AS delivery_floor, false AS has_elevator
FROM v2_customers c
WHERE c.auth_user_id IS NOT NULL;

-- ============================================================
-- SCHRITT 9: GRANTS
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.event_inquiries, public.event_bookings,
  public.catering_orders, public.inquiry_comments,
  public.inquiry_offer_options, public.inquiry_offer_history,
  public.inquiry_tasks, public.event_payments,
  public.offer_customer_responses, public.email_messages,
  public.customer_profiles
  TO authenticated, anon, service_role;
