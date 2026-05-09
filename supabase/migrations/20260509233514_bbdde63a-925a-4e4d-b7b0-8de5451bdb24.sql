ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggested_event_id uuid REFERENCES public.v2_events(id) ON DELETE SET NULL;
ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggestion_category text
  CHECK (suggestion_category IN ('match', 'new_inquiry', 'irrelevant', 'unclear'));
ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggestion_confidence text
  CHECK (suggestion_confidence IN ('high', 'medium', 'low'));
ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggestion_reasoning text;
ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggestion_method text
  CHECK (suggestion_method IN ('heuristic', 'llm'));
ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggestion_generated_at timestamptz;
ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggestion_accepted_at timestamptz;
ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggestion_overridden_at timestamptz;
ALTER TABLE public.inbox_emails ADD COLUMN IF NOT EXISTS suggestion_actual_event_id uuid REFERENCES public.v2_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_emails_suggestion ON public.inbox_emails(suggestion_category, suggestion_confidence)
  WHERE suggestion_generated_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_classification_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES public.inbox_emails(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  subject text,
  body_excerpt text,
  suggested_event_id uuid,
  suggested_category text,
  actual_event_id uuid,
  actual_category text,
  was_correct boolean GENERATED ALWAYS AS (
    suggested_event_id IS NOT DISTINCT FROM actual_event_id
    AND suggested_category IS NOT DISTINCT FROM actual_category
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_classification_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all email_classification_feedback" ON public.email_classification_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service all email_classification_feedback" ON public.email_classification_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_classification_feedback_correct ON public.email_classification_feedback(was_correct, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_classification_feedback_from ON public.email_classification_feedback(from_email);