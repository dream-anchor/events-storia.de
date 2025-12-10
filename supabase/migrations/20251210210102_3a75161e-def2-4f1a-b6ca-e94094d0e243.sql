-- Fix order_number_sequences RLS policy to restrict access to service role only
DROP POLICY IF EXISTS "Service role can manage sequences" ON order_number_sequences;

-- Create new restrictive policy for service role only
CREATE POLICY "Service role only" ON order_number_sequences
FOR ALL
USING (
  (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
)
WITH CHECK (
  (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
);