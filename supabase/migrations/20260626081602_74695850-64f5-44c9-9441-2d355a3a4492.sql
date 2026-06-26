-- v2_offer_options
DROP POLICY IF EXISTS "Admins can manage v2_offer_options" ON public.v2_offer_options;
CREATE POLICY "Admins can manage v2_offer_options" ON public.v2_offer_options TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "Staff can manage v2_offer_options" ON public.v2_offer_options;
CREATE POLICY "Staff can manage v2_offer_options" ON public.v2_offer_options TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());

-- v2_payments
DROP POLICY IF EXISTS "Admins can manage v2_payments" ON public.v2_payments;
CREATE POLICY "Admins can manage v2_payments" ON public.v2_payments TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "Staff can manage v2_payments" ON public.v2_payments;
CREATE POLICY "Staff can manage v2_payments" ON public.v2_payments TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());

-- v2_event_changelog
DROP POLICY IF EXISTS "Admins can manage v2_event_changelog" ON public.v2_event_changelog;
CREATE POLICY "Admins can manage v2_event_changelog" ON public.v2_event_changelog TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "Staff can manage v2_event_changelog" ON public.v2_event_changelog;
CREATE POLICY "Staff can manage v2_event_changelog" ON public.v2_event_changelog TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());

-- v2_event_comments
DROP POLICY IF EXISTS "Admins can manage v2_event_comments" ON public.v2_event_comments;
CREATE POLICY "Admins can manage v2_event_comments" ON public.v2_event_comments TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "Staff can manage v2_event_comments" ON public.v2_event_comments;
CREATE POLICY "Staff can manage v2_event_comments" ON public.v2_event_comments TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());

-- v2_event_tasks
DROP POLICY IF EXISTS "Admins can manage v2_event_tasks" ON public.v2_event_tasks;
CREATE POLICY "Admins can manage v2_event_tasks" ON public.v2_event_tasks TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "Staff can manage v2_event_tasks" ON public.v2_event_tasks;
CREATE POLICY "Staff can manage v2_event_tasks" ON public.v2_event_tasks TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());

-- v2_event_offer_history
DROP POLICY IF EXISTS "Admins can manage v2_event_offer_history" ON public.v2_event_offer_history;
CREATE POLICY "Admins can manage v2_event_offer_history" ON public.v2_event_offer_history TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "Staff can manage v2_event_offer_history" ON public.v2_event_offer_history;
CREATE POLICY "Staff can manage v2_event_offer_history" ON public.v2_event_offer_history TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());

-- v2_event_emails
DROP POLICY IF EXISTS "Admins can manage v2_event_emails" ON public.v2_event_emails;
CREATE POLICY "Admins can manage v2_event_emails" ON public.v2_event_emails TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "Staff can manage v2_event_emails" ON public.v2_event_emails;
CREATE POLICY "Staff can manage v2_event_emails" ON public.v2_event_emails TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());