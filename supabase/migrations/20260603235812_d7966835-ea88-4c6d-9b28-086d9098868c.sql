
ALTER TABLE public.v2_payments
  ADD COLUMN IF NOT EXISTS lexoffice_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lexoffice_remote_version INT,
  ADD COLUMN IF NOT EXISTS lexoffice_remote_status TEXT,
  ADD COLUMN IF NOT EXISTS lexoffice_remote_total_cents INT,
  ADD COLUMN IF NOT EXISTS lexoffice_sync_conflict BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lexoffice_conflict_details JSONB;

CREATE INDEX IF NOT EXISTS idx_v2_payments_lexoffice_invoice_id
  ON public.v2_payments(lexoffice_invoice_id)
  WHERE lexoffice_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lexoffice_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lexoffice_invoice_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  conflict BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  v2_payment_id UUID REFERENCES public.v2_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lexoffice_sync_log_invoice
  ON public.lexoffice_sync_log(lexoffice_invoice_id, created_at DESC);

GRANT SELECT ON public.lexoffice_sync_log TO authenticated;
GRANT ALL ON public.lexoffice_sync_log TO service_role;

ALTER TABLE public.lexoffice_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can view sync log"
  ON public.lexoffice_sync_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );
