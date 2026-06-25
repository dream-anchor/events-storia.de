ALTER TABLE public.inbox_emails
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.inbox_emails
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.inbox_emails
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_inbox_emails_tenant
  ON public.inbox_emails (tenant_id);

ALTER TABLE public.email_attachments
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.email_attachments a
  SET tenant_id = e.tenant_id
  FROM public.inbox_emails e
  WHERE a.email_id = e.id AND a.tenant_id IS NULL;
UPDATE public.email_attachments
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.email_attachments
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_email_attachments_tenant
  ON public.email_attachments (tenant_id);

ALTER TABLE public.email_classification_feedback
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.email_classification_feedback f
  SET tenant_id = e.tenant_id
  FROM public.inbox_emails e
  WHERE f.email_id = e.id AND f.tenant_id IS NULL;
UPDATE public.email_classification_feedback
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.email_classification_feedback
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_email_classification_feedback_tenant
  ON public.email_classification_feedback (tenant_id);

ALTER TABLE public.event_email_filters
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.event_email_filters f
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE f.event_id = e.id AND f.tenant_id IS NULL;
UPDATE public.event_email_filters
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.event_email_filters
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_event_email_filters_tenant
  ON public.event_email_filters (tenant_id);

ALTER TABLE public.event_email_links
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.event_email_links l
  SET tenant_id = e.tenant_id
  FROM public.v2_events e
  WHERE l.event_id = e.id AND l.tenant_id IS NULL;
UPDATE public.event_email_links
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
ALTER TABLE public.event_email_links
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_event_email_links_tenant
  ON public.event_email_links (tenant_id);