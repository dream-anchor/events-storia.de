-- Migration: Add archive functionality to event_inquiries
-- This allows marking inquiries as "completed/archived" while preserving their original status

-- Add archived_at and archived_by columns to event_inquiries
ALTER TABLE event_inquiries
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;

-- Create index for faster archive filtering
CREATE INDEX IF NOT EXISTS idx_event_inquiries_archived
ON event_inquiries (archived_at)
WHERE archived_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN event_inquiries.archived_at IS 'Timestamp when inquiry was archived/marked as completed';
COMMENT ON COLUMN event_inquiries.archived_by IS 'Email of user who archived the inquiry';