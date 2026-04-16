-- 1. Neue Felder für Catering Orders CX
ALTER TABLE public.catering_orders
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_our_reply_at timestamptz;

-- Index für aktive Orders
CREATE INDEX IF NOT EXISTS idx_catering_orders_active_date
  ON public.catering_orders (desired_date, status)
  WHERE status IN ('pending', 'confirmed');

-- 2. pg_cron + pg_net aktivieren
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Stündlicher Cron Job für process-order-reminders
DO $$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'process-order-reminders-hourly';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'process-order-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sovlfqncotxcjqseeawp.supabase.co/functions/v1/process-order-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdmxmcW5jb3R4Y2pxc2VlYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTM5NjMsImV4cCI6MjA4MDUyOTk2M30.t7WJB1ysn4QNDHpXIJ3Gzo5bxuXiTJpJJ-8DSkVpRyc"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);