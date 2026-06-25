CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid,
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    (SELECT tu.tenant_id
       FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
      ORDER BY tu.created_at ASC
      LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.current_tenant_id() IS
  'Mandant des aktuellen Users: JWT-Claim tenant_id, sonst app_metadata, sonst tenant_users-Fallback.';

CREATE OR REPLACE FUNCTION public.has_role_in_tenant(
  _user_id uuid,
  _role public.app_role,
  _tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = _user_id
      AND role = _role
      AND tenant_id = _tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT _tenant_id IS NOT DISTINCT FROM public.current_tenant_id();
$$;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_tenant_id uuid;
BEGIN
  SELECT tu.tenant_id
    INTO v_tenant_id
    FROM public.tenant_users tu
   WHERE tu.user_id = (event->>'user_id')::uuid
   ORDER BY tu.created_at ASC
   LIMIT 1;

  claims := event->'claims';
  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text), true);
  END IF;

  event := jsonb_set(event, '{claims}', claims, true);
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

GRANT SELECT ON public.tenant_users TO supabase_auth_admin;
DROP POLICY IF EXISTS "auth_admin can read tenant_users" ON public.tenant_users;
CREATE POLICY "auth_admin can read tenant_users" ON public.tenant_users
  AS PERMISSIVE FOR SELECT TO supabase_auth_admin
  USING (true);