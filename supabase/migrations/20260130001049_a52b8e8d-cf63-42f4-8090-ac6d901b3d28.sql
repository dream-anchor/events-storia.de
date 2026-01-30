-- ============================================
-- ACTIVITY LOGS TABLE (Audit Trail)
-- ============================================
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID,
    actor_email TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast entity lookups
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage
CREATE POLICY "Admins can manage activity_logs"
    ON public.activity_logs FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- ADMIN PRESENCE TABLE (Real-time Collaboration)
-- ============================================
CREATE TABLE public.admin_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_email TEXT,
    entity_type TEXT,
    entity_id UUID,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_editing BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, entity_type, entity_id)
);

-- Index for fast presence lookups
CREATE INDEX idx_admin_presence_entity ON public.admin_presence(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage presence
CREATE POLICY "Admins can manage admin_presence"
    ON public.admin_presence FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_inquiries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catering_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_bookings;