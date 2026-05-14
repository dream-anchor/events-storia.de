ALTER TABLE public.v2_events
ADD COLUMN IF NOT EXISTS email_content_translations jsonb DEFAULT '{}'::jsonb;