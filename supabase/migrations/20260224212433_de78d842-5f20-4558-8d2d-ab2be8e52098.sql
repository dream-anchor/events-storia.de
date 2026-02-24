
-- =============================================
-- 1/3: Staff-Rolle: RLS-Policies für Team-Mitglieder
-- =============================================

CREATE POLICY "Staff can view inquiries"
  ON public.event_inquiries FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update inquiries"
  ON public.event_inquiries FOR UPDATE
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can insert inquiries"
  ON public.event_inquiries FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can manage inquiry_comments"
  ON public.inquiry_comments FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can manage menu_items"
  ON public.menu_items FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can manage menu_categories"
  ON public.menu_categories FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can manage packages"
  ON public.packages FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can manage locations"
  ON public.locations FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can view catering_orders"
  ON public.catering_orders FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update catering_orders"
  ON public.catering_orders FOR UPDATE
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can manage event_bookings"
  ON public.event_bookings FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can upload catering images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'catering-images'
    AND public.has_role(auth.uid(), 'staff'::public.app_role)
  );

CREATE POLICY "Staff can view catering images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'catering-images'
    AND public.has_role(auth.uid(), 'staff'::public.app_role)
  );

CREATE POLICY "Staff can delete catering images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'catering-images'
    AND public.has_role(auth.uid(), 'staff'::public.app_role)
  );

-- =============================================
-- 2/3: Site Settings Key-Value Store
-- =============================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage site_settings"
  ON public.site_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Staff can read site_settings"
  ON public.site_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'staff'::public.app_role));

INSERT INTO public.site_settings (key, value) VALUES
  ('business_data', '{
    "companyName": "Storia Restaurant & Events",
    "legalName": "Speranza GmbH",
    "address": "Karlstr. 47a",
    "city": "München",
    "postalCode": "80333",
    "phone": "089 55 06 71 50",
    "email": "info@storia-muenchen.de",
    "website": "https://www.events-storia.de",
    "vatId": "DE 296024880",
    "registrationNumber": "HRB 209637",
    "defaultVatRate": "7",
    "notificationEmail": "admin@storia-muenchen.de",
    "enableEmailNotifications": true
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 3/3: Staff E-Mail-Templates Fix (kein DELETE)
-- =============================================

CREATE POLICY "Staff can view email_templates"
  ON public.email_templates FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can create email_templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update email_templates"
  ON public.email_templates FOR UPDATE
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));
