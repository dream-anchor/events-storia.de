
CREATE OR REPLACE FUNCTION public.run_retention_purge()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_secret text;
  v_url text := 'https://sovlfqncotxcjqseeawp.supabase.co/functions/v1/purge-retention';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdmxmcW5jb3R4Y2pxc2VlYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTM5NjMsImV4cCI6MjA4MDUyOTk2M30.t7WJB1ysn4QNDHpXIJ3Gzo5bxuXiTJpJJ-8DSkVpRyc';
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = 'PURGE_CRON_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'PURGE_CRON_SECRET fehlt im Vault'; END IF;

  FOR r IN SELECT scope FROM public.data_retention_policies
           WHERE enabled = true AND dry_run = false LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret', v_secret,
        'Authorization', 'Bearer ' || v_anon,
        'apikey', v_anon
      ),
      body := jsonb_build_object('scope', r.scope, 'mode', 'hard')
    );
  END LOOP;
END; $$;
