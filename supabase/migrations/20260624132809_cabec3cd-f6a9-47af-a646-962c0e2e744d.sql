
-- 1) Konfigurations-Tabelle
CREATE TABLE public.data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL UNIQUE,
  description text NOT NULL,
  soft_delete_after_days integer,
  hard_delete_after_days integer,
  enabled boolean NOT NULL DEFAULT false,
  dry_run boolean NOT NULL DEFAULT true,
  batch_limit integer NOT NULL DEFAULT 100,
  last_run_at timestamptz,
  last_run_mode text,
  last_run_candidate_count integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_retention_policies TO authenticated;
GRANT ALL ON public.data_retention_policies TO service_role;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage retention policies" ON public.data_retention_policies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff read retention policies" ON public.data_retention_policies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));
CREATE TRIGGER trg_data_retention_policies_updated_at
  BEFORE UPDATE ON public.data_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Audit-Tabelle
CREATE TABLE public.data_purge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid REFERENCES public.data_retention_policies(id) ON DELETE SET NULL,
  scope text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dry','soft','hard')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  candidate_count integer NOT NULL DEFAULT 0,
  affected_count integer NOT NULL DEFAULT 0,
  candidate_ids jsonb,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','aborted')),
  error_message text,
  triggered_by text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.data_purge_audit TO authenticated;
GRANT ALL ON public.data_purge_audit TO service_role;
ALTER TABLE public.data_purge_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read purge audit" ON public.data_purge_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write purge audit" ON public.data_purge_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_data_purge_audit_scope_started ON public.data_purge_audit(scope, started_at DESC);

-- 3) Candidate-Views (read-only, harte Ausschlüsse)

-- 3a) Nicht-konvertierte Anfragen
CREATE OR REPLACE VIEW public.v_purge_candidates_inquiry
WITH (security_invoker = true) AS
SELECT
  e.id AS event_id, e.customer_id, e.status, e.service_type, e.source,
  e.created_at, e.updated_at,
  EXTRACT(DAY FROM (now() - e.created_at))::integer AS age_days
FROM public.v2_events e
WHERE e.status::text IN ('inquiry','offer_draft','offer_sent','offer_declined','cancelled')
  AND e.invoice_lexoffice_id IS NULL
  AND COALESCE(e.archived, false) = false
  AND NOT EXISTS (SELECT 1 FROM public.v2_payments p WHERE p.event_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM public.balance_payment_links b WHERE b.event_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM public.cost_acceptances c WHERE c.inquiry_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM public._legacy_event_payments lp WHERE lp.inquiry_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM public._legacy_catering_orders lc WHERE lc.id = e.id);

-- 3b) E-Mail-Delivery-Logs (operativ, ohne Bezug zu Zahlungen)
CREATE OR REPLACE VIEW public.v_purge_candidates_email_logs
WITH (security_invoker = true) AS
SELECT
  edl.id, edl.entity_type, edl.entity_id, edl.created_at,
  EXTRACT(DAY FROM (now() - edl.created_at))::integer AS age_days
FROM public.email_delivery_logs edl
WHERE NOT EXISTS (
  SELECT 1 FROM public.v2_payments p
  WHERE p.event_id::text = edl.entity_id::text
)
AND NOT EXISTS (
  SELECT 1 FROM public._legacy_event_payments lp
  WHERE lp.inquiry_id::text = edl.entity_id::text
);

-- 3c) Inquiry-Attachments (an purge-fähige Inquiry gebunden)
CREATE OR REPLACE VIEW public.v_purge_candidates_attachments
WITH (security_invoker = true) AS
SELECT
  a.id, a.inquiry_id, a.storage_bucket, a.storage_path, a.created_at,
  EXTRACT(DAY FROM (now() - a.created_at))::integer AS age_days
FROM public.inquiry_attachments a
WHERE EXISTS (
  SELECT 1 FROM public.v_purge_candidates_inquiry c WHERE c.event_id = a.inquiry_id
);

-- 3d) AI-Conversations (operative Daten, nicht an konvertierte Buchung gebunden)
CREATE OR REPLACE VIEW public.v_purge_candidates_ai_conversations
WITH (security_invoker = true) AS
SELECT
  ac.id, ac.inquiry_id, ac.customer_email, ac.created_at,
  EXTRACT(DAY FROM (now() - ac.created_at))::integer AS age_days
FROM public.ai_conversations ac
WHERE ac.inquiry_id IS NULL
   OR EXISTS (SELECT 1 FROM public.v_purge_candidates_inquiry c WHERE c.event_id = ac.inquiry_id);

-- 4) Default-Scopes (alle disabled, Fristen NULL → DSB/GF Freigabe ausstehend)
INSERT INTO public.data_retention_policies
  (scope, description, soft_delete_after_days, hard_delete_after_days, enabled, dry_run, notes)
VALUES
  ('inquiry_non_converted',
   'Nicht-konvertierte Anfragen (inquiry/offer_draft/offer_sent/declined/cancelled, ohne Zahlung/LexOffice)',
   NULL, NULL, false, true, 'Fristen ausstehend – Freigabe Speranza GmbH / DSB'),
  ('inquiry_declined',
   'Abgelehnte Angebote (offer_declined, ohne Zahlung)',
   NULL, NULL, false, true, 'Fristen ausstehend – DSB'),
  ('email_delivery_logs',
   'Operative E-Mail-Versand-Logs ohne Bezug zu Zahlungen',
   NULL, NULL, false, true, 'Fristen ausstehend'),
  ('inquiry_attachments',
   'Anhänge zu purge-fähigen Anfragen (DB + Storage)',
   NULL, NULL, false, true, 'Storage-Sync erforderlich'),
  ('ai_conversations',
   'AI-Konversationen (operative Daten)',
   NULL, NULL, false, true, 'Fristen ausstehend'),
  ('inbox_emails_unlinked',
   'Eingehende E-Mails ohne Verknüpfung zu konvertierter Buchung',
   NULL, NULL, false, true, 'Separater Job geplant');
