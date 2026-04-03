ALTER TABLE public.event_inquiries
  ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('full', 'deposit')),
  ADD COLUMN IF NOT EXISTS deposit_percent INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10,2) DEFAULT 0;
