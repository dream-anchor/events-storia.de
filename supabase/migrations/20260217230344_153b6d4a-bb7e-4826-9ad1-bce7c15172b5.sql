-- Migration 1: offer_phase, offer_mode, customer_responses table, pricing extensions

-- offer_phase auf event_inquiries (default 'draft' = unsichtbar für altes System)
ALTER TABLE event_inquiries
  ADD COLUMN IF NOT EXISTS offer_phase text DEFAULT 'draft';

-- offer_mode auf inquiry_offer_options (default 'fest_menu' = bisheriges Verhalten)
ALTER TABLE inquiry_offer_options
  ADD COLUMN IF NOT EXISTS offer_mode text DEFAULT 'fest_menu';

-- Kunden-Feedback Tabelle
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

ALTER TABLE offer_customer_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_response" ON offer_customer_responses
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "admin_select_responses" ON offer_customer_responses
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_responses_inquiry
  ON offer_customer_responses(inquiry_id);

-- Pricing-Erweiterung auf packages
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'per_person',
  ADD COLUMN IF NOT EXISTS pricing_tiers jsonb DEFAULT null;

-- Migration 2: Extended get_public_offer RPC
CREATE OR REPLACE FUNCTION public.get_public_offer(offer_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'inquiry', json_build_object(
      'id', ei.id,
      'company_name', ei.company_name,
      'contact_name', ei.contact_name,
      'event_type', ei.event_type,
      'preferred_date', ei.preferred_date,
      'guest_count', ei.guest_count,
      'status', ei.status,
      'offer_phase', COALESCE(ei.offer_phase, 'draft'),
      'selected_option_id', ei.selected_option_id
    ),
    'options', COALESCE((
      SELECT json_agg(json_build_object(
        'id', ioo.id,
        'option_label', ioo.option_label,
        'offer_mode', COALESCE(ioo.offer_mode, 'fest_menu'),
        'guest_count', ioo.guest_count,
        'menu_selection', ioo.menu_selection,
        'total_amount', ioo.total_amount,
        'stripe_payment_link_url', ioo.stripe_payment_link_url,
        'package_name', COALESCE(p.name, 'Individuelles Paket'),
        'sort_order', ioo.sort_order
      ) ORDER BY ioo.sort_order)
      FROM inquiry_offer_options ioo
      LEFT JOIN packages p ON p.id = ioo.package_id
      WHERE ioo.inquiry_id = offer_id AND ioo.is_active = true
    ), '[]'::json),
    'customer_response', (
      SELECT json_build_object(
        'id', cr.id,
        'selected_option_id', cr.selected_option_id,
        'customer_notes', cr.customer_notes,
        'responded_at', cr.responded_at
      )
      FROM offer_customer_responses cr
      WHERE cr.inquiry_id = offer_id
      ORDER BY cr.responded_at DESC LIMIT 1
    )
  ) INTO result
  FROM event_inquiries ei
  WHERE ei.id = offer_id AND ei.status IN ('offer_sent', 'confirmed');
  RETURN result;
END; $$;

-- Migration 3: submit_offer_response RPC
CREATE OR REPLACE FUNCTION public.submit_offer_response(
  p_inquiry_id uuid, p_selected_option_id uuid, p_customer_notes text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM event_inquiries WHERE id = p_inquiry_id AND offer_phase = 'proposal_sent') THEN
    RETURN json_build_object('success', false, 'error', 'Angebot nicht gefunden');
  END IF;
  INSERT INTO offer_customer_responses (inquiry_id, selected_option_id, customer_notes)
  VALUES (p_inquiry_id, p_selected_option_id, p_customer_notes);
  UPDATE event_inquiries SET offer_phase = 'customer_responded', selected_option_id = p_selected_option_id, updated_at = now()
  WHERE id = p_inquiry_id;
  RETURN json_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_offer_response(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_offer_response(uuid, uuid, text) TO authenticated;