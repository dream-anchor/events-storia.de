
-- Email-Fehler-Alarm: Trigger ruft Edge Function bei jedem Fail-Status auf

CREATE OR REPLACE FUNCTION public.notify_email_failure_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotenz: nicht erneut alerten wenn bereits gemeldet ODER bereits aufgelöst
  IF (NEW.metadata ->> 'alert_sent_at') IS NOT NULL
     OR (NEW.metadata ->> 'resolved_at') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://sovlfqncotxcjqseeawp.supabase.co/functions/v1/notify-email-failure',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdmxmcW5jb3R4Y2pxc2VlYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTM5NjMsImV4cCI6MjA4MDUyOTk2M30.t7WJB1ysn4QNDHpXIJ3Gzo5bxuXiTJpJJ-8DSkVpRyc"}'::jsonb,
    body := jsonb_build_object('deliveryLogId', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_delivery_failure_notify ON public.email_delivery_logs;

CREATE TRIGGER email_delivery_failure_notify
AFTER INSERT OR UPDATE OF status ON public.email_delivery_logs
FOR EACH ROW
WHEN (NEW.status IN ('failed','bounced','complained','suppressed'))
EXECUTE FUNCTION public.notify_email_failure_trigger();

-- Realtime aktivieren damit UI sofort updated
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_delivery_logs;
