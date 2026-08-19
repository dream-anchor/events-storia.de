ALTER TABLE public.v2_payments
  ADD COLUMN IF NOT EXISTS guests_charged integer,
  ADD COLUMN IF NOT EXISTS price_per_person_cents integer,
  ADD COLUMN IF NOT EXISTS lexoffice_credit_note_id text,
  ADD COLUMN IF NOT EXISTS lexoffice_credit_note_number text,
  ADD COLUMN IF NOT EXISTS parent_payment_id uuid REFERENCES public.v2_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;

ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS guests_quoted integer,
  ADD COLUMN IF NOT EXISTS guests_confirmed integer,
  ADD COLUMN IF NOT EXISTS guest_delta_settled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.v2_guest_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.v2_payments(id) ON DELETE SET NULL,
  guests_before integer NOT NULL DEFAULT 0,
  guests_after integer NOT NULL DEFAULT 0,
  delta_guests integer NOT NULL DEFAULT 0,
  price_per_person_cents integer NOT NULL DEFAULT 0,
  delta_amount_cents integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'note_only',
  status text NOT NULL DEFAULT 'open',
  lexoffice_invoice_id text,
  lexoffice_invoice_number text,
  lexoffice_credit_note_id text,
  lexoffice_credit_note_number text,
  stripe_refund_id text,
  stripe_session_id text,
  notes text,
  settled_at timestamptz,
  created_by uuid,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS v2_guest_adjustments_session_uidx
  ON public.v2_guest_adjustments (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS v2_guest_adjustments_event_idx
  ON public.v2_guest_adjustments (event_id);
CREATE INDEX IF NOT EXISTS v2_guest_adjustments_status_idx
  ON public.v2_guest_adjustments (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_guest_adjustments TO authenticated;
GRANT ALL ON public.v2_guest_adjustments TO service_role;

ALTER TABLE public.v2_guest_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage v2_guest_adjustments"
  ON public.v2_guest_adjustments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can manage v2_guest_adjustments"
  ON public.v2_guest_adjustments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER update_v2_guest_adjustments_updated_at
  BEFORE UPDATE ON public.v2_guest_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();