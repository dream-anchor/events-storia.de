
CREATE TABLE public.balance_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  event_label text NOT NULL,
  event_label_en text,
  price_per_person_cents integer NOT NULL CHECK (price_per_person_cents > 0),
  deposit_paid_cents integer NOT NULL DEFAULT 0 CHECK (deposit_paid_cents >= 0),
  min_guests integer NOT NULL DEFAULT 1 CHECK (min_guests >= 1),
  max_guests integer NOT NULL DEFAULT 500 CHECK (max_guests >= 1),
  default_guests integer NOT NULL CHECK (default_guests >= 1),
  customer_email text NOT NULL,
  customer_name text,
  event_id uuid,
  event_date date,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_balance_payment_links_slug ON public.balance_payment_links(slug);

ALTER TABLE public.balance_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage balance_payment_links"
  ON public.balance_payment_links FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff manage balance_payment_links"
  ON public.balance_payment_links FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Anyone can read active balance_payment_links"
  ON public.balance_payment_links FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE TRIGGER update_balance_payment_links_updated_at
  BEFORE UPDATE ON public.balance_payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
