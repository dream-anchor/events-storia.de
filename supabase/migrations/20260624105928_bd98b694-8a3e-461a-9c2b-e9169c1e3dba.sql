
-- === _legacy_event_bookings: Lock down ===
DROP POLICY IF EXISTS "Anyone can insert event bookings" ON public._legacy_event_bookings;
DROP POLICY IF EXISTS "Customers can view own event bookings" ON public._legacy_event_bookings;
DROP POLICY IF EXISTS "Authenticated users can insert event bookings" ON public._legacy_event_bookings;
DROP POLICY IF EXISTS "Staff can manage event_bookings" ON public._legacy_event_bookings;
-- Admin policy bleibt. Staff neu anlegen, scoped auf authenticated:
CREATE POLICY "Staff manage legacy_event_bookings"
  ON public._legacy_event_bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));
REVOKE ALL ON public._legacy_event_bookings FROM anon;

-- === _legacy_event_payments: Lock down ===
DROP POLICY IF EXISTS "anon can view payment status by inquiry" ON public._legacy_event_payments;
DROP POLICY IF EXISTS "Authenticated users can manage event_payments" ON public._legacy_event_payments;
CREATE POLICY "Admins manage legacy_event_payments"
  ON public._legacy_event_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff manage legacy_event_payments"
  ON public._legacy_event_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));
REVOKE ALL ON public._legacy_event_payments FROM anon;

-- === _legacy_group_inquiries: Lock down ===
DROP POLICY IF EXISTS "Authenticated full access group_inquiries" ON public._legacy_group_inquiries;
CREATE POLICY "Admins manage legacy_group_inquiries"
  ON public._legacy_group_inquiries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff manage legacy_group_inquiries"
  ON public._legacy_group_inquiries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));
-- Anon insert policy bleibt für Gruppenanfrage-Formular, aber SELECT/UPDATE/DELETE für anon entfernen:
REVOKE SELECT, UPDATE, DELETE ON public._legacy_group_inquiries FROM anon;

-- === v2_payments: Anon-Read entfernen ===
DROP POLICY IF EXISTS "anon can view payment status by event" ON public.v2_payments;
REVOKE ALL ON public.v2_payments FROM anon;

-- === Views auf security_invoker umstellen ===
ALTER VIEW public.unassigned_inbox_emails SET (security_invoker = true);
ALTER VIEW public.v2_payments_enriched SET (security_invoker = true);
ALTER VIEW public.event_inquiries SET (security_invoker = true);
ALTER VIEW public.email_messages SET (security_invoker = true);
ALTER VIEW public.inquiry_offer_history SET (security_invoker = true);
