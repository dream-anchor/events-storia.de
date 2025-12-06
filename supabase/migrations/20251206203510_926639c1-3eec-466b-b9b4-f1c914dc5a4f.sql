-- Fix catering_orders SELECT policies - make them PERMISSIVE (OR logic)
-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "Admins can view all orders" ON public.catering_orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.catering_orders;

-- Recreate as PERMISSIVE policies (default, using OR logic)
CREATE POLICY "Admins can view all orders" 
ON public.catering_orders 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own orders" 
ON public.catering_orders 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Fix customer_profiles - ensure only authenticated users can access
DROP POLICY IF EXISTS "Users can view own profile" ON public.customer_profiles;

CREATE POLICY "Users can view own profile" 
ON public.customer_profiles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Fix user_roles - ensure only authenticated users can access
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());