-- Add structured delivery address fields to catering_orders
ALTER TABLE catering_orders 
  ADD COLUMN IF NOT EXISTS delivery_street text,
  ADD COLUMN IF NOT EXISTS delivery_zip text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS delivery_floor text,
  ADD COLUMN IF NOT EXISTS has_elevator boolean DEFAULT false;

-- Add delivery floor and elevator to customer_profiles for returning customers
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS delivery_floor text,
  ADD COLUMN IF NOT EXISTS has_elevator boolean DEFAULT false;