CREATE OR REPLACE VIEW public.unassigned_inbox_emails
WITH (security_invoker = true)
AS
SELECT ie.*
FROM public.inbox_emails ie
WHERE NOT ie.is_hidden
  AND NOT EXISTS (
    SELECT 1 FROM public.event_email_links eel
    WHERE eel.email_id = ie.id AND NOT eel.is_excluded
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.email_sender_blocklist bl
    WHERE lower(bl.from_email) = lower(ie.from_email)
  );

GRANT SELECT ON public.unassigned_inbox_emails TO authenticated;