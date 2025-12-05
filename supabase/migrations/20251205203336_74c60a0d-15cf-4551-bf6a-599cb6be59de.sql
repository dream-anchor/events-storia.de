-- Add billing address and delivery cost fields to catering_orders
ALTER TABLE catering_orders 
ADD COLUMN IF NOT EXISTS billing_name text,
ADD COLUMN IF NOT EXISTS billing_street text,
ADD COLUMN IF NOT EXISTS billing_zip text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'Deutschland',
ADD COLUMN IF NOT EXISTS delivery_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_order_surcharge numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_distance_km numeric;