-- Add Lexoffice integration columns to catering_orders
ALTER TABLE public.catering_orders 
ADD COLUMN IF NOT EXISTS lexoffice_invoice_id text,
ADD COLUMN IF NOT EXISTS lexoffice_contact_id text;