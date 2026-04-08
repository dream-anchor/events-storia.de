ALTER TABLE public.event_inquiries
ADD COLUMN IF NOT EXISTS event_end_date DATE;

COMMENT ON COLUMN public.event_inquiries.event_end_date
IS 'Optional end date for multi-day events';