-- Add columns for payment tracking and LexOffice document type
ALTER TABLE catering_orders 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'invoice',
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS lexoffice_document_type text;