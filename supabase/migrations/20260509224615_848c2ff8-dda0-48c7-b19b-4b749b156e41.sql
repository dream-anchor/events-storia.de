CREATE OR REPLACE FUNCTION public.get_event_emails(p_event_id uuid, p_include_hidden boolean DEFAULT false)
RETURNS TABLE (
  id uuid,
  source text,
  message_id text,
  from_email text,
  from_name text,
  subject text,
  body_text text,
  body_html text,
  date_at timestamptz,
  imap_status text,
  status_changed_at timestamptz,
  imap_folder text,
  is_hidden boolean,
  is_excluded boolean,
  has_attachments boolean,
  attachment_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND (p_include_hidden OR (NOT ie.is_hidden AND NOT eel.is_excluded))
  UNION ALL
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
  ORDER BY date_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_emails(uuid, boolean) TO authenticated, service_role;