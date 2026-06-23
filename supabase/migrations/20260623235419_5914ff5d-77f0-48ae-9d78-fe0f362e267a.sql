
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 1000 AND amount_cents <= 50000),
  currency text NOT NULL DEFAULT 'eur',
  purchaser_email text NOT NULL,
  purchaser_name text,
  recipient_email text,
  recipient_name text,
  message text,
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','redeemed','cancelled')),
  lexoffice_invoice_id text,
  pdf_url text,
  valid_until date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by_admin uuid REFERENCES auth.users(id),
  notes text
);

CREATE INDEX vouchers_status_idx ON public.vouchers(status);
CREATE INDEX vouchers_purchaser_email_idx ON public.vouchers(purchaser_email);
CREATE INDEX vouchers_stripe_session_idx ON public.vouchers(stripe_session_id);

GRANT ALL ON public.vouchers TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.vouchers TO authenticated;

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all vouchers"
  ON public.vouchers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update vouchers"
  ON public.vouchers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
