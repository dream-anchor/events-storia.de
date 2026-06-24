
-- Remove legacy tables from realtime publication (anyone authenticated could subscribe)
ALTER PUBLICATION supabase_realtime DROP TABLE public._legacy_catering_orders;
ALTER PUBLICATION supabase_realtime DROP TABLE public._legacy_event_inquiries;
ALTER PUBLICATION supabase_realtime DROP TABLE public._legacy_event_bookings;
ALTER PUBLICATION supabase_realtime DROP TABLE public._legacy_group_inquiries;

-- balance_payment_links: Replace open SELECT policy with security-definer RPC
DROP POLICY IF EXISTS "Anyone can read active balance_payment_links" ON public.balance_payment_links;
REVOKE SELECT ON public.balance_payment_links FROM anon;

CREATE OR REPLACE FUNCTION public.get_balance_payment_link_by_slug(p_slug text)
RETURNS public.balance_payment_links
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.balance_payment_links
  WHERE slug = p_slug AND active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_balance_payment_link_by_slug(text) TO anon, authenticated;
