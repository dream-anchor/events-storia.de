
-- =========================================================================
-- /anfrage Funnel — additive Migration
-- =========================================================================

-- ---------- leads_funnel ----------
CREATE TABLE IF NOT EXISTS public.leads_funnel (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Step 0: Routing
  intent              TEXT NOT NULL CHECK (intent IN ('inhouse','delivery','consult')),

  -- Step 1: Anlass + Personen
  occasion            TEXT NOT NULL CHECK (occasion IN (
                        'geburtstag','firmenfeier','hochzeit',
                        'weihnachtsfeier','privat','sonstiges'
                      )),
  occasion_other      TEXT,
  people_bucket       TEXT NOT NULL CHECK (people_bucket IN (
                        '2-10','11-25','26-50','51-100','100+'
                      )),

  -- Step 2: Datum
  date_mode           TEXT NOT NULL CHECK (date_mode IN ('fixed','flexible','open')),
  date_value          DATE,
  date_range_start    DATE,
  date_range_end      DATE,

  -- Step 3: Format (konditional aus intent, NULL bei consult)
  format              TEXT,

  -- Step 4: Kontakt
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  notes               TEXT,
  gdpr_consent        BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_consent_at     TIMESTAMPTZ,

  -- Scoring + Status
  lead_score          INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  status              TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                        'new','contacted','qualified','converted','lost'
                      )),

  -- Tracking
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,
  utm_term            TEXT,
  utm_content         TEXT,
  source_url          TEXT,

  -- Notification idempotency
  notified_at         TIMESTAMPTZ
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_leads_funnel_created_at ON public.leads_funnel (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_funnel_status     ON public.leads_funnel (status);
CREATE INDEX IF NOT EXISTS idx_leads_funnel_email      ON public.leads_funnel (email);
CREATE INDEX IF NOT EXISTS idx_leads_funnel_score      ON public.leads_funnel (lead_score DESC);

-- updated_at Trigger (nutzt vorhandene Funktion update_updated_at_column)
DROP TRIGGER IF EXISTS trg_leads_funnel_updated_at ON public.leads_funnel;
CREATE TRIGGER trg_leads_funnel_updated_at
BEFORE UPDATE ON public.leads_funnel
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.leads_funnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert leads_funnel"
ON public.leads_funnel FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view leads_funnel"
ON public.leads_funnel FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view leads_funnel"
ON public.leads_funnel FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins can update leads_funnel"
ON public.leads_funnel FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can update leads_funnel"
ON public.leads_funnel FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'staff'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins can delete leads_funnel"
ON public.leads_funnel FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages leads_funnel"
ON public.leads_funnel FOR ALL
TO service_role
USING (true) WITH CHECK (true);


-- ---------- lead_notify_failures ----------
CREATE TABLE IF NOT EXISTS public.lead_notify_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads_funnel(id) ON DELETE CASCADE,
  step            TEXT NOT NULL CHECK (step IN ('auto_reply','internal_mail','slack')),
  error_message   TEXT,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lead_notify_failures_lead     ON public.lead_notify_failures (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notify_failures_unresolved
  ON public.lead_notify_failures (attempted_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.lead_notify_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view lead_notify_failures"
ON public.lead_notify_failures FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view lead_notify_failures"
ON public.lead_notify_failures FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins can update lead_notify_failures"
ON public.lead_notify_failures FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages lead_notify_failures"
ON public.lead_notify_failures FOR ALL
TO service_role
USING (true) WITH CHECK (true);
