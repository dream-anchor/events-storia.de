CREATE OR REPLACE FUNCTION public.set_maestro_cron_secret(p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_secret IS NULL OR length(p_secret) = 0 THEN
    RAISE EXCEPTION 'secret must not be empty';
  END IF;
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'maestro_handoff_cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_secret, 'maestro_handoff_cron_secret');
  ELSE
    PERFORM vault.update_secret(v_id, p_secret, 'maestro_handoff_cron_secret');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_maestro_cron_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_maestro_cron_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_maestro_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'maestro_handoff_cron_secret';
$$;

REVOKE ALL ON FUNCTION public.get_maestro_cron_secret() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_maestro_cron_secret() TO service_role;