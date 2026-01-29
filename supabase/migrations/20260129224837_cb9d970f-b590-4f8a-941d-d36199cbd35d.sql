-- Add reference_number column for PO/customer reference
ALTER TABLE public.catering_orders 
ADD COLUMN IF NOT EXISTS reference_number TEXT;