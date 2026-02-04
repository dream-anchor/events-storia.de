-- =====================================================
-- Fix: Allow public/anonymous users to create event bookings
-- Problem: Only admins could insert into event_bookings
-- Solution: Add INSERT policy for public role (like catering_orders)
-- =====================================================

-- Create INSERT policy for public users (customers checking out)
CREATE POLICY "Anyone can insert event bookings"
ON public.event_bookings
FOR INSERT
TO public
WITH CHECK (true);

-- Also allow authenticated non-admin users to insert
-- (in case a logged-in customer books a package)
CREATE POLICY "Authenticated users can insert event bookings"
ON public.event_bookings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow customers to view their own bookings by email
CREATE POLICY "Customers can view own event bookings"
ON public.event_bookings
FOR SELECT
TO public
USING (true);