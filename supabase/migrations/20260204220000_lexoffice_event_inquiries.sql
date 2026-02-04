-- Migration: Add LexOffice fields to event_inquiries
-- This allows linking event inquiries to LexOffice invoices/quotations

-- Add LexOffice columns to event_inquiries
ALTER TABLE event_inquiries
ADD COLUMN IF NOT EXISTS lexoffice_invoice_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lexoffice_document_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lexoffice_contact_id TEXT DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_inquiries_lexoffice
ON event_inquiries (lexoffice_invoice_id)
WHERE lexoffice_invoice_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN event_inquiries.lexoffice_invoice_id IS 'LexOffice document UUID (invoice or quotation)';
COMMENT ON COLUMN event_inquiries.lexoffice_document_type IS 'Type of LexOffice document: invoice or quotation';
COMMENT ON COLUMN event_inquiries.lexoffice_contact_id IS 'LexOffice contact UUID';
