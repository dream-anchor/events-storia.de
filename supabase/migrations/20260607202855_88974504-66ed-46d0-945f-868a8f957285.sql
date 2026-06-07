ALTER TABLE public.v2_events DROP CONSTRAINT IF EXISTS v2_events_balance_method_check;
ALTER TABLE public.v2_events ADD CONSTRAINT v2_events_balance_method_check
  CHECK (balance_method IS NULL OR balance_method = ANY (ARRAY['stripe_prepay'::text, 'on_site'::text, 'invoice_after'::text, 'invoice_before'::text]));