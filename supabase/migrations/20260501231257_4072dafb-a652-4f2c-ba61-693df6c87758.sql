
-- REVOKE EXECUTE FROM anon AND authenticated for trigger functions
-- (they are called by the DB engine, not by users via PostgREST)
REVOKE EXECUTE ON FUNCTION public.catering_orders_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.catering_orders_update_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_bookings_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_bookings_update_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_inquiries_delete_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_inquiries_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_inquiries_update_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_payments_delete_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_payments_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_payments_update_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_messages_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_comments_delete_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_comments_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_comments_update_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_offer_history_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_offer_options_delete_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_offer_options_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_offer_options_update_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_tasks_delete_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_tasks_insert_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inquiry_tasks_update_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.offer_customer_responses_insert_trigger() FROM anon, authenticated;

-- REVOKE EXECUTE FROM anon for internal admin/system functions
-- (keep authenticated for functions used in admin panel)
REVOKE EXECUTE ON FUNCTION public.purge_deleted_menu_items() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_booking_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_order_number(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_customer() FROM anon;

-- Fix 4: Race condition protection for submit_offer_response
-- Replace function with FOR UPDATE locking
CREATE OR REPLACE FUNCTION public.submit_offer_response(p_inquiry_id uuid, p_selected_option_id uuid, p_customer_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_phase text;
BEGIN
  -- Lock the row to prevent concurrent double-bookings
  SELECT offer_phase INTO v_phase
  FROM v2_events
  WHERE id = p_inquiry_id
  FOR UPDATE SKIP LOCKED;

  IF v_phase IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Angebot wird gerade bearbeitet — bitte erneut versuchen');
  END IF;

  IF v_phase != 'proposal_sent' THEN
    RETURN json_build_object('success', false, 'error', 'Angebot nicht gefunden oder bereits beantwortet');
  END IF;

  INSERT INTO offer_customer_responses (inquiry_id, selected_option_id, customer_notes)
  VALUES (p_inquiry_id, p_selected_option_id, p_customer_notes);

  UPDATE event_inquiries SET offer_phase = 'customer_responded', selected_option_id = p_selected_option_id, updated_at = now()
  WHERE id = p_inquiry_id;

  RETURN json_build_object('success', true);
END;
$$;
