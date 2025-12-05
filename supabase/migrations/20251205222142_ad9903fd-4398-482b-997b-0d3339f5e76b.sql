-- Fix RLS policy for catering_orders INSERT to be explicitly PERMISSIVE
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.catering_orders;

CREATE POLICY "Anyone can insert orders"
ON public.catering_orders
FOR INSERT
TO public
WITH CHECK (true);

-- Allow registered customers to view their own orders
CREATE POLICY "Users can view own orders"
ON public.catering_orders
FOR SELECT
USING (user_id = auth.uid());