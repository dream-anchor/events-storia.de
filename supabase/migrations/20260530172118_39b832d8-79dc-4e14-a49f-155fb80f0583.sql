ALTER TABLE public.v2_offer_options
  ADD COLUMN IF NOT EXISTS post_acceptance_adjustment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adjustment_reason text,
  ADD COLUMN IF NOT EXISTS adjusted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS adjusted_by_email text;