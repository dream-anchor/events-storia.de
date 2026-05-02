
-- Revoke EXECUTE from anon on all internal trigger/helper functions
-- These are only called by triggers or service-role edge functions, never by unauthenticated clients

REVOKE EXECUTE ON FUNCTION public.catering_orders_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.catering_orders_update_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_messages_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_bookings_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_bookings_update_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_inquiries_delete_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_inquiries_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_inquiries_update_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_payments_delete_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_payments_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_payments_update_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_booking_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_order_number(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_customer() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_comments_delete_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_comments_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_comments_update_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_offer_history_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_offer_options_delete_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_offer_options_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_offer_options_update_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_tasks_delete_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_tasks_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.inquiry_tasks_update_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.offer_customer_responses_insert_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_deleted_menu_items() FROM anon;
