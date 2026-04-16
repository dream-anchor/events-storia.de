-- Migration: pg_cron für process-order-reminders
--
-- Ruft die Edge Function `process-order-reminders` stündlich auf.
-- Der Job läuft 24/7 alle volle Stunde — aber Reminder werden nur
-- verschickt wenn:
--   (a) Bestellung noch keine Erinnerung hat (reminder_sent_at IS NULL)
--   (b) desired_date ist übermorgen
--
-- Der eigentliche "0:30 Uhr"-Trigger ist hier aus pragmatischen Gründen
-- abgebildet: Wir lassen den Job stündlich laufen. In der Praxis wird
-- eine Bestellung also innerhalb der ersten vollen Stunde nach Mitternacht
-- zwei Tage vorher die Reminder-Mail bekommen.
--
-- Wenn du den strikten 0:30-Zeitpunkt willst: Schedule auf '30 0 * * *'
-- ändern. Nachteil: Bei Ausfall um 0:30 gibt's keine Retry.

DO $$
BEGIN
  -- Alten Job löschen falls vorhanden (idempotent)
  PERFORM cron.unschedule('process-order-reminders-hourly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-order-reminders-hourly');
EXCEPTION WHEN OTHERS THEN
  -- pg_cron nicht verfügbar oder Job existiert nicht — ignorieren
  NULL;
END $$;

SELECT cron.schedule(
  'process-order-reminders-hourly',
  '0 * * * *', -- jede volle Stunde
  $$
    SELECT net.http_post(
      url := 'https://sovlfqncotxcjqseeawp.supabase.co/functions/v1/process-order-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'Scheduler für process-order-reminders (stündlich) — ruft Edge Function für Lieferungs-Erinnerungen + Auto-Erledigt-Transition auf';
