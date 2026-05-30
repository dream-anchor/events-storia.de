-- Erweitert die existierenden order_confirmed_* Felder um Annahme-Quelle (online/phone/email/onsite)
-- und Admin-Zuordnung für offline angenommene Angebote.
ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS order_confirmed_via text,
  ADD COLUMN IF NOT EXISTS order_confirmed_admin_id uuid,
  ADD COLUMN IF NOT EXISTS order_confirmed_admin_email text,
  ADD COLUMN IF NOT EXISTS order_confirmed_internal_note text;

COMMENT ON COLUMN public.v2_events.order_confirmed_via IS 'Annahme-Kanal: online | phone | email | onsite';
COMMENT ON COLUMN public.v2_events.order_confirmed_admin_id IS 'Admin/Staff der die Offline-Annahme eingetragen hat (auth.uid)';
COMMENT ON COLUMN public.v2_events.order_confirmed_admin_email IS 'Admin/Staff E-Mail zum Zeitpunkt der Offline-Annahme';
COMMENT ON COLUMN public.v2_events.order_confirmed_internal_note IS 'Interne Notiz zur Offline-Annahme (z.B. Datum/Uhrzeit Telefonat)';