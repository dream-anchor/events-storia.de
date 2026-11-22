-- Entfernungs-Cache für Lieferangebote (OpenRouteService-Kontingent schonen; Angebot ist öffentlich aufrufbar).
-- Nur die Edge Functions (service_role) lesen/schreiben; RLS aktiv ohne Policy = für anon/authenticated komplett gesperrt.
-- Rein additiv. Die Functions arbeiten auch ohne diese Tabelle (Fehler werden ignoriert), Reihenfolge beim Einspielen egal.
CREATE TABLE IF NOT EXISTS public.delivery_distance_cache (
  address_key text PRIMARY KEY,
  km numeric NOT NULL CHECK (km >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_distance_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_distance_cache FROM anon, authenticated;
GRANT ALL ON public.delivery_distance_cache TO service_role;
CREATE INDEX IF NOT EXISTS idx_delivery_distance_cache_created ON public.delivery_distance_cache (created_at);
-- Rollback: DROP TABLE public.delivery_distance_cache;
