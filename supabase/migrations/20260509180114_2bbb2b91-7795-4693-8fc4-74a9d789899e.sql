
-- Sustainable typed entrypoints for checkout inserts.
-- Views (event_bookings, catering_orders) cannot be written through Supabase JS
-- with type-safety because supabase-gen does not emit Insert types for views.
-- These RPCs provide a permanent, typed contract that calls the existing
-- INSTEAD OF triggers on the underlying views.

CREATE OR REPLACE FUNCTION public.checkout_create_event_booking(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE((payload->>'id')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.event_bookings (
    id, booking_number, customer_name, customer_email, phone, company_name,
    event_date, event_time, guest_count, package_id, total_amount,
    payment_status, status, internal_notes, menu_selection
  ) VALUES (
    v_id,
    payload->>'booking_number',
    payload->>'customer_name',
    payload->>'customer_email',
    payload->>'phone',
    payload->>'company_name',
    (payload->>'event_date')::date,
    payload->>'event_time',
    NULLIF(payload->>'guest_count','')::integer,
    NULLIF(payload->>'package_id','')::uuid,
    NULLIF(payload->>'total_amount','')::numeric,
    COALESCE(payload->>'payment_status','pending'),
    COALESCE(payload->>'status','confirmed'),
    payload->>'internal_notes',
    NULLIF(payload->'menu_selection','null')
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_create_catering_order(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE((payload->>'id')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.catering_orders (
    id, order_number, customer_name, customer_email, customer_phone, company_name,
    delivery_street, delivery_zip, delivery_city, delivery_floor, has_elevator,
    delivery_address, is_pickup, desired_date, desired_time, notes, items,
    total_amount, billing_name, billing_street, billing_zip, billing_city, billing_country,
    delivery_cost, minimum_order_surcharge, calculated_distance_km,
    payment_method, payment_status, user_id, reference_number
  ) VALUES (
    v_id,
    payload->>'order_number',
    payload->>'customer_name',
    payload->>'customer_email',
    payload->>'customer_phone',
    payload->>'company_name',
    payload->>'delivery_street',
    payload->>'delivery_zip',
    payload->>'delivery_city',
    payload->>'delivery_floor',
    COALESCE((payload->>'has_elevator')::boolean,false),
    payload->>'delivery_address',
    COALESCE((payload->>'is_pickup')::boolean,false),
    NULLIF(payload->>'desired_date','')::date,
    payload->>'desired_time',
    payload->>'notes',
    COALESCE(payload->'items','[]'::jsonb),
    NULLIF(payload->>'total_amount','')::numeric,
    payload->>'billing_name',
    payload->>'billing_street',
    payload->>'billing_zip',
    payload->>'billing_city',
    payload->>'billing_country',
    NULLIF(payload->>'delivery_cost','')::numeric,
    NULLIF(payload->>'minimum_order_surcharge','')::numeric,
    NULLIF(payload->>'calculated_distance_km','')::numeric,
    payload->>'payment_method',
    COALESCE(payload->>'payment_status','pending'),
    NULLIF(payload->>'user_id','')::uuid,
    payload->>'reference_number'
  );
  RETURN v_id;
END;
$$;

-- Anonymous + authenticated callers from checkout
GRANT EXECUTE ON FUNCTION public.checkout_create_event_booking(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_create_catering_order(jsonb) TO anon, authenticated;
