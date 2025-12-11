-- Add cancellation tracking columns to catering_orders
ALTER TABLE public.catering_orders 
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS lexoffice_credit_note_id text,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;