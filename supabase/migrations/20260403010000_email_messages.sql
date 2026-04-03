CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.event_inquiries(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]',
  resend_message_id TEXT,
  resend_status TEXT DEFAULT 'queued',
  in_reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_messages_inquiry ON public.email_messages(inquiry_id);
CREATE INDEX idx_email_messages_resend ON public.email_messages(resend_message_id);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email_messages"
  ON public.email_messages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can insert email_messages"
  ON public.email_messages FOR INSERT
  TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update email_messages"
  ON public.email_messages FOR UPDATE
  TO service_role USING (true);
