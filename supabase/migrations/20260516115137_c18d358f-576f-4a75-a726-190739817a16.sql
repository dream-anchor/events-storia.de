CREATE OR REPLACE FUNCTION public.catering_orders_update_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_intent text;
  checkout_session text;
  payment_amount_cents integer;
BEGIN
  UPDATE public.v2_events SET
    delivery_address = NEW.delivery_address,
    is_pickup = NEW.is_pickup,
    date = NEW.desired_date,
    time_from = NEW.desired_time,
    customer_notes = NEW.notes,
    items = NEW.items,
    amount_total = NEW.total_amount,
    status = CASE NEW.status
      WHEN 'pending' THEN 'inquiry'::v2_event_status
      WHEN 'confirmed' THEN 'offer_chosen'::v2_event_status
      WHEN 'completed' THEN 'completed'::v2_event_status
      WHEN 'cancelled' THEN 'cancelled'::v2_event_status
      ELSE status
    END,
    billing_name = NEW.billing_name,
    billing_street = NEW.billing_street,
    billing_postal_code = NEW.billing_zip,
    billing_city = NEW.billing_city,
    billing_country = NEW.billing_country,
    delivery_cost_cents = (COALESCE(NEW.delivery_cost,0) * 100)::integer,
    minimum_order_surcharge_cents = (COALESCE(NEW.minimum_order_surcharge,0) * 100)::integer,
    calculated_distance_km = NEW.calculated_distance_km,
    invoice_lexoffice_id = NEW.lexoffice_invoice_id,
    lexoffice_document_type = NEW.lexoffice_document_type,
    delivery_street = NEW.delivery_street,
    delivery_zip = NEW.delivery_zip,
    delivery_city = NEW.delivery_city,
    delivery_floor = NEW.delivery_floor,
    has_elevator = NEW.has_elevator,
    internal_notes = NEW.internal_notes,
    is_test = NEW.is_test,
    reminder_sent_at = NEW.reminder_sent_at,
    booking_number = NEW.order_number,
    updated_at = now()
  WHERE id = OLD.id;

  IF NEW.payment_status = 'paid' THEN
    payment_intent := NULLIF(NEW.stripe_payment_intent_id, '');

    SELECT
      NULLIF(al.metadata->>'stripe_session_id', ''),
      COALESCE(
        NULLIF(al.metadata->>'payment_intent', ''),
        payment_intent
      )
    INTO checkout_session, payment_intent
    FROM public.activity_logs al
    WHERE al.entity_type = 'catering_order'
      AND al.entity_id = OLD.id
      AND al.action = 'payment_confirmed'
    ORDER BY al.created_at DESC
    LIMIT 1;

    payment_amount_cents := GREATEST(ROUND(COALESCE(NEW.total_amount, 0) * 100)::integer, 0);

    INSERT INTO public.v2_payments (
      event_id,
      amount_cents,
      payment_type,
      status,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      paid_at,
      paid_via,
      notes,
      created_at,
      updated_at
    ) VALUES (
      OLD.id,
      payment_amount_cents,
      'full'::v2_payment_type,
      'paid'::v2_payment_status,
      checkout_session,
      payment_intent,
      now(),
      'stripe',
      'Automatisch aus Catering-Zahlung synchronisiert',
      now(),
      now()
    )
    ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET
      status = 'paid'::v2_payment_status,
      paid_at = COALESCE(public.v2_payments.paid_at, EXCLUDED.paid_at),
      paid_via = COALESCE(public.v2_payments.paid_via, EXCLUDED.paid_via),
      updated_at = now();
  END IF;

  RETURN NEW;
END $function$;

INSERT INTO public.v2_payments (
  event_id,
  amount_cents,
  payment_type,
  status,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  paid_at,
  paid_via,
  notes,
  created_at,
  updated_at
)
SELECT
  al.entity_id,
  GREATEST(ROUND(COALESCE((al.metadata->>'amount')::numeric, ev.amount_total, 0) * 100)::integer, 0),
  'full'::v2_payment_type,
  'paid'::v2_payment_status,
  NULLIF(al.metadata->>'stripe_session_id', ''),
  NULLIF(al.metadata->>'payment_intent', ''),
  al.created_at,
  'stripe',
  'Aus bestehendem Stripe-Zahlungsprotokoll nachgetragen',
  al.created_at,
  now()
FROM public.activity_logs al
JOIN public.v2_events ev ON ev.id = al.entity_id
WHERE al.entity_type = 'catering_order'
  AND al.action = 'payment_confirmed'
  AND ev.source_catering_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.v2_payments p
    WHERE p.event_id = al.entity_id
      AND p.status = 'paid'::v2_payment_status
  )
ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET
  status = 'paid'::v2_payment_status,
  paid_at = COALESCE(public.v2_payments.paid_at, EXCLUDED.paid_at),
  paid_via = COALESCE(public.v2_payments.paid_via, EXCLUDED.paid_via),
  updated_at = now();