DROP POLICY IF EXISTS "tenant_isolation_menus" ON public.menus;
CREATE POLICY "tenant_isolation_menus" ON public.menus
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_menu_categories" ON public.menu_categories;
CREATE POLICY "tenant_isolation_menu_categories" ON public.menu_categories
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_menu_items" ON public.menu_items;
CREATE POLICY "tenant_isolation_menu_items" ON public.menu_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_packages" ON public.packages;
CREATE POLICY "tenant_isolation_packages" ON public.packages
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_package_locations" ON public.package_locations;
CREATE POLICY "tenant_isolation_package_locations" ON public.package_locations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_package_menu_items" ON public.package_menu_items;
CREATE POLICY "tenant_isolation_package_menu_items" ON public.package_menu_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_package_course_config" ON public.package_course_config;
CREATE POLICY "tenant_isolation_package_course_config" ON public.package_course_config
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_package_drink_config" ON public.package_drink_config;
CREATE POLICY "tenant_isolation_package_drink_config" ON public.package_drink_config
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_locations" ON public.locations;
CREATE POLICY "tenant_isolation_locations" ON public.locations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_email_templates" ON public.email_templates;
CREATE POLICY "tenant_isolation_email_templates" ON public.email_templates
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_crm_settings" ON public.crm_settings;
CREATE POLICY "tenant_isolation_crm_settings" ON public.crm_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_site_settings" ON public.site_settings;
CREATE POLICY "tenant_isolation_site_settings" ON public.site_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());