
CREATE OR REPLACE FUNCTION public.confirm_offline_booking_multi(
  p_inquiry_id uuid,
  p_option_quantities jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment_method text;
  v_entry jsonb;
  v_option_id uuid;
  v_quantity int;
  v_chosen_ids uuid[] := '{}';
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

  -- Process each option quantity
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_option_quantities)
  LOOP
    v_option_id := (v_entry->>'optionId')::uuid;
    v_quantity := COALESCE((v_entry->>'quantity')::int, 0);

    IF v_quantity > 0 THEN
      v_chosen_ids := array_append(v_chosen_ids, v_option_id);

      UPDATE v2_offer_options SET
        is_chosen = true,
        chosen_at = now(),
        selected_quantity = v_quantity
      WHERE id = v_option_id AND event_id = p_inquiry_id;
    END IF;
  END LOOP;

  IF array_length(v_chosen_ids, 1) IS NULL OR array_length(v_chosen_ids, 1) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Keine Optionen ausgewählt');
  END IF;

  -- Deactivate non-chosen options
  UPDATE v2_offer_options SET is_active = false
  WHERE event_id = p_inquiry_id AND NOT (id = ANY(v_chosen_ids));

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
    'offline_booking_confirmed_multi',
    NULL,
    jsonb_build_object('payment_method', v_payment_method, 'option_quantities', p_option_quantities),
    jsonb_build_object('triggered_by', 'customer', 'options_count', array_length(v_chosen_ids, 1))
  );

  RETURN json_build_object('success', true);
END;
$$;
