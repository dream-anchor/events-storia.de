-- 1) View erweitern (Spalten am Ende anfügen)
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
        WHEN 'inquiry' THEN 'new'
        WHEN 'offer_draft' THEN 'contacted'
        WHEN 'offer_sent' THEN 'offer_sent'
        WHEN 'offer_chosen' THEN 'contacted'
        WHEN 'paid' THEN 'confirmed'
        WHEN 'offer_declined' THEN 'declined'
        WHEN 'cancelled' THEN 'cancelled'
        WHEN 'no_response' THEN 'new'
        WHEN 'payment_failed' THEN 'confirmed'
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
    COALESCE((SELECT sum(v2_payments.amount_cents)::numeric / 100.0
              FROM v2_payments
              WHERE v2_payments.event_id = ev.id AND v2_payments.status = 'paid'::v2_payment_status), 0::numeric)::numeric(10,2) AS paid_amount,
    COALESCE(ev.amount_total - ((SELECT sum(v2_payments.amount_cents)::numeric / 100.0
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
    ev.deposit_amount,
    ev.order_confirmed_at,
    ev.order_confirmed_by_name,
    ev.order_confirmed_ip,
    ev.order_confirmed_user_agent,
    ev.order_confirmed_version,
    ev.order_confirmation_terms_version,
    ev.payment_timing,
    ev.deposit_method,
    ev.balance_method,
    ev.balance_due_days_before_event
FROM v2_events ev
LEFT JOIN v2_customers c ON c.id = ev.customer_id
WHERE ev.source_inquiry_id IS NOT NULL AND ev.archived IS NOT TRUE;

-- 2) Update-Trigger erweitern, damit die neuen Felder gespeichert werden.
--    Wir wrappen die bestehende Funktion und schreiben die 3 neuen Spalten
--    zusätzlich nach v2_events durch.
CREATE OR REPLACE FUNCTION public.event_inquiries_update_payment_methods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE v2_events SET
    deposit_method = NEW.deposit_method,
    balance_method = NEW.balance_method,
    balance_due_days_before_event = NEW.balance_due_days_before_event
  WHERE id = OLD.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_event_inquiries_update_payment_methods ON public.event_inquiries;
CREATE TRIGGER tg_event_inquiries_update_payment_methods
INSTEAD OF UPDATE ON public.event_inquiries
FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_update_payment_methods();