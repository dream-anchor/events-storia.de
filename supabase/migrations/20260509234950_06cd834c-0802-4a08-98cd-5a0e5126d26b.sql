-- 1. imap_sync_state: store actual IMAP folder path behind canonical name
ALTER TABLE public.imap_sync_state
  ADD COLUMN IF NOT EXISTS imap_folder_path text;

-- 2. inbox_emails: direction column
ALTER TABLE public.inbox_emails
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inbox_emails_direction_check'
  ) THEN
    ALTER TABLE public.inbox_emails
      ADD CONSTRAINT inbox_emails_direction_check
      CHECK (direction IN ('inbound', 'outbound_manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inbox_emails_direction
  ON public.inbox_emails(direction);

-- 3. Seed 'SENT' state row (idempotent)
INSERT INTO public.imap_sync_state (folder_name, last_uid, imap_folder_path)
  VALUES ('SENT', 0, NULL)
  ON CONFLICT (folder_name) DO NOTHING;

-- 4. Cleanup: bestehende eigene Outbound-Kopien in INBOX verstecken
UPDATE public.inbox_emails
SET is_hidden = true,
    hidden_reason = 'own_outbound_in_inbox',
    hidden_at = COALESCE(hidden_at, now()),
    updated_at = now()
WHERE lower(from_email) = 'info@events-storia.de'
  AND direction = 'inbound'
  AND is_hidden = false;

-- 5. get_event_emails: include outbound_manual rows from inbox_emails
CREATE OR REPLACE FUNCTION public.get_event_emails(
  p_event_id uuid,
  p_include_hidden boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  source text,
  message_id text,
  from_email text,
  from_name text,
  subject text,
  body_text text,
  body_html text,
  date_at timestamp with time zone,
  imap_status text,
  status_changed_at timestamp with time zone,
  imap_folder text,
  is_hidden boolean,
  is_excluded boolean,
  has_attachments boolean,
  attachment_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Inbound (received in INBOX-style folders)
  SELECT
    ie.id,
    'inbound'::text AS source,
    ie.message_id,
    ie.from_email,
    ie.from_name,
    ie.subject,
    ie.body_text,
    ie.body_html,
    ie.date_received AS date_at,
    ie.imap_status,
    ie.status_changed_at,
    ie.imap_folder,
    ie.is_hidden,
    eel.is_excluded,
    ie.has_attachments,
    ie.attachment_count
  FROM public.inbox_emails ie
  JOIN public.event_email_links eel ON eel.email_id = ie.id
  WHERE eel.event_id = p_event_id
    AND ie.direction = 'inbound'
    AND (p_include_hidden OR (NOT ie.is_hidden AND NOT eel.is_excluded))

  UNION ALL

  -- Outbound (sent through Maestro, archived directly)
  SELECT
    vee.id,
    'outbound'::text AS source,
    vee.resend_message_id AS message_id,
    vee.from_email,
    NULL::text AS from_name,
    vee.subject,
    vee.body_text,
    vee.body_html,
    vee.created_at AS date_at,
    'present'::text AS imap_status,
    NULL::timestamptz AS status_changed_at,
    NULL::text AS imap_folder,
    false AS is_hidden,
    false AS is_excluded,
    (vee.attachments IS NOT NULL AND jsonb_array_length(vee.attachments) > 0) AS has_attachments,
    COALESCE(jsonb_array_length(vee.attachments), 0)::integer AS attachment_count
  FROM public.v2_event_emails vee
  WHERE vee.event_id = p_event_id AND vee.direction = 'outbound'

  UNION ALL

  -- Outbound manual (Operator hat aus Apple Mail / IMAP-Client gesendet)
  SELECT
    ie.id,
    'outbound_manual'::text AS source,
    ie.message_id,
    ie.from_email,
    ie.from_name,
    ie.subject,
    ie.body_text,
    ie.body_html,
    COALESCE(ie.date_sent, ie.date_received) AS date_at,
    ie.imap_status,
    ie.status_changed_at,
    ie.imap_folder,
    ie.is_hidden,
    eel.is_excluded,
    ie.has_attachments,
    ie.attachment_count
  FROM public.inbox_emails ie
  JOIN public.event_email_links eel ON eel.email_id = ie.id
  WHERE eel.event_id = p_event_id
    AND ie.direction = 'outbound_manual'
    AND (p_include_hidden OR (NOT ie.is_hidden AND NOT eel.is_excluded))

  ORDER BY date_at DESC;
$function$;