
ALTER TABLE public.event_inquiries ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;
ALTER TABLE public.catering_orders ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_event_inquiries_is_test ON public.event_inquiries (is_test) WHERE is_test = true;
CREATE INDEX IF NOT EXISTS idx_catering_orders_is_test ON public.catering_orders (is_test) WHERE is_test = true;

UPDATE event_inquiries SET is_test = true WHERE LOWER(contact_name) LIKE '%test%' OR LOWER(company_name) LIKE '%test%' OR LOWER(email) LIKE '%test%';
UPDATE catering_orders SET is_test = true WHERE LOWER(customer_name) LIKE '%test%' OR LOWER(customer_email) LIKE '%test%';
