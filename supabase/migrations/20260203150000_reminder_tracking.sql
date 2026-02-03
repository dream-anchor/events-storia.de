-- ============================================
-- ADD REMINDER TRACKING TO EVENT_INQUIRIES
-- ============================================

-- Add reminder tracking columns
ALTER TABLE public.event_inquiries
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Index for finding inquiries that need reminders
CREATE INDEX IF NOT EXISTS idx_event_inquiries_reminder
ON public.event_inquiries(status, offer_sent_at, reminder_count)
WHERE status = 'offer_sent';

-- Comment for documentation
COMMENT ON COLUMN public.event_inquiries.reminder_count IS 'Number of reminder emails sent (0=none, 1=day3, 2=day7)';
COMMENT ON COLUMN public.event_inquiries.reminder_sent_at IS 'Timestamp of last reminder email';
