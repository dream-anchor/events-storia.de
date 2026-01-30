-- Add editor tracking columns to event_inquiries
ALTER TABLE public.event_inquiries
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS offer_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS offer_sent_by UUID REFERENCES auth.users(id);

-- Create index for faster filtering by editor status
CREATE INDEX IF NOT EXISTS idx_event_inquiries_last_edited_at 
ON public.event_inquiries(last_edited_at);

CREATE INDEX IF NOT EXISTS idx_event_inquiries_offer_sent_at 
ON public.event_inquiries(offer_sent_at);

-- Add comment for documentation
COMMENT ON COLUMN public.event_inquiries.last_edited_by IS 'UUID of admin who last edited this inquiry';
COMMENT ON COLUMN public.event_inquiries.last_edited_at IS 'Timestamp of last edit by any admin';
COMMENT ON COLUMN public.event_inquiries.offer_sent_at IS 'Timestamp when offer was finalized and sent';
COMMENT ON COLUMN public.event_inquiries.offer_sent_by IS 'UUID of admin who sent the offer';