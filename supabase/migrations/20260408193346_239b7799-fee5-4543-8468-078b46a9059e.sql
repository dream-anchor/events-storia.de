CREATE POLICY "anon can view payment status by inquiry"
  ON event_payments FOR SELECT
  TO anon
  USING (status NOT IN ('cancelled', 'refunded', 'draft'));