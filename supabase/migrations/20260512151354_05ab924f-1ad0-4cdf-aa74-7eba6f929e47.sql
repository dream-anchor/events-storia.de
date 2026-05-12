-- 1) Orphan-Archivierungen aufräumen: archived_at gesetzt, aber archived = false → nicht archiviert
UPDATE public.v2_events
SET archived_at = NULL, archived_by = NULL
WHERE (archived IS NULL OR archived = false) AND archived_at IS NOT NULL;

-- 2) Alte "offer_chosen"-Events mit Veranstaltungsdatum in der Vergangenheit auf "completed" setzen,
--    damit der Status mit dem Anzeige-Bucket übereinstimmt
UPDATE public.v2_events
SET status = 'completed', updated_at = now()
WHERE status = 'offer_chosen' AND date IS NOT NULL AND date < CURRENT_DATE;