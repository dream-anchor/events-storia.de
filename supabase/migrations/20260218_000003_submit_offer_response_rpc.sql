-- ============================================================
-- Migration: submit_offer_response RPC
-- Erlaubt dem Kunden (anon), auf einen Vorschlag zu antworten:
--   - Wählt eine Option aus
--   - Schreibt optionale Anmerkungen
--   - Aktualisiert offer_phase → 'customer_responded'
-- SECURITY DEFINER nötig, weil anon kein UPDATE auf event_inquiries hat
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_offer_response(
  p_inquiry_id uuid,
  p_selected_option_id uuid DEFAULT NULL,
  p_customer_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prüfe ob Anfrage existiert und im richtigen Status ist
  IF NOT EXISTS (
    SELECT 1 FROM event_inquiries
    WHERE id = p_inquiry_id
    AND offer_phase = 'proposal_sent'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Angebot nicht gefunden oder bereits beantwortet'
    );
  END IF;

  -- Prüfe ob die gewählte Option zur Anfrage gehört (wenn angegeben)
  IF p_selected_option_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM inquiry_offer_options
    WHERE id = p_selected_option_id
    AND inquiry_id = p_inquiry_id
    AND is_active = true
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ungültige Option'
    );
  END IF;

  -- Kunden-Antwort speichern
  INSERT INTO offer_customer_responses (
    inquiry_id,
    selected_option_id,
    customer_notes
  ) VALUES (
    p_inquiry_id,
    p_selected_option_id,
    p_customer_notes
  );

  -- Anfrage-Status aktualisieren
  UPDATE event_inquiries SET
    offer_phase = 'customer_responded',
    selected_option_id = COALESCE(p_selected_option_id, selected_option_id),
    updated_at = now()
  WHERE id = p_inquiry_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Beide Rollen dürfen die Funktion aufrufen
GRANT EXECUTE ON FUNCTION public.submit_offer_response(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_offer_response(uuid, uuid, text) TO authenticated;
