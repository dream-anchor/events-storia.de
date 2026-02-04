-- Add assignment and priority fields to event_inquiries
-- Phase 2: Team Collaboration Features

-- Assignment fields
ALTER TABLE public.event_inquiries
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by TEXT;

-- Priority field
ALTER TABLE public.event_inquiries
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_event_inquiries_assigned_to
  ON public.event_inquiries(assigned_to);

CREATE INDEX IF NOT EXISTS idx_event_inquiries_priority
  ON public.event_inquiries(priority);

-- Add comment for documentation
COMMENT ON COLUMN public.event_inquiries.assigned_to IS 'Email of the team member assigned to this inquiry';
COMMENT ON COLUMN public.event_inquiries.assigned_at IS 'Timestamp when the inquiry was assigned';
COMMENT ON COLUMN public.event_inquiries.assigned_by IS 'Email of the team member who made the assignment';
COMMENT ON COLUMN public.event_inquiries.priority IS 'Priority level: normal, high, urgent';
