-- =====================================================================
-- Multi-Tenant Umbau — Phase 2: Fundament (tenants, tenant_users, Anker)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  address_street text,
  address_zip text,
  address_city text,
  phone text,
  contact_email text,
  website text,
  vat_id text,
  registration_number text,
  from_email text,
  reply_to_email text,
  brand_name text,
  logo_url text,
  primary_color text,
  stripe_account_id text,
  lexoffice_api_key_ref text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'onboarding')),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_single_default
  ON public.tenants (is_default) WHERE is_default;

INSERT INTO public.tenants (
  id, slug, name, legal_name,
  address_street, address_zip, address_city, phone, contact_email,
  from_email, reply_to_email, brand_name, status, is_default
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'storia',
  'STORIA Catering & Events',
  'Speranza GmbH',
  'Karlstraße 47a', '80333', 'München', '+49 89 51519696', 'info@events-storia.de',
  'info@events-storia.de', 'info@events-storia.de', 'StoriaMaestro', 'active', true
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON public.tenant_users (user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users (tenant_id);

INSERT INTO public.tenant_users (tenant_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, user_id, MIN(role)
FROM public.user_roles
GROUP BY user_id
ON CONFLICT (tenant_id, user_id) DO NOTHING;

ALTER TABLE public.v2_customers
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

UPDATE public.v2_customers
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;
UPDATE public.v2_events
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.v2_customers
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.v2_events
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

CREATE INDEX IF NOT EXISTS idx_v2_customers_tenant ON public.v2_customers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_v2_events_tenant ON public.v2_events (tenant_id);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_users TO authenticated;
GRANT ALL ON public.tenant_users TO service_role;

DROP POLICY IF EXISTS "Admins can manage tenants" ON public.tenants;
CREATE POLICY "Admins can manage tenants" ON public.tenants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Staff can view tenants" ON public.tenants;
CREATE POLICY "Staff can view tenants" ON public.tenants
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins can manage tenant_users" ON public.tenant_users;
CREATE POLICY "Admins can manage tenant_users" ON public.tenant_users
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view own memberships" ON public.tenant_users;
CREATE POLICY "Users can view own memberships" ON public.tenant_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());