
CREATE OR REPLACE FUNCTION public.confirm_offline_booking(p_inquiry_id uuid, p_selected_option_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment_method text;
BEGIN
  -- Verify inquiry exists and has offline payment method
  SELECT payment_method INTO v_payment_method
  FROM v2_events WHERE id = p_inquiry_id AND source_inquiry_id IS NOT NULL;

  IF v_payment_method IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Anfrage nicht gefunden');
  END IF;

  IF v_payment_method NOT IN ('on_site', 'invoice_after') THEN
    RETURN json_build_object('success', false, 'error', 'Diese Zahlungsart erfordert Online-Zahlung');
  END IF;

  -- Update selected option
  UPDATE v2_offer_options SET
    is_chosen = true,
    chosen_at = now()
  WHERE id = p_selected_option_id AND event_id = p_inquiry_id;

  -- Deactivate other options
  UPDATE v2_offer_options SET is_active = false
  WHERE event_id = p_inquiry_id AND id != p_selected_option_id;

  -- Update event status
  UPDATE v2_events SET
    status = 'offer_chosen'::v2_event_status,
    offer_phase = 'confirmed',
    updated_at = now()
  WHERE id = p_inquiry_id;

  -- Activity Log
  INSERT INTO activity_logs (entity_type, entity_id, action, actor_email, new_value, metadata)
  VALUES (
    'event_inquiry',
    p_inquiry_id,
    'offline_booking_confirmed',
    NULL,
    jsonb_build_object('payment_method', v_payment_method, 'selected_option_id', p_selected_option_id),
    jsonb_build_object('triggered_by', 'customer')
  );

  RETURN json_build_object('success', true);
END; $function$;
