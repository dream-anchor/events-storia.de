CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid,
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    (SELECT tu.tenant_id
       FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
      ORDER BY tu.created_at ASC
      LIMIT 1),
    (SELECT t.id
       FROM public.tenants t
      WHERE t.is_default
        AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
      LIMIT 1)
  );
$$;

DROP POLICY IF EXISTS "Admins can manage v2_customers" ON public.v2_customers;
CREATE POLICY "Admins can manage v2_customers" ON public.v2_customers TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Staff can manage v2_customers" ON public.v2_customers;
CREATE POLICY "Staff can manage v2_customers" ON public.v2_customers TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Admins can manage v2_events" ON public.v2_events;
CREATE POLICY "Admins can manage v2_events" ON public.v2_events TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Staff can manage v2_events" ON public.v2_events;
CREATE POLICY "Staff can manage v2_events" ON public.v2_events TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id())
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND tenant_id = public.current_tenant_id());