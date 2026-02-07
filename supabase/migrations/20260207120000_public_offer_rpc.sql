-- Public Offer RPC: Returns offer data for the public-facing offer page
-- Uses SECURITY DEFINER to bypass RLS safely.
-- Only returns data for offers that have been sent (status = 'offer_sent' or 'confirmed').
-- Uses status instead of offer_sent_at because offer_sent_at is cleared when creating new versions.
-- The UUID in the URL acts as an implicit access token (unguessable).

CREATE OR REPLACE FUNCTION public.get_public_offer(offer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
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
      'selected_option_id', ei.selected_option_id
    ),
    'options', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', ioo.id,
          'option_label', ioo.option_label,
          'guest_count', ioo.guest_count,
          'menu_selection', ioo.menu_selection,
          'total_amount', ioo.total_amount,
          'stripe_payment_link_url', ioo.stripe_payment_link_url,
          'package_name', COALESCE(p.name, 'Individuelles Paket'),
          'sort_order', ioo.sort_order
        ) ORDER BY ioo.sort_order
      )
      FROM inquiry_offer_options ioo
      LEFT JOIN packages p ON p.id = ioo.package_id
      WHERE ioo.inquiry_id = offer_id
      AND ioo.is_active = true
    ), '[]'::json)
  ) INTO result
  FROM event_inquiries ei
  WHERE ei.id = offer_id
  AND ei.status IN ('offer_sent', 'confirmed');

  RETURN result;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_public_offer(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_offer(uuid) TO authenticated;
