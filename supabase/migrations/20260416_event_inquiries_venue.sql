-- Migration: Location-Feld für Event-Anfragen
--
-- Problem: Das UI in EventDNACard.tsx hat ein "Location"-Feld (onChange → 'venue'),
-- aber die Spalte existierte nicht in event_inquiries. Dadurch schlug jedes Save
-- fehl mit "column does not exist" und der Fehler-Toast blieb endlos sichtbar.
--
-- Fix: Die venue-Spalte hinzufügen. Das Feld ist ein einfacher Freitext-String
-- (Veranstaltungsort oder Adresse — je nach Event-Typ).

ALTER TABLE public.event_inquiries
  ADD COLUMN IF NOT EXISTS venue text;

COMMENT ON COLUMN public.event_inquiries.venue IS
  'Veranstaltungsort / Location des Events (Freitext, z.B. "Ristorante Storia" oder eine Adresse).';
