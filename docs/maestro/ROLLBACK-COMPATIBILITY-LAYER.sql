-- ============================================================
-- ROLLBACK SCRIPT: Phase 4 Compatibility Layer
-- ============================================================
-- Führe dieses Script aus, wenn die Views/Trigger das Admin-UI
-- nicht korrekt bedienen und du zu Legacy-Tabellen zurück willst.
--
-- Voraussetzung: _legacy_*-Tabellen existieren noch unverändert.
-- ============================================================

BEGIN;

-- 1) Trigger-Funktionen droppen (CASCADE droppt auch die Trigger)
DROP FUNCTION IF EXISTS public.event_inquiries_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.event_inquiries_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.event_inquiries_delete_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.event_bookings_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.event_bookings_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.catering_orders_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.catering_orders_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_comments_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_comments_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_comments_delete_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_offer_options_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_offer_options_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_offer_options_delete_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_tasks_insert_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_tasks_update_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.inquiry_tasks_delete_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.offer_customer_responses_insert_trigger() CASCADE;

-- 2) Views droppen
DROP VIEW IF EXISTS public.event_inquiries CASCADE;
DROP VIEW IF EXISTS public.event_bookings CASCADE;
DROP VIEW IF EXISTS public.catering_orders CASCADE;
DROP VIEW IF EXISTS public.inquiry_comments CASCADE;
DROP VIEW IF EXISTS public.inquiry_offer_options CASCADE;
DROP VIEW IF EXISTS public.inquiry_offer_history CASCADE;
DROP VIEW IF EXISTS public.inquiry_tasks CASCADE;
DROP VIEW IF EXISTS public.event_payments CASCADE;
DROP VIEW IF EXISTS public.offer_customer_responses CASCADE;
DROP VIEW IF EXISTS public.email_messages CASCADE;
DROP VIEW IF EXISTS public.customer_profiles CASCADE;

-- 3) Legacy-Tabellen zurückrenamen
ALTER TABLE public._legacy_event_inquiries RENAME TO event_inquiries;
ALTER TABLE public._legacy_event_bookings RENAME TO event_bookings;
ALTER TABLE public._legacy_catering_orders RENAME TO catering_orders;
ALTER TABLE public._legacy_inquiry_offer_options RENAME TO inquiry_offer_options;
ALTER TABLE public._legacy_inquiry_offer_history RENAME TO inquiry_offer_history;
ALTER TABLE public._legacy_inquiry_comments RENAME TO inquiry_comments;
ALTER TABLE public._legacy_inquiry_tasks RENAME TO inquiry_tasks;
ALTER TABLE public._legacy_event_payments RENAME TO event_payments;
ALTER TABLE public._legacy_offer_customer_responses RENAME TO offer_customer_responses;
ALTER TABLE public._legacy_email_messages RENAME TO email_messages;
ALTER TABLE public._legacy_customer_profiles RENAME TO customer_profiles;

COMMIT;

-- 4) MANUELL danach: Edge Functions per git revert auf Pre-v2-Stand
--    zurücksetzen und neu deployen:
--    - handle-offer-payment
--    - send-offer-email
--    - send-menu-confirmation
--    - notify-customer-response
--    - send-customer-response-copy
