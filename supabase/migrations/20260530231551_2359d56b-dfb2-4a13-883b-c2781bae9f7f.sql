ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS invoice_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_email_sent_by UUID;