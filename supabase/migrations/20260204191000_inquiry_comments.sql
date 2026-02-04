-- Threaded Comments for Event Inquiries
-- Phase 2.3: Team Collaboration Features

CREATE TABLE IF NOT EXISTS public.inquiry_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.event_inquiries(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.inquiry_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inquiry_comments_inquiry_id
  ON public.inquiry_comments(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_inquiry_comments_parent_id
  ON public.inquiry_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_inquiry_comments_created_at
  ON public.inquiry_comments(created_at DESC);

-- RLS Policies
ALTER TABLE public.inquiry_comments ENABLE ROW LEVEL SECURITY;

-- Only admins can view comments
CREATE POLICY "Admins can view inquiry comments"
  ON public.inquiry_comments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can create comments
CREATE POLICY "Admins can create inquiry comments"
  ON public.inquiry_comments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update their own comments
CREATE POLICY "Admins can update own comments"
  ON public.inquiry_comments FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    author_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can delete their own comments
CREATE POLICY "Admins can delete own comments"
  ON public.inquiry_comments FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    author_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Comments
COMMENT ON TABLE public.inquiry_comments IS 'Threaded comments on event inquiries for team collaboration';
COMMENT ON COLUMN public.inquiry_comments.parent_id IS 'Reference to parent comment for threading (NULL = root comment)';
