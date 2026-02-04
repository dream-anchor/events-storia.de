-- Task/Follow-Up System for Event Inquiries
-- Phase 3.1: Workflow Optimization

CREATE TABLE IF NOT EXISTS public.inquiry_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.event_inquiries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  assigned_to TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_inquiry_id
  ON public.inquiry_tasks(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_assigned_to
  ON public.inquiry_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_due_date
  ON public.inquiry_tasks(due_date)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_status
  ON public.inquiry_tasks(status);

-- Enable RLS
ALTER TABLE public.inquiry_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to manage tasks
CREATE POLICY "Authenticated users can manage tasks"
  ON public.inquiry_tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE public.inquiry_tasks IS 'Tasks and follow-ups for event inquiries';
COMMENT ON COLUMN public.inquiry_tasks.inquiry_id IS 'Optional link to an inquiry (can be null for general tasks)';
COMMENT ON COLUMN public.inquiry_tasks.title IS 'Task title (e.g., "Follow up call", "Send updated offer")';
COMMENT ON COLUMN public.inquiry_tasks.due_date IS 'When the task should be completed';
COMMENT ON COLUMN public.inquiry_tasks.assigned_to IS 'Email of the team member responsible';
COMMENT ON COLUMN public.inquiry_tasks.status IS 'Task status: pending, completed, cancelled';
COMMENT ON COLUMN public.inquiry_tasks.priority IS 'Task priority: normal, high, urgent';
