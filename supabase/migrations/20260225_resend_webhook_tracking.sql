-- Resend Webhook Delivery-Tracking
-- Erlaubt Updates auf email_delivery_logs durch Resend-Webhooks (via service_role)

-- UPDATE-Policy für service_role
CREATE POLICY "Service role can update email logs"
ON public.email_delivery_logs
FOR UPDATE
USING (
  ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'
)
WITH CHECK (
  ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'
);

-- Index für schnelle Webhook-Lookups per provider_message_id
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_message_id
  ON public.email_delivery_logs(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
