-- =====================================================================
-- Conversion-Tracking Anfrage -> Buchung (Maestro)
-- =====================================================================
-- Liefert die Datengrundlage, damit der Betreiber im Admin sehen kann,
-- wie viele Anfragen zu (bezahlten) Buchungen werden und WO der Funnel
-- leckt. Drei Bausteine:
--   1. Offer-View-Tracking (offer_first_viewed_at, offer_last_viewed_at,
--      offer_view_count) + anon-RPC track_offer_view()
--   2. Verlust-Grund (loss_reason, loss_reason_note) bei declined/cancelled
--   3. Auto-Changelog-Trigger: jeder Status-Wechsel auf v2_events landet
--      automatisch in v2_event_changelog -> Zeit-pro-Stufe & Drop-off messbar
-- Additiv und idempotent. Fasst die drei konkurrierenden event_inquiries-
-- Writer NICHT an (siehe docs/maestro/INVARIANTS.md §1.4).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Neue Spalten auf v2_events
-- ---------------------------------------------------------------------
ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS offer_first_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_last_viewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS offer_view_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loss_reason           text,
  ADD COLUMN IF NOT EXISTS loss_reason_note      text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'v2_events_loss_reason_check'
  ) THEN
    ALTER TABLE public.v2_events
      ADD CONSTRAINT v2_events_loss_reason_check
      CHECK (loss_reason IS NULL OR loss_reason IN (
        'too_expensive','date_unavailable','no_response',
        'booked_elsewhere','plan_cancelled','not_qualified','other'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.v2_events.offer_view_count IS 'Anzahl Aufrufe der oeffentlichen Angebotsseite (PublicOffer)';
COMMENT ON COLUMN public.v2_events.loss_reason IS 'Grund bei offer_declined/cancelled/no_response (Pflicht-Dropdown im Admin)';

-- ---------------------------------------------------------------------
-- 2. Offer-View-Tracking: anon-RPC (PublicOffer pingt beim Oeffnen)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_offer_view(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.v2_events
     SET offer_view_count      = COALESCE(offer_view_count, 0) + 1,
         offer_first_viewed_at = COALESCE(offer_first_viewed_at, now()),
         offer_last_viewed_at  = now()
   WHERE offer_slug = p_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_offer_view(text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_offer_view(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Auto-Changelog-Trigger fuer Status-Wechsel
-- ---------------------------------------------------------------------
-- BEFORE UPDATE: bei Status-Wechsel status_changed_at setzen und einen
-- Changelog-Eintrag schreiben (source='trigger'). So entsteht ab sofort
-- eine lueckenlose Status-Historie, ohne dass die App etwas tun muss.
CREATE OR REPLACE FUNCTION public.v2_events_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
    INSERT INTO public.v2_event_changelog (event_id, field, old_value, new_value, changed_by, source)
    VALUES (
      NEW.id,
      'status',
      OLD.status::text,
      NEW.status::text,
      COALESCE(NEW.last_edited_by, NEW.assigned_to, 'system'),
      'trigger'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v2_events_log_status_change ON public.v2_events;
CREATE TRIGGER trg_v2_events_log_status_change
  BEFORE UPDATE OF status ON public.v2_events
  FOR EACH ROW
  EXECUTE FUNCTION public.v2_events_log_status_change();

-- ---------------------------------------------------------------------
-- 4. Backfill: Baseline-Eintrag pro Event (aktueller Status)
-- ---------------------------------------------------------------------
-- Vergangene Uebergaenge sind nicht rekonstruierbar; wir setzen pro Event
-- einen Anker mit dem aktuellen Status, damit Analytics ab heute eine
-- Startlinie hat. Nur fuer Events ohne bisherigen Status-Changelog.
INSERT INTO public.v2_event_changelog (event_id, field, old_value, new_value, changed_by, changed_at, source)
SELECT e.id, 'status', NULL, e.status::text, 'system',
       COALESCE(e.status_changed_at, e.created_at), 'trigger'
FROM public.v2_events e
WHERE NOT EXISTS (
  SELECT 1 FROM public.v2_event_changelog c
  WHERE c.event_id = e.id AND c.field = 'status'
);
