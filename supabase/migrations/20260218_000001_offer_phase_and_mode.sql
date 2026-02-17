-- ============================================================
-- Migration: offer_phase, offer_mode, offer_customer_responses
-- Nicht-brechende Additions für den 2-Phasen-Angebots-Flow
-- ============================================================

-- 1. offer_phase auf event_inquiries
--    Granularer Status-Flow: draft → proposal_sent → customer_responded → final_sent → confirmed
--    Default 'draft' = unsichtbar für bestehendes System
ALTER TABLE event_inquiries
  ADD COLUMN IF NOT EXISTS offer_phase text DEFAULT 'draft';

-- 2. offer_mode auf inquiry_offer_options
--    Angebotsmodus: a_la_carte / teil_menu / fest_menu
--    Default 'fest_menu' = bisheriges Verhalten (voller Menü-Wizard)
ALTER TABLE inquiry_offer_options
  ADD COLUMN IF NOT EXISTS offer_mode text DEFAULT 'fest_menu';

-- 3. Kunden-Feedback Tabelle
--    Speichert die Antwort des Kunden auf einen Vorschlag (Phase 1)
CREATE TABLE IF NOT EXISTS offer_customer_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES event_inquiries(id) ON DELETE CASCADE,
  selected_option_id uuid REFERENCES inquiry_offer_options(id),
  customer_notes text,
  responded_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- RLS: Kunde kann Feedback geben (INSERT), nur Admin kann lesen (SELECT)
ALTER TABLE offer_customer_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_response" ON offer_customer_responses
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "authenticated_insert_response" ON offer_customer_responses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin_select_responses" ON offer_customer_responses
  FOR SELECT TO authenticated USING (true);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_customer_responses_inquiry
  ON offer_customer_responses(inquiry_id);

-- 4. Pricing-Erweiterung auf packages (für spätere DB-basierte Preislogik)
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'per_person',
  ADD COLUMN IF NOT EXISTS pricing_tiers jsonb DEFAULT null;
