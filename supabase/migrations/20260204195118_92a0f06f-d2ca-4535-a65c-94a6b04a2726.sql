-- 1. Assignment & Priority für event_inquiries
ALTER TABLE public.event_inquiries
ADD COLUMN IF NOT EXISTS assigned_to TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_by TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_event_inquiries_assigned_to ON public.event_inquiries(assigned_to);
CREATE INDEX IF NOT EXISTS idx_event_inquiries_priority ON public.event_inquiries(priority);

-- 2. Inquiry Comments Tabelle
CREATE TABLE IF NOT EXISTS public.inquiry_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.event_inquiries(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.inquiry_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_comments_inquiry_id ON public.inquiry_comments(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_comments_parent_id ON public.inquiry_comments(parent_id);

ALTER TABLE public.inquiry_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage inquiry_comments"
  ON public.inquiry_comments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Inquiry Tasks Tabelle
CREATE TABLE IF NOT EXISTS public.inquiry_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.event_inquiries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_inquiry_id ON public.inquiry_tasks(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_assigned_to ON public.inquiry_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_due_date ON public.inquiry_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_status ON public.inquiry_tasks(status);

ALTER TABLE public.inquiry_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage inquiry_tasks"
  ON public.inquiry_tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));