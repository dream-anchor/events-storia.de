
CREATE TABLE public.review_request_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT true,
  delay_business_days integer NOT NULL DEFAULT 2,
  google_review_url text NOT NULL DEFAULT 'https://g.page/r/CXkUzxdBpyWjEBM/review',
  bcc_email text NOT NULL DEFAULT 'info@events-storia.de',
  scope_events boolean NOT NULL DEFAULT true,
  scope_orders boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_sent_count integer DEFAULT 0,
  last_run_skipped_count integer DEFAULT 0,
  last_run_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.review_request_settings TO authenticated;
GRANT ALL ON public.review_request_settings TO service_role;

ALTER TABLE public.review_request_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read review settings"
  ON public.review_request_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE POLICY "Admins can update review settings"
  ON public.review_request_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.review_request_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.review_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.v2_events(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('event','order','manual_test')),
  recipient_email text NOT NULL,
  recipient_name text,
  language text DEFAULT 'de',
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped_suppressed','skipped_unsubscribed','dry_run')),
  provider text,
  message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX review_request_log_event_unique
  ON public.review_request_log(event_id)
  WHERE event_id IS NOT NULL AND status IN ('sent','failed');

CREATE INDEX review_request_log_sent_at_idx ON public.review_request_log(sent_at DESC);

GRANT SELECT ON public.review_request_log TO authenticated;
GRANT ALL ON public.review_request_log TO service_role;

ALTER TABLE public.review_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read review log"
  ON public.review_request_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE TABLE public.review_request_unsubscribes (
  email text PRIMARY KEY,
  unsubscribed_at timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'footer_link'
);

GRANT SELECT ON public.review_request_unsubscribes TO authenticated;
GRANT ALL ON public.review_request_unsubscribes TO service_role;

ALTER TABLE public.review_request_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read unsubscribes"
  ON public.review_request_unsubscribes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
