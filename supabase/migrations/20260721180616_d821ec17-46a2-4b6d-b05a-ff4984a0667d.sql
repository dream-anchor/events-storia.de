-- Expose cost_acceptance_requested to admin view and public-offer RPC
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
    COALESCE(NULLIF(ev.company_street, ''::text), c.address_street) AS company_street,
    COALESCE(NULLIF(ev.company_postal_code, ''::text), c.address_zip) AS company_postal_code,
    COALESCE(NULLIF(ev.company_city, ''::text), c.address_city) AS company_city,
    ev.company_country,
    ev.billing_address_different,
    ev.billing_company_name,
    COALESCE(NULLIF(ev.billing_street, ''::text), c.address_street) AS billing_street,
    COALESCE(NULLIF(ev.billing_postal_code, ''::text), c.address_zip) AS billing_postal_code,
    COALESCE(NULLIF(ev.billing_city, ''::text), c.address_city) AS billing_city,
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
    ev.balance_due_days_before_event,
    COALESCE(ev.customer_language, 'de'::text) AS customer_language,
    ev.locked_after_signature,
    ev.cost_acceptance_id,
    ev.cost_acceptance_requested,
    ev.cost_acceptance_requested_at
   FROM v2_events ev
     LEFT JOIN v2_customers c ON c.id = ev.customer_id
  WHERE ev.source_inquiry_id IS NOT NULL AND ev.archived IS NOT TRUE;

-- Expose flag in public-offer RPC
CREATE OR REPLACE FUNCTION public.get_public_offer(offer_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  found_event_end_date date;
  found_customer_language text;
  found_ca_requested boolean;
  found_ca_requested_at timestamptz;
  result json;
  defaults jsonb;
BEGIN
  SELECT value INTO defaults FROM site_settings WHERE key = 'default_payment_terms';
  IF defaults IS NULL THEN
    defaults := '{"deposit_percent": 20, "deposit_due_days": 5, "offer_validity_days": 14, "balance_due_days_before_event": 10}'::jsonb;
  END IF;

  SELECT event_end_date, COALESCE(customer_language,'de'),
         COALESCE(cost_acceptance_requested, false),
         cost_acceptance_requested_at
    INTO found_event_end_date, found_customer_language,
         found_ca_requested, found_ca_requested_at
  FROM v2_events WHERE id = offer_id LIMIT 1;

  SELECT json_build_object(
    'inquiry', json_build_object(
      'id', ei.id,
      'company_name', ei.company_name,
      'contact_name', ei.contact_name,
      'email', ei.email,
      'event_type', ei.event_type,
      'preferred_date', ei.preferred_date,
      'event_end_date', found_event_end_date,
      'customer_language', found_customer_language,
      'guest_count', ei.guest_count,
      'status', ei.status,
      'offer_phase', COALESCE(ei.offer_phase, 'draft'),
      'selected_option_id', ei.selected_option_id,
      'offer_slug', ei.offer_slug,
      'lexoffice_invoice_id', ei.lexoffice_invoice_id,
      'deposit_percent', COALESCE(ei.deposit_percent, (defaults->>'deposit_percent')::int),
      'deposit_amount', ei.deposit_amount,
      'deposit_due_days', COALESCE(ei.deposit_due_days, (defaults->>'deposit_due_days')::int),
      'offer_validity_days', COALESCE(ei.offer_validity_days, (defaults->>'offer_validity_days')::int),
      'payment_method', COALESCE(ei.payment_method, 'deposit_online'),
      'invoice_due_days', COALESCE(ei.invoice_due_days, 14),
      'deposit_method', ei.deposit_method,
      'balance_method', ei.balance_method,
      'balance_due_days_before_event', COALESCE(ei.balance_due_days_before_event, (defaults->>'balance_due_days_before_event')::int),
      'cost_acceptance_requested', found_ca_requested,
      'cost_acceptance_requested_at', found_ca_requested_at,
      'email_content', COALESCE(
        (SELECT ioh.email_content FROM inquiry_offer_history ioh
         WHERE ioh.inquiry_id = offer_id ORDER BY ioh.version DESC LIMIT 1),
        ei.email_draft
      )
    ),
    'options', COALESCE((
      SELECT json_agg(json_build_object(
        'id', ioo.id,
        'option_label', ioo.option_label,
        'package_id', ioo.package_id,
        'offer_mode', ioo.offer_mode,
        'menu_selection', ioo.menu_selection,
        'guest_count', ioo.guest_count,
        'total_amount', ioo.total_amount,
        'is_active', ioo.is_active,
        'stripe_payment_link_url', ioo.stripe_payment_link_url,
        'sort_order', ioo.sort_order
      ) ORDER BY ioo.sort_order, ioo.option_label)
      FROM inquiry_offer_options ioo
      WHERE ioo.inquiry_id = offer_id AND ioo.is_active = true
    ), '[]'::json)
  ) INTO result
  FROM event_inquiries ei
  WHERE ei.id = offer_id;

  RETURN result;
END;
$function$;