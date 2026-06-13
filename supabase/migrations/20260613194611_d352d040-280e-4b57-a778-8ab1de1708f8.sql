
-- 1. crm_settings (key/value)
CREATE TABLE public.crm_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_settings TO authenticated;
GRANT ALL ON public.crm_settings TO service_role;

ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Staff can read crm_settings"
ON public.crm_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can write crm_settings"
ON public.crm_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER crm_settings_updated_at
BEFORE UPDATE ON public.crm_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. cost_acceptances
CREATE TABLE public.cost_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  offer_option_id uuid REFERENCES public.v2_offer_options(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_signature','signed','cancelled','expired')),

  -- Signer
  signer_name text,
  signer_email text,
  signer_mobile text,
  signer_company_name text,

  -- Event / Rechnung
  event_company text,
  event_title text,
  event_date date,
  onsite_contact text,
  guest_count integer,
  invoice_company text,
  invoice_street text,
  invoice_zip_city text,
  invoice_reference text,

  -- Pflicht-Checkboxen (5 Felder)
  confirmations jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Beleg / Snapshot
  amount_gross_cents integer,
  currency text NOT NULL DEFAULT 'EUR',
  offer_number text,
  customer_number text,
  offer_date date,
  valid_until date,

  -- eSignatures
  esignatures_contract_id text,
  esignatures_template_id text,
  template_version text,
  sign_page_url text,
  sign_page_url_embedded text,
  mfa_method text DEFAULT 'sms' CHECK (mfa_method IN ('none','sms','photo_id')),

  -- Audit / Referenz
  reference_pdf_name text DEFAULT 'KOSTENÜBERNAHME.pdf',
  reference_pdf_uploaded_at timestamptz,
  document_markdown_snapshot text,

  -- Signiertes PDF
  signed_pdf_storage_path text,
  signed_pdf_sha256 text,
  signed_at timestamptz,

  -- Webhook-Events (append-only)
  webhook_events jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cost_acceptances_inquiry_id_idx ON public.cost_acceptances(inquiry_id);
CREATE INDEX cost_acceptances_contract_id_idx ON public.cost_acceptances(esignatures_contract_id);
CREATE INDEX cost_acceptances_status_idx ON public.cost_acceptances(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_acceptances TO authenticated;
GRANT ALL ON public.cost_acceptances TO service_role;

ALTER TABLE public.cost_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Staff read cost_acceptances"
ON public.cost_acceptances FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin/Staff write cost_acceptances"
ON public.cost_acceptances FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE TRIGGER cost_acceptances_updated_at
BEFORE UPDATE ON public.cost_acceptances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. v2_events Erweiterung
ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS cost_acceptance_id uuid REFERENCES public.cost_acceptances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_after_signature boolean NOT NULL DEFAULT false;
