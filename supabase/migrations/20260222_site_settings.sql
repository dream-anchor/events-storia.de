-- =============================================
-- Site Settings: Key-Value Store für Geschäftsdaten
-- Ersetzt localStorage-Persistenz
-- =============================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Admin darf alles
CREATE POLICY "Admin can manage site_settings"
  ON public.site_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Staff darf lesen
CREATE POLICY "Staff can read site_settings"
  ON public.site_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'staff'::public.app_role));

-- Default-Werte einfügen
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
