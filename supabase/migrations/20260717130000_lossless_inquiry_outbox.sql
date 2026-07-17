-- =============================================================================
-- Lossless-Intake-Core (Teil 2, v1-Seite): Website-Anfragen laufen ueber die
-- BESTEHENDE maestro_handoff_outbox nach MAESTRO 2.0.
--
-- Befund: ALLE aktiven Anfragewege beider Websites enden heute in einem
-- INSERT INTO public.v2_events (Kontakt-/Paketformular + AI via
-- receive-event-inquiry -> View event_inquiries -> INSTEAD OF-Trigger;
-- Reisegruppen via receive-group-inquiry[-webhook]). Ein einziger
-- AFTER INSERT-Trigger auf v2_events macht daher JEDE Anfrage verlustfrei:
-- Quell-Insert und Outbox-Enqueue liegen in DERSELBEN Transaktion.
--
-- Bewusst KEIN Feature-Flag im Trigger: Enqueue ist billig und verlustfrei;
-- MAESTRO_HANDOFF_ENABLED gated nur den VERSAND im Worker. Solange der Versand
-- deaktiviert ist, sammeln sich pending-Zeilen und werden bei Aktivierung
-- nachgeliefert - nichts geht verloren.
--
-- Rein additiv + idempotent (mehrfach anwendbar). Shop-/Payment-Verhalten
-- unveraendert: bestehende Zeilen erhalten kind='shop_order' per Default.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Routing-Diskriminator: der Worker sendet 'inquiry'-Zeilen an MAESTRO_INQUIRY_URL,
--    alles andere weiter an MAESTRO_SHOP_ORDER_URL.
ALTER TABLE public.maestro_handoff_outbox
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'shop_order';
ALTER TABLE public.maestro_handoff_outbox
  DROP CONSTRAINT IF EXISTS maestro_handoff_outbox_kind_check;
ALTER TABLE public.maestro_handoff_outbox
  ADD CONSTRAINT maestro_handoff_outbox_kind_check CHECK (kind IN ('shop_order','inquiry'));

-- 2) claim_maestro_handoffs: Rueckgabe um kind erweitert (der Worker braucht das
--    Routing-Ziel). Rueckgabetyp-Aenderung erfordert DROP+CREATE. Verhalten identisch
--    zum Stand von fix/maestro-handoff-recovery-and-refund inkl. Processing-Reaper
--    (Lease-Timeout 5 min: nach Worker-Absturz zwischen Claim und Abschluss wird die
--    Zeile automatisch wieder aufgenommen; attempt_count begrenzt weiterhin ueber
--    MAX_ATTEMPTS).
DROP FUNCTION IF EXISTS public.claim_maestro_handoffs(integer);
CREATE FUNCTION public.claim_maestro_handoffs(batch_size integer)
RETURNS TABLE (
  id                uuid,
  delivery_event_id text,
  raw_body          text,
  attempt_count     integer,
  kind              text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
    FROM public.maestro_handoff_outbox o
    WHERE (
            (o.status IN ('pending','retry') AND o.next_attempt_at <= now())
            OR (o.status = 'processing' AND o.last_attempt_at < now() - interval '5 minutes')
          )
    ORDER BY o.next_attempt_at
    FOR UPDATE SKIP LOCKED
    LIMIT COALESCE(batch_size, 20)
  )
  UPDATE public.maestro_handoff_outbox o
     SET status          = 'processing',
         attempt_count   = o.attempt_count + 1,
         last_attempt_at = now()
   FROM claimed c
  WHERE o.id = c.id
  RETURNING o.id, o.delivery_event_id, o.raw_body, o.attempt_count, o.kind;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_maestro_handoffs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_maestro_handoffs(integer) TO service_role;

-- 3) Enqueue-Trigger: jede neue Anfrage (v2_events, status='inquiry', kein Test)
--    atomar in die Outbox. Payload = exakt der Vertrag von MAESTRO
--    POST /api/webhooks/inquiry; raw_body wird HIER eingefroren, damit jeder
--    Retry byte-identisch sendet (stabiler payload_hash, saubere Idempotenz).
--    Feld-Caps entsprechen den zod-Limits der MAESTRO-Route, damit kein
--    v1-Datensatz die Zustellung dauerhaft in 422 treibt.
CREATE OR REPLACE FUNCTION public.enqueue_v2_event_inquiry_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_cust record;
  v_row jsonb;
  v_source text;
  v_detail text;
  v_email text;
  v_details jsonb;
  v_inquiry jsonb;
  v_payload jsonb;
  v_raw text;
