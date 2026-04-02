-- Add reminder_sent flag to inquiry_tasks for daily reminder cron job
ALTER TABLE public.inquiry_tasks
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
