CREATE TABLE IF NOT EXISTS public.email_sender_blocklist (
  from_email text PRIMARY KEY,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid REFERENCES auth.users(id),
  reason text
);
ALTER TABLE public.email_sender_blocklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all sender_blocklist" ON public.email_sender_blocklist;
CREATE POLICY "auth all sender_blocklist" ON public.email_sender_blocklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service all sender_blocklist" ON public.email_sender_blocklist;
CREATE POLICY "service all sender_blocklist" ON public.email_sender_blocklist
  FOR ALL TO service_role USING (true) WITH CHECK (true);