ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS deposit_method TEXT
    CHECK (deposit_method IS NULL OR deposit_method IN ('none','stripe','on_site','invoice')),
  ADD COLUMN IF NOT EXISTS balance_method TEXT
    CHECK (balance_method IS NULL OR balance_method IN ('stripe_prepay','on_site','invoice_after')),
  ADD COLUMN IF NOT EXISTS balance_due_days_before_event INTEGER
    CHECK (balance_due_days_before_event IS NULL OR balance_due_days_before_event >= 1);

UPDATE public.v2_events SET
  deposit_method = CASE
    WHEN payment_method = 'deposit_online' THEN 'stripe'
    WHEN payment_method = 'prepayment_online' THEN 'none'
    WHEN payment_method = 'on_site' THEN 'none'
    WHEN payment_method = 'invoice_after' THEN 'none'
    ELSE 'none' END,
  balance_method = CASE
    WHEN payment_method = 'deposit_online' THEN 'stripe_prepay'
    WHEN payment_method = 'prepayment_online' THEN 'stripe_prepay'
    WHEN payment_method = 'on_site' THEN 'on_site'
    WHEN payment_method = 'invoice_after' THEN 'invoice_after'
    ELSE 'on_site' END
WHERE deposit_method IS NULL;