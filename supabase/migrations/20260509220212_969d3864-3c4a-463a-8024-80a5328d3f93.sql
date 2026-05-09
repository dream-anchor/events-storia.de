-- Enable pg_trgm extension for subject substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Mailbox-Cache: alle aus IMAP gepullten Mails
CREATE TABLE public.inbox_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE NOT NULL,
  raw_mime text NOT NULL,
  raw_size_bytes integer NOT NULL,
  imap_uid bigint NOT NULL,
  imap_folder text NOT NULL DEFAULT 'INBOX',
  imap_status text NOT NULL DEFAULT 'present'
    CHECK (imap_status IN ('present', 'moved', 'deleted_on_server')),
  status_changed_at timestamptz,
  status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_email text NOT NULL,
  from_name text,
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  reply_to_email text,
  subject text,
  in_reply_to text,
  references_headers text[] DEFAULT '{}',
  body_text text,
  body_html text,
  has_attachments boolean NOT NULL DEFAULT false,
  attachment_count integer NOT NULL DEFAULT 0,
  date_sent timestamptz,
  date_received timestamptz NOT NULL,
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_reason text,
  hidden_at timestamptz,
  hidden_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_emails_from ON public.inbox_emails(from_email);
CREATE INDEX idx_inbox_emails_date ON public.inbox_emails(date_received DESC);
CREATE INDEX idx_inbox_emails_status ON public.inbox_emails(imap_status, date_received DESC);
CREATE INDEX idx_inbox_emails_subject_trgm ON public.inbox_emails
  USING gin(subject gin_trgm_ops);

-- 2. Email Attachments
CREATE TABLE public.email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES public.inbox_emails(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  storage_path text NOT NULL,
  is_inline boolean NOT NULL DEFAULT false,
  content_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_attachments_email ON public.email_attachments(email_id);

-- 3. Event Email Filters
CREATE TABLE public.event_email_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  filter_type text NOT NULL CHECK (filter_type IN (
    'from_email',
    'subject_contains',
    'thread_root'
  )),
  filter_value text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  label text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_email_filters_event ON public.event_email_filters(event_id, is_active);
CREATE INDEX idx_event_email_filters_value ON public.event_email_filters(filter_type, filter_value);

-- 4. Event Email Links (M:N)
CREATE TABLE public.event_email_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  email_id uuid NOT NULL REFERENCES public.inbox_emails(id) ON DELETE CASCADE,
  link_source text NOT NULL CHECK (link_source IN ('filter_match', 'manual')),
  matched_filter_id uuid REFERENCES public.event_email_filters(id) ON DELETE SET NULL,
  is_excluded boolean NOT NULL DEFAULT false,
  excluded_by uuid REFERENCES auth.users(id),
  excluded_at timestamptz,
  excluded_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, email_id)
);

CREATE INDEX idx_event_email_links_event ON public.event_email_links(event_id) WHERE is_excluded = false;
CREATE INDEX idx_event_email_links_email ON public.event_email_links(email_id);

-- 5. IMAP Sync State
CREATE TABLE public.imap_sync_state (
  folder_name text PRIMARY KEY,
  last_uid bigint NOT NULL DEFAULT 0,
  last_sync_at timestamptz,
  last_full_reconcile_at timestamptz,
  last_error text,
  last_error_at timestamptz
);

INSERT INTO public.imap_sync_state (folder_name) VALUES ('INBOX'), ('Archiv')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.inbox_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_email_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_email_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imap_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read inbox_emails" ON public.inbox_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update inbox_emails" ON public.inbox_emails FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service all inbox_emails" ON public.inbox_emails FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth read email_attachments" ON public.email_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "service all email_attachments" ON public.email_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth all event_email_filters" ON public.event_email_filters FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth all event_email_links" ON public.event_email_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service all event_email_links" ON public.event_email_links FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service imap_sync_state" ON public.imap_sync_state FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth read imap_sync_state" ON public.imap_sync_state FOR SELECT TO authenticated USING (true);

-- Storage Bucket: email-attachments (private, 25 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-attachments', 'email-attachments', false, 26214400)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, public = EXCLUDED.public;

-- Storage policies: only service role writes; authenticated users read (signed URLs work via service role)
CREATE POLICY "service manage email-attachments"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'email-attachments') WITH CHECK (bucket_id = 'email-attachments');

CREATE POLICY "auth read email-attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'email-attachments');
