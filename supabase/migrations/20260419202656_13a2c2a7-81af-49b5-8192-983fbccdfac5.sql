-- 1) Add columns to event_inquiries
ALTER TABLE public.event_inquiries
  ADD COLUMN IF NOT EXISTS deposit_due_days integer,
  ADD COLUMN IF NOT EXISTS offer_validity_days integer;

-- deposit_percent already exists with default 20; ensure constraints
DO $$
BEGIN
  -- Constraints (drop & re-create to be idempotent)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'event_inquiries_deposit_percent_chk') THEN
    ALTER TABLE public.event_inquiries DROP CONSTRAINT event_inquiries_deposit_percent_chk;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'event_inquiries_deposit_due_days_chk') THEN
    ALTER TABLE public.event_inquiries DROP CONSTRAINT event_inquiries_deposit_due_days_chk;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'event_inquiries_offer_validity_days_chk') THEN
    ALTER TABLE public.event_inquiries DROP CONSTRAINT event_inquiries_offer_validity_days_chk;
  END IF;
END $$;

ALTER TABLE public.event_inquiries
  ADD CONSTRAINT event_inquiries_deposit_percent_chk CHECK (deposit_percent IS NULL OR (deposit_percent >= 0 AND deposit_percent <= 100)),
  ADD CONSTRAINT event_inquiries_deposit_due_days_chk CHECK (deposit_due_days IS NULL OR deposit_due_days >= 1),
  ADD CONSTRAINT event_inquiries_offer_validity_days_chk CHECK (offer_validity_days IS NULL OR offer_validity_days >= 1);

-- 2) Insert default site_settings row (idempotent)
INSERT INTO public.site_settings (key, value, updated_at)
VALUES (
  'default_payment_terms',
  '{"deposit_percent": 20, "deposit_due_days": 5, "offer_validity_days": 14}'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 3) RLS: allow anon/authenticated to read this single key (public offers need it indirectly, but read is via edge function with service role). Keep current policies; add a permissive read for this key only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Public can read default_payment_terms') THEN
    CREATE POLICY "Public can read default_payment_terms"
      ON public.site_settings
      FOR SELECT
      USING (key = 'default_payment_terms');
  END IF;
END $$;