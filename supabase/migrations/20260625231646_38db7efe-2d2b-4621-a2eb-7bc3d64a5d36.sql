ALTER TABLE public.cost_acceptances
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.cost_acceptances c
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE c.inquiry_id = e.id AND c.tenant_id IS NULL;
UPDATE public.cost_acceptances
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.cost_acceptances
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_cost_acceptances_tenant
  ON public.cost_acceptances (tenant_id);

ALTER TABLE public.review_request_log
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.review_request_log r
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE r.event_id = e.id AND r.tenant_id IS NULL;
UPDATE public.review_request_log
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.review_request_log
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_review_request_log_tenant
  ON public.review_request_log (tenant_id);

ALTER TABLE public.leads_funnel
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.leads_funnel
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.leads_funnel
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_leads_funnel_tenant
  ON public.leads_funnel (tenant_id);

ALTER TABLE public.lead_notify_failures
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.lead_notify_failures f
  SET tenant_id = l.tenant_id
  FROM public.leads_funnel l
  WHERE f.lead_id = l.id AND f.tenant_id IS NULL;
UPDATE public.lead_notify_failures
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.lead_notify_failures
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_lead_notify_failures_tenant
  ON public.lead_notify_failures (tenant_id);

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.ai_conversations
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.ai_conversations
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant
  ON public.ai_conversations (tenant_id);

ALTER TABLE public.ai_extractions
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.ai_extractions x
  SET tenant_id = c.tenant_id
  FROM public.ai_conversations c
  WHERE x.conversation_id = c.id AND x.tenant_id IS NULL;
UPDATE public.ai_extractions
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.ai_extractions
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_ai_extractions_tenant
  ON public.ai_extractions (tenant_id);

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.ai_messages m
  SET tenant_id = c.tenant_id
  FROM public.ai_conversations c
  WHERE m.conversation_id = c.id AND m.tenant_id IS NULL;
UPDATE public.ai_messages
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.ai_messages
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant
  ON public.ai_messages (tenant_id);

ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.vouchers
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.vouchers
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant
  ON public.vouchers (tenant_id);