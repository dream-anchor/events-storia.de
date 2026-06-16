-- Additive Erweiterung public.cost_acceptances:
-- Versand-, Fehler-, PDF-Pending- und Retry-Felder + Status signed_pending_pdf

ALTER TABLE public.cost_acceptances
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to text,
  ADD COLUMN IF NOT EXISTS sent_message_id text,
  ADD COLUMN IF NOT EXISTS send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_send_error text,
  ADD COLUMN IF NOT EXISTS last_send_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contract_error text,
  ADD COLUMN IF NOT EXISTS last_webhook_error text,
  ADD COLUMN IF NOT EXISTS signed_pdf_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_download_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pdf_download_last_error text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

-- Status-Constraint: bestehende Constraint(s) sauber finden und ersetzen.
-- Bestehende erlaubte Stati bleiben erhalten, signed_pending_pdf wird ergänzt.
DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.cost_acceptances'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.cost_acceptances DROP CONSTRAINT %I', v_conname);
  END LOOP;
END $$;

ALTER TABLE public.cost_acceptances
  ADD CONSTRAINT cost_acceptances_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'pending_signature'::text,
    'signature_started'::text,
    'sent'::text,
    'viewed'::text,
    'signer_signed'::text,
    'signed'::text,
    'signed_pending_pdf'::text,
    'declined'::text,
    'withdrawn'::text,
    'cancelled'::text,
    'expired'::text,
    'error'::text
  ]));

-- Indizes
CREATE INDEX IF NOT EXISTS cost_acceptances_sent_at_idx
  ON public.cost_acceptances (sent_at);

CREATE INDEX IF NOT EXISTS cost_acceptances_status_sent_at_idx
  ON public.cost_acceptances (status, sent_at);

CREATE INDEX IF NOT EXISTS cost_acceptances_signed_pdf_pending_idx
  ON public.cost_acceptances (signed_pdf_pending)
  WHERE signed_pdf_pending = true;
