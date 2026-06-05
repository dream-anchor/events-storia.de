-- Backfill: aktuelle Anschreiben-Texte aus event_inquiries.email_draft in
-- die jeweils letzte inquiry_offer_history-Version übernehmen, damit die
-- Public-Offer-Seite den aktuellen Stand zeigt (RPC liest latest history first).
UPDATE inquiry_offer_history h
SET email_content = ei.email_draft
FROM event_inquiries ei
WHERE h.inquiry_id = ei.id
  AND ei.email_draft IS NOT NULL
  AND length(btrim(ei.email_draft)) > 0
  AND h.version = (
    SELECT MAX(version) FROM inquiry_offer_history h2 WHERE h2.inquiry_id = ei.id
  )
  AND COALESCE(h.email_content, '') <> COALESCE(ei.email_draft, '');

-- Übersetzungs-Cache leeren, damit EN/IT/FR neu erzeugt werden
UPDATE v2_events SET email_content_translations = '{}'::jsonb
WHERE email_content_translations IS NOT NULL
  AND email_content_translations <> '{}'::jsonb;
