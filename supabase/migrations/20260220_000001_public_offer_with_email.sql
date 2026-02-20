-- Erweitert get_public_offer RPC um email_content (Anschreiben)
-- Quelle: inquiry_offer_history.email_content (gesendete Version) mit Fallback auf event_inquiries.email_draft

CREATE OR REPLACE FUNCTION public.get_public_offer(offer_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'inquiry', json_build_object(
      'id', ei.id,
      'company_name', ei.company_name,
      'contact_name', ei.contact_name,
      'email', ei.email,
      'event_type', ei.event_type,
      'preferred_date', ei.preferred_date,
      'guest_count', ei.guest_count,
      'status', ei.status,
      'offer_phase', COALESCE(ei.offer_phase, 'draft'),
      'selected_option_id', ei.selected_option_id,
      'email_content', COALESCE(
        (SELECT ioh.email_content
         FROM inquiry_offer_history ioh
         WHERE ioh.inquiry_id = offer_id
         ORDER BY ioh.version DESC
         LIMIT 1),
        ei.email_draft
      )
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
        'package_name', CASE WHEN ioo.offer_mode = 'menu' THEN 'Individuelles Menü' ELSE COALESCE(p.name, 'Individuelles Paket') END,
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
  WHERE ei.id = offer_id
  AND (
    ei.status IN ('offer_sent', 'confirmed')
    OR ei.offer_phase IN ('draft', 'proposal_sent', 'customer_responded', 'final_draft', 'final_sent', 'confirmed', 'paid')
  );
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_offer(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_offer(uuid) TO authenticated;
