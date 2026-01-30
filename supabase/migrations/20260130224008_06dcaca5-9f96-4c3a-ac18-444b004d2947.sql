-- Change editor tracking columns from UUID to TEXT to store email addresses for human-readable display
-- First drop the foreign key constraints
ALTER TABLE public.event_inquiries 
DROP CONSTRAINT IF EXISTS event_inquiries_last_edited_by_fkey,
DROP CONSTRAINT IF EXISTS event_inquiries_offer_sent_by_fkey;

-- Change column types from UUID to TEXT
ALTER TABLE public.event_inquiries 
ALTER COLUMN last_edited_by TYPE TEXT USING last_edited_by::TEXT,
ALTER COLUMN offer_sent_by TYPE TEXT USING offer_sent_by::TEXT;