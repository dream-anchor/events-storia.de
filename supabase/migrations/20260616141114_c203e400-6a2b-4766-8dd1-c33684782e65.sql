GRANT SELECT ON public.ai_conversations TO authenticated;
GRANT SELECT ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
GRANT ALL ON public.ai_messages TO service_role;