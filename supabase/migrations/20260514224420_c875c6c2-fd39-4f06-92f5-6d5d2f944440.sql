ALTER TABLE public.leads_funnel
  ADD COLUMN IF NOT EXISTS event_inquiry_id uuid;

CREATE INDEX IF NOT EXISTS idx_leads_funnel_event_inquiry_id
  ON public.leads_funnel(event_inquiry_id);