
-- 1. Update direction check constraint to include 'draft'
ALTER TABLE public.inbox_emails DROP CONSTRAINT IF EXISTS inbox_emails_direction_check;
ALTER TABLE public.inbox_emails
  ADD CONSTRAINT inbox_emails_direction_check
  CHECK (direction IN ('inbound', 'outbound_manual', 'draft'));

-- 2. Surrogate key for drafts (UID-based, since Drafts often lack a stable Message-ID)
ALTER TABLE public.inbox_emails
  ADD COLUMN IF NOT EXISTS draft_uid_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_emails_draft_uid_key
  ON public.inbox_emails(draft_uid_key)
  WHERE draft_uid_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_emails_direction_status
  ON public.inbox_emails(direction, imap_status)
  WHERE direction = 'draft';

-- 3. Register DRAFTS in imap_sync_state
INSERT INTO public.imap_sync_state (folder_name, last_uid, imap_folder_path)
  VALUES ('DRAFTS', 0, NULL)
  ON CONFLICT (folder_name) DO NOTHING;

-- 4. Update unassigned_inbox_emails view to exclude drafts and outbound_manual
CREATE OR REPLACE VIEW public.unassigned_inbox_emails AS
  SELECT id, message_id, raw_mime, raw_size_bytes, imap_uid, imap_folder, imap_status,
    status_changed_at, status_history, from_email, from_name, to_emails, cc_emails,
    reply_to_email, subject, in_reply_to, references_headers, body_text, body_html,
    has_attachments, attachment_count, date_sent, date_received, is_hidden, hidden_reason,
    hidden_at, hidden_by, created_at, updated_at
  FROM public.inbox_emails ie
  WHERE NOT is_hidden
    AND COALESCE(direction, 'inbound') = 'inbound'
    AND NOT EXISTS (
      SELECT 1 FROM public.event_email_links eel
      WHERE eel.email_id = ie.id AND NOT eel.is_excluded
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.email_sender_blocklist bl
      WHERE lower(bl.from_email) = lower(ie.from_email)
    );
