ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS final_lexoffice_invoice_id text,
  ADD COLUMN IF NOT EXISTS final_lexoffice_invoice_number text;