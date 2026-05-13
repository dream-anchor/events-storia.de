-- Make migrated Reisegruppen compatible with the existing event_inquiries editor view.
-- The editor view intentionally exposes v2_events only when source_inquiry_id is set.
-- Group inquiries were migrated into v2_events without this compatibility marker.
UPDATE public.v2_events
SET source_inquiry_id = id,
    updated_at = now()
WHERE service_type = 'group'::public.v2_event_service
  AND source_inquiry_id IS NULL;