BEGIN
  SELECT name, email, phone, company INTO v_cust
    FROM public.v2_customers WHERE id = NEW.customer_id;
  -- Defensive: ohne Kundenname kein gueltiger Vertrag (customerName ist Pflicht).
  -- Sollte durch v2_customers.name NOT NULL nie eintreten.
  IF v_cust.name IS NULL OR btrim(v_cust.name) = '' THEN
    RETURN NEW;
  END IF;

  -- Optionale Spalten robust ueber to_jsonb lesen (Spalte fehlt -> NULL, kein Fehler).
  v_row := to_jsonb(NEW);

  v_source := CASE NEW.source::text
    WHEN 'email_inbound' THEN 'email'
    WHEN 'email_forward' THEN 'email'
    WHEN 'phone'         THEN 'phone'
    WHEN 'manual'        THEN 'manual'
    ELSE 'form'
  END;
  v_detail := CASE NEW.source::text
    WHEN 'reisegruppen'  THEN 'ristorante_reisegruppen'
    WHEN 'catering_form' THEN 'catering_form'
    WHEN 'website'       THEN 'events_website'
    ELSE NEW.source::text
  END;

  -- E-Mail nur mitgeben, wenn plausibel (zod .email() ist strikt).
  v_email := lower(btrim(coalesce(v_cust.email, '')));
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    v_email := NULL;
  END IF;

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'v2Status',      NEW.status::text,
    'v2Source',      NEW.source::text,
    'serviceType',   v_row->>'service_type',
    'arrivalTime',   v_row->>'arrival_time',
    'preferredMenu', v_row->>'preferred_menu',
    'dateFlexible',  v_row->'preferred_date_flexible',
    'timeSlot',      v_row->>'time_slot',
    'locationType',  v_row->>'location_type'
  ));
  IF v_details = '{}'::jsonb THEN v_details := NULL; END IF;

  v_inquiry := jsonb_strip_nulls(jsonb_build_object(
    'customerName',  left(btrim(v_cust.name), 200),
    'customerEmail', left(v_email, 320),
    'phone',         left(nullif(btrim(coalesce(v_cust.phone, '')), ''), 60),
    'company',       left(coalesce(nullif(btrim(coalesce(v_row->>'company_name', '')), ''),
                                   nullif(btrim(coalesce(v_cust.company, '')), '')), 200),
    'message',       left(nullif(NEW.customer_notes, ''), 5000),
    'guests',        CASE WHEN NEW.guest_count IS NOT NULL AND NEW.guest_count > 0
                          THEN least(NEW.guest_count, 100000) END,
    'eventDate',     NEW.date::text,
    'eventTime',     left(nullif(btrim(coalesce(NEW.event_time, '')), ''), 20),
    'eventType',     left(nullif(btrim(coalesce(NEW.occasion, '')), ''), 120),
    'source',        v_source,
    'sourceDetail',  left(v_detail, 100),
    'language',      left(lower(nullif(btrim(coalesce(v_row->>'language', '')), '')), 8),
    'details',       v_details
  ));

  v_payload := jsonb_build_object(
    'deliveryEventId',  'inquiry_' || NEW.id,
    'sourceSystem',     'events-storia-v1',
    'sourceRecordType', 'v2_events',
    'sourceRecordId',   NEW.id::text,
    'inquiry',          v_inquiry
  );
  v_raw := v_payload::text;

  INSERT INTO public.maestro_handoff_outbox
      (delivery_event_id, kind, source_system, source_order_id,
       payload, raw_body, payload_hash, status)
    VALUES
      ('inquiry_' || NEW.id, 'inquiry', 'events-storia-v1', NEW.id::text,
       v_payload, v_raw, encode(digest(v_raw, 'sha256'), 'hex'), 'pending')
    ON CONFLICT (delivery_event_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_v2_event_inquiry_handoff() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_v2_events_maestro_inquiry_enqueue ON public.v2_events;
CREATE TRIGGER tg_v2_events_maestro_inquiry_enqueue
  AFTER INSERT ON public.v2_events
  FOR EACH ROW
  WHEN (NEW.status = 'inquiry'::v2_event_status AND COALESCE(NEW.is_test, false) = false)
  EXECUTE FUNCTION public.enqueue_v2_event_inquiry_handoff();

-- Diagnose/Reconciliation (read-only, dokumentiert): Anfragen ohne Outbox-Zeile.
--   SELECT ev.id, ev.created_at FROM public.v2_events ev
--   LEFT JOIN public.maestro_handoff_outbox o ON o.delivery_event_id = 'inquiry_' || ev.id
--   WHERE ev.status = 'inquiry' AND COALESCE(ev.is_test,false) = false
--     AND ev.created_at >= '<AKTIVIERUNGS-WASSERSTAND>' AND o.id IS NULL;
