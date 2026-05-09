
-- 1. Add deposit_amount column on the underlying table
ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2);

-- 2. Recreate the event_inquiries view to expose the new column
CREATE OR REPLACE VIEW public.event_inquiries AS
 SELECT ev.id,
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
        WHEN 'inquiry'::text THEN 'new'::text
        WHEN 'offer_draft'::text THEN 'contacted'::text
        WHEN 'offer_sent'::text THEN 'offer_sent'::text
        WHEN 'offer_chosen'::text THEN 'contacted'::text
        WHEN 'paid'::text THEN 'confirmed'::text
        WHEN 'completed'::text THEN 'completed'::text
        WHEN 'offer_declined'::text THEN 'declined'::text
        WHEN 'cancelled'::text THEN 'cancelled'::text
        WHEN 'no_response'::text THEN 'new'::text
        WHEN 'payment_failed'::text THEN 'confirmed'::text
        ELSE ev.status::text
    END AS status,
    ev.internal_notes,
    ev.updated_at,
    CASE
        WHEN ev.service_type = 'catering'::v2_event_service THEN 'catering'::inquiry_type
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
    COALESCE(( SELECT sum(v2_payments.amount_cents)::numeric / 100.0
           FROM v2_payments
          WHERE v2_payments.event_id = ev.id AND v2_payments.status = 'paid'::v2_payment_status), 0::numeric)::numeric(10,2) AS paid_amount,
    COALESCE(ev.amount_total - (( SELECT sum(v2_payments.amount_cents)::numeric / 100.0
           FROM v2_payments
          WHERE v2_payments.event_id = ev.id AND v2_payments.status = 'paid'::v2_payment_status)), ev.amount_total, 0::numeric)::numeric(10,2) AS remaining_amount,
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
    ev.offer_validity_days,
    ev.payment_method,
    ev.invoice_due_days,
    ev.deposit_amount
   FROM v2_events ev
     LEFT JOIN v2_customers c ON c.id = ev.customer_id
  WHERE ev.source_inquiry_id IS NOT NULL AND ev.archived IS NOT TRUE;

-- 3. Update the INSTEAD OF UPDATE trigger to forward deposit_amount
CREATE OR REPLACE FUNCTION public.event_inquiries_update_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    deposit_amount = NEW.deposit_amount,
    deposit_due_days = NEW.deposit_due_days,
    offer_validity_days = NEW.offer_validity_days,
    payment_type = NEW.payment_type,
    payment_method = NEW.payment_method,
    invoice_due_days = NEW.invoice_due_days,
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
END $function$;
