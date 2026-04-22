GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_payments TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_messages TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiry_offer_history TO authenticated, anon, service_role;
GRANT SELECT ON public.event_payments_enriched TO authenticated, anon, service_role;