-- 1) Spalte ist bereits durch vorherige Migration angelegt; idempotent absichern
ALTER TABLE public.v2_event_offer_history
  ADD COLUMN IF NOT EXISTS email_html text;

-- 2) View droppen + neu erstellen (CREATE OR REPLACE erlaubt keine
--    Spalten-Reihenfolgen-Änderung)
DROP VIEW IF EXISTS public.inquiry_offer_history CASCADE;

CREATE VIEW public.inquiry_offer_history AS
SELECT
  id,
  event_id   AS inquiry_id,
  version,
  sent_at,
  sent_by,
  email_content,
  email_html,
  pdf_url,
  options_snapshot,
  created_at
FROM public.v2_event_offer_history;

-- 3) INSTEAD OF INSERT Trigger neu anlegen (CASCADE hat ihn entfernt)
CREATE OR REPLACE FUNCTION public.inquiry_offer_history_insert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.v2_event_offer_history (
    id, event_id, version, sent_at, sent_by, email_content, email_html,
    pdf_url, options_snapshot, created_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.inquiry_id, NEW.version,
    COALESCE(NEW.sent_at, now()), NEW.sent_by,
    NEW.email_content, NEW.email_html, NEW.pdf_url, NEW.options_snapshot,
    COALESCE(NEW.created_at, now())
  ) RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER inquiry_offer_history_insert_trigger
INSTEAD OF INSERT ON public.inquiry_offer_history
FOR EACH ROW EXECUTE FUNCTION public.inquiry_offer_history_insert_trigger();

-- View braucht RLS-Berechtigungen — auf Basis der V2-Tabelle ist das geregelt
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiry_offer_history TO authenticated, service_role;