
CREATE TABLE public.group_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  group_size integer NOT NULL,
  preferred_date date,
  preferred_date_flexible boolean DEFAULT false,
  arrival_time text,
  preferred_menu text,
  message text,
  language text DEFAULT 'de',
  source text DEFAULT 'ristorantestoria.de/reisegruppen',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'confirmed', 'cancelled')),
  internal_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_group_inquiries_status ON public.group_inquiries (status);
CREATE INDEX idx_group_inquiries_date ON public.group_inquiries (preferred_date);
CREATE INDEX idx_group_inquiries_created ON public.group_inquiries (created_at DESC);

ALTER TABLE public.group_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access group_inquiries"
  ON public.group_inquiries FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon insert group_inquiries"
  ON public.group_inquiries FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access group_inquiries"
  ON public.group_inquiries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
