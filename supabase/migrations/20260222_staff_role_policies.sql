-- =============================================
-- Staff-Rolle: RLS-Policies für Team-Mitglieder
-- Staff darf Inhalte bearbeiten, aber keine
-- Systemkonfiguration oder Nutzer verwalten.
-- =============================================

-- Event-Anfragen: Lesen + Bearbeiten (kein Löschen)
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

-- Anfrage-Kommentare: Voller Zugriff
CREATE POLICY "Staff can manage inquiry_comments"
  ON public.inquiry_comments FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Speisen: Voller Zugriff
CREATE POLICY "Staff can manage menu_items"
  ON public.menu_items FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Kategorien: Voller Zugriff
CREATE POLICY "Staff can manage menu_categories"
  ON public.menu_categories FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Pakete: Voller Zugriff
CREATE POLICY "Staff can manage packages"
  ON public.packages FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Paket-Optionen: Voller Zugriff
CREATE POLICY "Staff can manage package_options"
  ON public.package_options FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Locations: Voller Zugriff
CREATE POLICY "Staff can manage locations"
  ON public.locations FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Catering-Bestellungen: Lesen + Bearbeiten
CREATE POLICY "Staff can view catering_orders"
  ON public.catering_orders FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update catering_orders"
  ON public.catering_orders FOR UPDATE
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- E-Mail-Vorlagen: Lesen (kein Bearbeiten/Löschen)
CREATE POLICY "Staff can view email_templates"
  ON public.email_templates FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

-- Event-Buchungen: Voller Zugriff
CREATE POLICY "Staff can manage event_bookings"
  ON public.event_bookings FOR ALL
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Storage: Catering-Bilder hochladen/lesen/löschen
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

-- user_roles: Staff darf nur eigene Rolle lesen (für Auth-Check)
CREATE POLICY "Staff can read own role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
