-- Stripe-Checkout-Sessions je Catering-/Event-Bestellung (Abdichtung, Runde 4).
-- Zweck: Eine offene Session einer Bestellung gezielt per sessions.retrieve/expire finden. Stripe füllt customer_details erst nach
-- Abschluss, und `sessions.list` kennt keinen Metadaten-Filter; die Suche per E-Mail fand offene Sessions daher nicht.
-- Eigene Tabelle statt Spalte: catering_orders und event_bookings sind Ansichten (Views) über v2_events, eine neue Spalte dort
-- wäre eine Änderung an Tabelle UND Ansicht samt Insert-Trigger.
-- Rein additiv. Nur die Edge Functions (service_role) lesen/schreiben; RLS aktiv ohne Policy = für anon/authenticated gesperrt.
-- Die Functions arbeiten auch ohne diese Tabelle (Fehler werden ignoriert; dann gilt die Session-Suche als unvollständig und es
-- wird nichts freigegeben, siehe _shared/stripeSessions.ts).
CREATE TABLE IF NOT EXISTS public.catering_checkout_sessions (
  session_id text PRIMARY KEY,
  order_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catering_checkout_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catering_checkout_sessions FROM anon, authenticated;
GRANT ALL ON public.catering_checkout_sessions TO service_role;
CREATE INDEX IF NOT EXISTS idx_catering_checkout_sessions_order ON public.catering_checkout_sessions (order_number);
