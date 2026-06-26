DROP POLICY IF EXISTS "tenant_isolation_legacy_event_inquiries" ON public._legacy_event_inquiries;
CREATE POLICY "tenant_isolation_legacy_event_inquiries" ON public._legacy_event_inquiries
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_event_bookings" ON public._legacy_event_bookings;
CREATE POLICY "tenant_isolation_legacy_event_bookings" ON public._legacy_event_bookings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_catering_orders" ON public._legacy_catering_orders;
CREATE POLICY "tenant_isolation_legacy_catering_orders" ON public._legacy_catering_orders
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_customer_profiles" ON public._legacy_customer_profiles;
CREATE POLICY "tenant_isolation_legacy_customer_profiles" ON public._legacy_customer_profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_event_payments" ON public._legacy_event_payments;
CREATE POLICY "tenant_isolation_legacy_event_payments" ON public._legacy_event_payments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_group_inquiries" ON public._legacy_group_inquiries;
CREATE POLICY "tenant_isolation_legacy_group_inquiries" ON public._legacy_group_inquiries
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_inquiry_comments" ON public._legacy_inquiry_comments;
CREATE POLICY "tenant_isolation_legacy_inquiry_comments" ON public._legacy_inquiry_comments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_inquiry_tasks" ON public._legacy_inquiry_tasks;
CREATE POLICY "tenant_isolation_legacy_inquiry_tasks" ON public._legacy_inquiry_tasks
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_inquiry_offer_options" ON public._legacy_inquiry_offer_options;
CREATE POLICY "tenant_isolation_legacy_inquiry_offer_options" ON public._legacy_inquiry_offer_options
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_inquiry_offer_history" ON public._legacy_inquiry_offer_history;
CREATE POLICY "tenant_isolation_legacy_inquiry_offer_history" ON public._legacy_inquiry_offer_history
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_offer_customer_responses" ON public._legacy_offer_customer_responses;
CREATE POLICY "tenant_isolation_legacy_offer_customer_responses" ON public._legacy_offer_customer_responses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_legacy_email_messages" ON public._legacy_email_messages;
CREATE POLICY "tenant_isolation_legacy_email_messages" ON public._legacy_email_messages
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());