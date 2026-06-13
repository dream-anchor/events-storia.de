CREATE OR REPLACE FUNCTION public.get_public_offer(offer_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  found_event_end_date date;
  found_customer_language text;
  result json;
  defaults jsonb;
BEGIN
  SELECT value INTO defaults FROM site_settings WHERE key = 'default_payment_terms';
  IF defaults IS NULL THEN
    defaults := '{"deposit_percent": 20, "deposit_due_days": 5, "offer_validity_days": 14, "balance_due_days_before_event": 10}'::jsonb;
  END IF;

  SELECT event_end_date, COALESCE(customer_language,'de')
    INTO found_event_end_date, found_customer_language
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