CREATE OR REPLACE FUNCTION public.checkout_create_catering_order(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    NULLIF(payload->>'desired_time','')::time,
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
$function$;