-- Create email_delivery_logs table
CREATE TABLE public.email_delivery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'event_inquiry', 'catering_order', 'event_booking'
  entity_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'ionos_smtp', 'resend'
  provider_message_id TEXT, -- Message-ID from provider
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  sent_by TEXT, -- Admin email who triggered the send
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for fast lookups by entity
CREATE INDEX idx_email_delivery_logs_entity ON public.email_delivery_logs(entity_type, entity_id);
CREATE INDEX idx_email_delivery_logs_sent_at ON public.email_delivery_logs(sent_at DESC);

-- Enable RLS
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "Admins can view email logs"
ON public.email_delivery_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert email logs (via edge functions with service role)
CREATE POLICY "Admins can insert email logs"
ON public.email_delivery_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role to insert (for edge functions)
CREATE POLICY "Service role can insert email logs"
ON public.email_delivery_logs
FOR INSERT
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role');