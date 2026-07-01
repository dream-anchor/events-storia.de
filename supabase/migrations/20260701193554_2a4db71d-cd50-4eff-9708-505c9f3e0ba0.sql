-- 1. ERROR-Fix: SECURITY DEFINER View → Security Invoker
ALTER VIEW public.inquiry_offer_history SET (security_invoker = true);

-- 2. Redundante service_role-Policies entfernen (service_role bypasst RLS ohnehin)
DROP POLICY IF EXISTS "Service role can insert email_messages" ON public._legacy_email_messages;
DROP POLICY IF EXISTS "Service role can update email_messages" ON public._legacy_email_messages;
DROP POLICY IF EXISTS "Service role can insert v2_event_emails" ON public.v2_event_emails;
DROP POLICY IF EXISTS "Service role can update v2_event_emails" ON public.v2_event_emails;

-- 3. Zu weite auth-Policies auf inbox_emails entfernen (tenant_isolation_inbox_emails deckt bereits sauber ab)
DROP POLICY IF EXISTS "auth read inbox_emails" ON public.inbox_emails;
DROP POLICY IF EXISTS "auth update inbox_emails" ON public.inbox_emails;