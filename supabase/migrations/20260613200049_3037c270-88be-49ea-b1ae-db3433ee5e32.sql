ALTER TABLE public.cost_acceptances
  DROP CONSTRAINT IF EXISTS cost_acceptances_status_check;

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
    'declined'::text,
    'withdrawn'::text,
    'cancelled'::text,
    'expired'::text,
    'error'::text
  ]));