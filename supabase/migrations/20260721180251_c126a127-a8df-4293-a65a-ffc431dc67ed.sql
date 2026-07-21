ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS cost_acceptance_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_acceptance_requested_at timestamptz;