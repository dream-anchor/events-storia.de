
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Vault-Secret speichern (idempotent)
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'PURGE_CRON_SECRET';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret('9HACKUK5QiibYZ2_VdAaXcj655-qE1MinizTY9fIrRhO1fbdgAxsV1wRDmpzxupo', 'PURGE_CRON_SECRET');
  ELSE
    PERFORM vault.update_secret(v_id, '9HACKUK5QiibYZ2_VdAaXcj655-qE1MinizTY9fIrRhO1fbdgAxsV1wRDmpzxupo');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.run_retention_purge()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_secret text;
  v_url text := 'https://sovlfqncotxcjqseeawp.supabase.co/functions/v1/purge-retention';
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = 'PURGE_CRON_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'PURGE_CRON_SECRET fehlt im Vault'; END IF;

  FOR r IN SELECT scope FROM public.data_retention_policies
           WHERE enabled = true AND dry_run = false LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
      body := jsonb_build_object('scope', r.scope, 'mode', 'hard')
    );
  END LOOP;
END; $$;
