-- Add internal notes field for staff communication
ALTER TABLE public.catering_orders 
ADD COLUMN IF NOT EXISTS internal_notes text;

-- Add comment for documentation
COMMENT ON COLUMN public.catering_orders.internal_notes IS 'Internal notes for staff - not visible to customers';