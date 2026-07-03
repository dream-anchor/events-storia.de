-- =====================================================================
-- Security-Fix: Zu offene RLS-Policies auf v2_events / v2_event_emails
--
-- "Anyone can insert v2_events" (WITH CHECK true) erlaubte das Einfügen
-- beliebiger tenant_id-Werte, inkl. gesperrter/nicht existierender Tenants.
-- Public-Anfrageformulare brauchen weiterhin anonymes INSERT, aber nur
-- fuer aktive Tenants (oder den Default-Tenant, wenn kein tenant_id
-- mitgegeben wird — rueckwaertskompatibel zum heutigen Single-Tenant-Flow).
--
-- "Authenticated users can read v2_event_emails" (USING true) erlaubte
-- JEDEM eingeloggten Kunden-Account (Supabase Auth, siehe
-- CustomerAuthContext) das Lesen ALLER internen Event-E-Mails ueber alle
-- Events/Tenants hinweg. Der Mail-Client wird ausschliesslich im
-- Admin-Bereich genutzt (staff/admin), daher wird die Policy entfernt;
-- staff/admin behalten Zugriff ueber die bestehenden "manage"-Policies.
-- =====================================================================

DROP POLICY IF EXISTS "Anyone can insert v2_events" ON public.v2_events;
CREATE POLICY "Anyone can insert v2_events for active tenant" ON public.v2_events
  FOR INSERT
  WITH CHECK (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = v2_events.tenant_id AND t.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read v2_event_emails" ON public.v2_event_emails;
