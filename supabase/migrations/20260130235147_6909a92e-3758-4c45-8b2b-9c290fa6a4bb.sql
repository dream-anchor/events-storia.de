-- Repariere alle Anfragen, die Einträge in der History haben, aber nicht als 'offer_sent' markiert sind
UPDATE event_inquiries
SET status = 'offer_sent'
WHERE status NOT IN ('confirmed', 'declined')
AND id IN (
  SELECT DISTINCT inquiry_id FROM inquiry_offer_history
);