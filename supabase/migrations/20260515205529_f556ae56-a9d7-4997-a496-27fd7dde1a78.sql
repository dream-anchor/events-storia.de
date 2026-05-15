-- Multi-project system health hub
-- Tracks errors and daily audits across events-storia and ristorantestoria

CREATE TYPE public.project_key AS ENUM ('events_storia', 'ristorante_storia');

CREATE TABLE public.system_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project public.project_key NOT NULL,
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('warning','error','critical')),
  message text NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb,
  url text,
  user_agent text,
  count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One open issue per project+payload (collapses duplicates)
CREATE UNIQUE INDEX system_errors_open_dedup
  ON public.system_errors(project, payload_hash)
  WHERE resolved_at IS NULL;

CREATE INDEX system_errors_unresolved
  ON public.system_errors(project, severity, last_seen DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX system_errors_recent
  ON public.system_errors(last_seen DESC);

CREATE TABLE public.daily_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project public.project_key NOT NULL,
  audit_date date NOT NULL,
  severity_score integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project, audit_date)
);

CREATE INDEX daily_audits_recent
  ON public.daily_audits(project, audit_date DESC);

-- RLS
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_audits ENABLE ROW LEVEL SECURITY;

-- Admin + Staff can view all errors (uses existing has_role helper)
CREATE POLICY "Admin/Staff can view all system_errors"
ON public.system_errors FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin/Staff can update system_errors (resolve)"
ON public.system_errors FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin/Staff can view daily_audits"
ON public.daily_audits FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Writes happen exclusively via service-role from edge functions
-- (no INSERT policy → anon/authenticated cannot insert directly)

-- Realtime for live dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_errors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_audits;

-- Helper: upsert error (called by edge function with service-role)
CREATE OR REPLACE FUNCTION public.report_system_error_internal(
  p_project public.project_key,
  p_source text,
  p_severity text,
  p_message text,
  p_payload_hash text,
  p_payload jsonb,
  p_url text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(id uuid, count integer, was_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_count integer;
BEGIN
  SELECT se.id, se.count INTO v_existing_id, v_count
  FROM public.system_errors se
  WHERE se.project = p_project
    AND se.payload_hash = p_payload_hash
    AND se.resolved_at IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.system_errors
    SET count = count + 1,
        last_seen = now(),
        payload = COALESCE(p_payload, payload),
        url = COALESCE(p_url, url),
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = v_existing_id
    RETURNING system_errors.id, system_errors.count INTO v_existing_id, v_count;

    RETURN QUERY SELECT v_existing_id, v_count, false;
  ELSE
    INSERT INTO public.system_errors (
      project, source, severity, message, payload_hash, payload, url, user_agent
    ) VALUES (
      p_project, p_source, p_severity, p_message, p_payload_hash, p_payload, p_url, p_user_agent
    )
    RETURNING system_errors.id, system_errors.count INTO v_existing_id, v_count;

    RETURN QUERY SELECT v_existing_id, v_count, true;
  END IF;
END;
$$;