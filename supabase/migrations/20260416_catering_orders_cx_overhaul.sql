-- Migration: Catering Orders CX-Überarbeitung
-- 
-- Neue Felder:
--   reminder_sent_at: Zeitstempel wenn die Lieferungs-Erinnerung per Mail rausging
--   last_customer_message_at: Zeitstempel der letzten Kundennachricht (für "Neue Antwort"-Badge)
--   last_our_reply_at: Zeitstempel unserer letzten Antwort (für "Wartet auf Kunden")
--
-- Zusätzlich: Index auf desired_date für schnellere Sortierung (nächster Termin oben).

ALTER TABLE public.catering_orders
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_our_reply_at timestamptz;

COMMENT ON COLUMN public.catering_orders.reminder_sent_at IS
  'Zeitstempel wenn die Lieferungs-Erinnerung an info@events-storia.de + info@ristorantestoria.de verschickt wurde. NULL = noch nicht verschickt.';

COMMENT ON COLUMN public.catering_orders.last_customer_message_at IS
  'Zeitstempel der letzten eingehenden Kundennachricht. Wird vom Mail-Sync-System gesetzt (noch nicht implementiert).';

COMMENT ON COLUMN public.catering_orders.last_our_reply_at IS
  'Zeitstempel unserer letzten Antwort an den Kunden. Wird vom Mail-Sync-System gesetzt (noch nicht implementiert).';

-- Index für die Eingang-Sortierung (nächster Liefertermin zuerst)
CREATE INDEX IF NOT EXISTS idx_catering_orders_desired_date_status
  ON public.catering_orders (desired_date ASC, status)
  WHERE status IN ('pending', 'confirmed');
