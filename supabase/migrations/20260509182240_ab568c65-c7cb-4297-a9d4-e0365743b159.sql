ALTER TABLE public.v2_event_emails ADD COLUMN IF NOT EXISTS bcc_email TEXT;

-- Recreate email_messages view to include cc_email + bcc_email
DROP VIEW IF EXISTS public.email_messages CASCADE;
CREATE VIEW public.email_messages AS
SELECT
  id,
  event_id AS inquiry_id,
  direction::text AS direction,
  from_email,
  to_email,
  cc_email,
  bcc_email,
  subject,
  body_text,
  body_html,
  attachments,
  resend_message_id,
  resend_status,
  in_reply_to,
  created_at
FROM public.v2_event_emails;

GRANT SELECT ON public.email_messages TO anon, authenticated, service_role;

-- Recreate INSERT trigger handler to also forward cc_email + bcc_email
CREATE OR REPLACE FUNCTION public.email_messages_insert_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.v2_event_emails (
    id, event_id, direction, from_email, to_email, cc_email, bcc_email, subject,
    body_text, body_html, attachments, resend_message_id,
    resend_status, in_reply_to, created_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.inquiry_id,
    NEW.direction::v2_email_direction,
    NEW.from_email, NEW.to_email, NEW.cc_email, NEW.bcc_email, NEW.subject,
    NEW.body_text, NEW.body_html,
    COALESCE(NEW.attachments, '[]'::jsonb),
    NEW.resend_message_id, COALESCE(NEW.resend_status, 'queued'),
    NEW.in_reply_to, COALESCE(NEW.created_at, now())
  ) RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END; $function$;

CREATE TRIGGER email_messages_insert
INSTEAD OF INSERT ON public.email_messages
FOR EACH ROW EXECUTE FUNCTION public.email_messages_insert_trigger();