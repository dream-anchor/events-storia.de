-- event_payments: Freie Anzahlungen & Vorauszahlungen pro Anfrage
-- Alle Zahlungen laufen über Stripe Checkout (Billie + Karte + SEPA)

CREATE TABLE IF NOT EXISTS public.event_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.event_inquiries(id) ON DELETE CASCADE,

  -- Typ
  payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'prepayment', 'final')),

  -- Betrag (frei eingegeben, in Cent)
  amount_cents INTEGER NOT NULL,

  -- Fälligkeit (entweder konkretes Datum ODER berechnet aus event_date - X Tage)
  due_date DATE,
  due_days_before_event INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')),

  -- Stripe
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_payment_link_url TEXT,
  paid_at TIMESTAMPTZ,
  paid_via TEXT,

  -- LexOffice (optional)
  lexoffice_invoice_id TEXT,
  lexoffice_invoice_number TEXT,

  -- E-Mail
  email_sent_at TIMESTAMPTZ,
  email_resend_id TEXT,
  reminder_sent_at TIMESTAMPTZ,

  -- Meta
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_payments_inquiry ON public.event_payments(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_event_payments_status ON public.event_payments(status)
  WHERE status IN ('sent', 'overdue');

-- View: Fälligkeitsdatum berechnet aus preferred_date - due_days_before_event
CREATE OR REPLACE VIEW public.event_payments_enriched AS
SELECT
  ep.*,
  COALESCE(
    ep.due_date,
    CASE
      WHEN ep.due_days_before_event IS NOT NULL AND ei.preferred_date IS NOT NULL
      THEN (ei.preferred_date::date - (ep.due_days_before_event || ' days')::interval)::date
      ELSE NULL
    END
  ) AS effective_due_date,
  CASE
    WHEN ep.status = 'paid' THEN 'paid'
    WHEN ep.status = 'sent' AND COALESCE(
      ep.due_date,
      CASE
        WHEN ep.due_days_before_event IS NOT NULL AND ei.preferred_date IS NOT NULL
        THEN (ei.preferred_date::date - (ep.due_days_before_event || ' days')::interval)::date
        ELSE NULL
      END
    ) < CURRENT_DATE THEN 'overdue'
    ELSE ep.status
  END AS computed_status,
  ei.preferred_date,
  ei.contact_name,
  ei.email AS customer_email,
  ei.guest_count,
  ei.event_type
FROM public.event_payments ep
JOIN public.event_inquiries ei ON ei.id = ep.inquiry_id;

-- RLS
ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage event_payments"
  ON public.event_payments FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage event_payments"
  ON public.event_payments FOR ALL
  TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.event_payments_enriched TO authenticated;
GRANT SELECT ON public.event_payments_enriched TO service_role;

-- Täglicher Cron-Job: überfällige Zahlungen markieren (09:00 UTC)
-- Voraussetzung: pg_cron Extension muss aktiviert sein
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'mark-overdue-event-payments',
      '0 9 * * *',
      $$
        UPDATE public.event_payments ep
        SET status = 'overdue', updated_at = now()
        FROM public.event_inquiries ei
        WHERE ep.inquiry_id = ei.id
          AND ep.status = 'sent'
          AND COALESCE(
            ep.due_date,
            CASE
              WHEN ep.due_days_before_event IS NOT NULL AND ei.preferred_date IS NOT NULL
              THEN (ei.preferred_date::date - (ep.due_days_before_event || ' days')::interval)::date
              ELSE NULL
            END
          ) < CURRENT_DATE;
      $$
    );
  END IF;
END;
$$;
