DROP POLICY IF EXISTS "tenant_isolation_cost_acceptances" ON public.cost_acceptances;
CREATE POLICY "tenant_isolation_cost_acceptances" ON public.cost_acceptances
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_inbox_emails" ON public.inbox_emails;
CREATE POLICY "tenant_isolation_inbox_emails" ON public.inbox_emails
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_email_attachments" ON public.email_attachments;
CREATE POLICY "tenant_isolation_email_attachments" ON public.email_attachments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_email_classification_feedback" ON public.email_classification_feedback;
CREATE POLICY "tenant_isolation_email_classification_feedback" ON public.email_classification_feedback
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_event_email_filters" ON public.event_email_filters;
CREATE POLICY "tenant_isolation_event_email_filters" ON public.event_email_filters
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_event_email_links" ON public.event_email_links;
CREATE POLICY "tenant_isolation_event_email_links" ON public.event_email_links
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_leads_funnel" ON public.leads_funnel;
CREATE POLICY "tenant_isolation_leads_funnel" ON public.leads_funnel
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_lead_notify_failures" ON public.lead_notify_failures;
CREATE POLICY "tenant_isolation_lead_notify_failures" ON public.lead_notify_failures
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_ai_conversations" ON public.ai_conversations;
CREATE POLICY "tenant_isolation_ai_conversations" ON public.ai_conversations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_ai_extractions" ON public.ai_extractions;
CREATE POLICY "tenant_isolation_ai_extractions" ON public.ai_extractions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_ai_messages" ON public.ai_messages;
CREATE POLICY "tenant_isolation_ai_messages" ON public.ai_messages
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_vouchers" ON public.vouchers;
CREATE POLICY "tenant_isolation_vouchers" ON public.vouchers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_review_request_log" ON public.review_request_log;
CREATE POLICY "tenant_isolation_review_request_log" ON public.review_request_log
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());