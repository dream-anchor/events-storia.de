-- Add LexOffice integration columns to event_bookings (analog to catering_orders)
ALTER TABLE public.event_bookings 
ADD COLUMN IF NOT EXISTS lexoffice_invoice_id text,
ADD COLUMN IF NOT EXISTS lexoffice_document_type text,
ADD COLUMN IF NOT EXISTS lexoffice_contact_id text;