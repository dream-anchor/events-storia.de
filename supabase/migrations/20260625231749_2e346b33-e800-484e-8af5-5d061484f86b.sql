ALTER TABLE public._legacy_event_inquiries
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_event_inquiries SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_event_inquiries
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_event_inquiries_tenant ON public._legacy_event_inquiries (tenant_id);

ALTER TABLE public._legacy_event_bookings
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_event_bookings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_event_bookings
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_event_bookings_tenant ON public._legacy_event_bookings (tenant_id);

ALTER TABLE public._legacy_catering_orders
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_catering_orders SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_catering_orders
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_catering_orders_tenant ON public._legacy_catering_orders (tenant_id);

ALTER TABLE public._legacy_customer_profiles
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_customer_profiles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_customer_profiles
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_customer_profiles_tenant ON public._legacy_customer_profiles (tenant_id);

ALTER TABLE public._legacy_event_payments
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_event_payments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_event_payments
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_event_payments_tenant ON public._legacy_event_payments (tenant_id);

ALTER TABLE public._legacy_group_inquiries
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_group_inquiries SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_group_inquiries
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_group_inquiries_tenant ON public._legacy_group_inquiries (tenant_id);

ALTER TABLE public._legacy_inquiry_comments
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_inquiry_comments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_inquiry_comments
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_inquiry_comments_tenant ON public._legacy_inquiry_comments (tenant_id);

ALTER TABLE public._legacy_inquiry_tasks
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_inquiry_tasks SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_inquiry_tasks
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_inquiry_tasks_tenant ON public._legacy_inquiry_tasks (tenant_id);

ALTER TABLE public._legacy_inquiry_offer_options
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_inquiry_offer_options SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_inquiry_offer_options
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_inquiry_offer_options_tenant ON public._legacy_inquiry_offer_options (tenant_id);

ALTER TABLE public._legacy_inquiry_offer_history
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_inquiry_offer_history SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_inquiry_offer_history
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_inquiry_offer_history_tenant ON public._legacy_inquiry_offer_history (tenant_id);

ALTER TABLE public._legacy_offer_customer_responses
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_offer_customer_responses SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_offer_customer_responses
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_offer_customer_responses_tenant ON public._legacy_offer_customer_responses (tenant_id);

ALTER TABLE public._legacy_email_messages
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public._legacy_email_messages SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public._legacy_email_messages
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_legacy_email_messages_tenant ON public._legacy_email_messages (tenant_id);