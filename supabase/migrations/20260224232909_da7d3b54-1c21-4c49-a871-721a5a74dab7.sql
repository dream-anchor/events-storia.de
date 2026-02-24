-- Fix: GRANT-Berechtigungen für öffentliche Offer-RPCs sicherstellen
GRANT EXECUTE ON FUNCTION public.get_public_offer(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_offer_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_offer_by_slug(text) TO authenticated;