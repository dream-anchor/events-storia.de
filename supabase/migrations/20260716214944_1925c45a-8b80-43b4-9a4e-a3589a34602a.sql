-- ─── MAESTRO Handoff Outbox ─────────────────────────────────────────
-- Additive Tabelle für die Übergabe von v1-Bestell-/Zahlungsereignissen an
-- MAESTRO 2.0. Zugriff nur über service_role (Edge Functions).

CREATE TABLE public.maestro_handoff_outbox (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_event_id    text NOT NULL UNIQUE,
  source_system        text NOT NULL DEFAULT 'events-storia-v1',
  source_order_id      text NOT NULL,
  payload              jsonb NOT NULL,
  raw_body             text  NOT NULL,
  payload_hash         text  NOT NULL,
  status               text  NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','processing','sent','retry','failed','conflict')),
  attempt_count        integer NOT NULL DEFAULT 0,
  next_attempt_at      timestamptz NOT NULL DEFAULT now(),
  last_attempt_at      timestamptz,
  last_error           text,
  maestro_event_id     text,
  maestro_payment_id   text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz
);

CREATE INDEX idx_maestro_handoff_due
  ON public.maestro_handoff_outbox (status, next_attempt_at)
  WHERE status IN ('pending','retry');

CREATE INDEX idx_maestro_handoff_status
  ON public.maestro_handoff_outbox (status);

-- Reaper-Index: haengende 'processing'-Zeilen nach Lease-Timeout wiederfinden.
CREATE INDEX idx_maestro_handoff_processing
  ON public.maestro_handoff_outbox (last_attempt_at)
  WHERE status = 'processing';

-- Rechte: NUR service_role. Kein authenticated/anon-Zugriff.
GRANT ALL ON public.maestro_handoff_outbox TO service_role;

ALTER TABLE public.maestro_handoff_outbox ENABLE ROW LEVEL SECURITY;

-- Explizit alle Zugriffe für Endnutzer sperren (defense in depth).
CREATE POLICY "no_client_access_maestro_handoff_outbox"
  ON public.maestro_handoff_outbox
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ─── Atomarer Claim für den Cron-Zusteller ──────────────────────────
-- SECURITY DEFINER + FOR UPDATE SKIP LOCKED. Parallele Cron-Aufrufe
-- können dieselbe Zeile niemals gleichzeitig zustellen.
CREATE OR REPLACE FUNCTION public.claim_maestro_handoffs(batch_size integer)
RETURNS TABLE (
  id                uuid,
  delivery_event_id text,
  raw_body          text,
  attempt_count     integer
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
            -- Processing-Recovery (Lease-Timeout / Reaper): stuerzt ein Worker NACH dem Claim
            -- (status='processing'), aber VOR dem Abschluss (sent/retry/failed) ab, wird die Zeile
            -- nach 5 min Lease automatisch wieder aufgenommen. attempt_count wurde beim Claim bereits
            -- erhoeht -> MAX_ATTEMPTS begrenzt die Gesamtversuche weiterhin. 5 min > jede normale
            -- Zustelldauer, damit eine noch laufende Zustellung nicht doppelt geclaimt wird.
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
  RETURNING o.id, o.delivery_event_id, o.raw_body, o.attempt_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_maestro_handoffs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_maestro_handoffs(integer) TO service_role;

-- Hinweis: Der pg_cron-Job wird über public.insert (NICHT hier)
-- eingerichtet, weil er das Cron-Secret aus dem Vault liest — analog
-- zu run_retention_purge.