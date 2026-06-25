ALTER TABLE public.v2_offer_options
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.v2_offer_options c
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE c.event_id = e.id AND c.tenant_id IS NULL;
UPDATE public.v2_offer_options
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.v2_offer_options
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_v2_offer_options_tenant
  ON public.v2_offer_options (tenant_id);

ALTER TABLE public.v2_payments
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.v2_payments c
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE c.event_id = e.id AND c.tenant_id IS NULL;
UPDATE public.v2_payments
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.v2_payments
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_v2_payments_tenant
  ON public.v2_payments (tenant_id);

ALTER TABLE public.v2_event_changelog
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.v2_event_changelog c
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE c.event_id = e.id AND c.tenant_id IS NULL;
UPDATE public.v2_event_changelog
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.v2_event_changelog
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_v2_event_changelog_tenant
  ON public.v2_event_changelog (tenant_id);

ALTER TABLE public.v2_event_comments
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.v2_event_comments c
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE c.event_id = e.id AND c.tenant_id IS NULL;
UPDATE public.v2_event_comments
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.v2_event_comments
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_v2_event_comments_tenant
  ON public.v2_event_comments (tenant_id);

ALTER TABLE public.v2_event_tasks
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.v2_event_tasks c
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE c.event_id = e.id AND c.tenant_id IS NULL;
UPDATE public.v2_event_tasks
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.v2_event_tasks
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_v2_event_tasks_tenant
  ON public.v2_event_tasks (tenant_id);

ALTER TABLE public.v2_event_offer_history
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.v2_event_offer_history c
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE c.event_id = e.id AND c.tenant_id IS NULL;
UPDATE public.v2_event_offer_history
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.v2_event_offer_history
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_v2_event_offer_history_tenant
  ON public.v2_event_offer_history (tenant_id);

ALTER TABLE public.v2_event_emails
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.v2_event_emails c
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE c.event_id = e.id AND c.tenant_id IS NULL;
UPDATE public.v2_event_emails
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.v2_event_emails
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_v2_event_emails_tenant
  ON public.v2_event_emails (tenant_id);