ALTER TABLE public.v2_customers
  ADD COLUMN IF NOT EXISTS account_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_invited_by text,
  ADD COLUMN IF NOT EXISTS account_activated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_v2_customers_account_invited_at ON public.v2_customers(account_invited_at);