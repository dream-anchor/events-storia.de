-- Entfernungs-Cache und globales ORS-Tagesbudget für Lieferangebote (OpenRouteService-Kontingent schonen; das Angebot ist öffentlich).
-- Nur die Edge Functions (service_role) lesen/schreiben; RLS aktiv ohne Policy = für anon/authenticated komplett gesperrt.
-- DSGVO: Der Schlüssel ist sha256(Pepper | normalisierte Adresse) (Pepper = Secret DISTANCE_CACHE_PEPPER), keine Klartext-Adresse;
-- ohne Secret wird nur im Speicher gecacht. Einträge > 30 Tage löscht die Function beim Schreiben (opportunistisch, kein pg_cron nötig).
-- Rein additiv. Die Functions arbeiten auch ohne diese Objekte (Fehler werden ignoriert, Rückfall auf Speicher-Cache/-Budget).
CREATE TABLE IF NOT EXISTS public.delivery_distance_cache (
  address_key text PRIMARY KEY,
  km numeric NOT NULL CHECK (km >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_distance_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_distance_cache FROM anon, authenticated;
GRANT ALL ON public.delivery_distance_cache TO service_role;
CREATE INDEX IF NOT EXISTS idx_delivery_distance_cache_created ON public.delivery_distance_cache (created_at);

CREATE TABLE IF NOT EXISTS public.ors_usage (
  day date PRIMARY KEY,
  calls integer NOT NULL DEFAULT 0
);
ALTER TABLE public.ors_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ors_usage FROM anon, authenticated;
GRANT ALL ON public.ors_usage TO service_role;

-- Atomar: zählt p_calls zum heutigen Tag, solange das Limit nicht überschritten wird. true = erlaubt.
CREATE OR REPLACE FUNCTION public.ors_take_budget(p_calls integer, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_calls integer;
BEGIN
  INSERT INTO public.ors_usage (day, calls) VALUES (current_date, p_calls)
  ON CONFLICT (day) DO UPDATE SET calls = public.ors_usage.calls + EXCLUDED.calls
    WHERE public.ors_usage.calls + EXCLUDED.calls <= p_limit
  RETURNING calls INTO v_calls;
  RETURN v_calls IS NOT NULL AND v_calls <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.ors_take_budget(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ors_take_budget(integer, integer) TO service_role;
-- Rollback: DROP FUNCTION public.ors_take_budget(integer, integer); DROP TABLE public.ors_usage, public.delivery_distance_cache;
