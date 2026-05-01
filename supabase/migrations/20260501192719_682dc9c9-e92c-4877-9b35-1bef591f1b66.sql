
-- Add payment_method column to event inquiries
ALTER TABLE public._legacy_event_inquiries
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'deposit_online';

-- Add invoice_due_days for invoice-after-event payment method
ALTER TABLE public._legacy_event_inquiries
ADD COLUMN IF NOT EXISTS invoice_due_days integer DEFAULT NULL;
