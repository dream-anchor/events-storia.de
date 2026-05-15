CREATE OR REPLACE FUNCTION public.report_frontend_error(
  p_source text, p_severity text, p_message text,
  p_payload jsonb DEFAULT NULL, p_url text DEFAULT NULL, p_user_agent text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_severity text; v_message text; v_source text; v_hash text; v_id uuid;
BEGIN
  v_severity := COALESCE(p_severity, 'error');
  IF v_severity NOT IN ('warning','error','critical') THEN v_severity := 'error'; END IF;
  v_source := substr(COALESCE(NULLIF(p_source,''), 'frontend'), 1, 200);
  v_message := substr(COALESCE(NULLIF(p_message,''), '(empty)'), 1, 2000);
  v_hash := md5('events_storia|' || v_source || '|' || v_message);
  SELECT id INTO v_id FROM public.report_system_error_internal(
    'events_storia'::project_key, v_source, v_severity, v_message, v_hash,
    p_payload, p_url, p_user_agent);
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.report_frontend_error(text, text, text, jsonb, text, text) TO anon, authenticated;