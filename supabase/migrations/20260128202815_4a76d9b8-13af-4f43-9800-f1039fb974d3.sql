-- Add new columns to packages table for event-specific logic
ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS requires_prepayment boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS prepayment_percentage integer DEFAULT 100;