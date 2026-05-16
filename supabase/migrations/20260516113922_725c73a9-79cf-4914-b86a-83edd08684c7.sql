CREATE TABLE public.system_health_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  window_hours integer NOT NULL DEFAULT 24,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_sent boolean NOT NULL DEFAULT false,
  email_id text,
  had_blockers boolean NOT NULL DEFAULT false,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_health_audit_runs_run_at ON public.system_health_audit_runs (run_at DESC);

ALTER TABLE public.system_health_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit runs"
  ON public.system_health_audit_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));