UPDATE public.balance_payment_links
SET event_id = '316a0f27-8911-464f-97ea-c5135328f3d5'
WHERE slug = 'rigshospitalet' AND event_id IS NULL;

UPDATE public.v2_payments
SET status = 'paid',
    amount_cents = 518000,
    guests_charged = 81,
    price_per_person_cents = 7000,
    paid_at = to_timestamp(1787148097),
    paid_via = 'card',
    stripe_checkout_session_id = 'cs_live_a13SEOa5H4sOeQ9nShS1BVVRzIdwzp1ceVP4r8hqCeiqL8LuSbEjleEiOS',
    stripe_payment_intent_id = 'pi_3U6A3hAM22cIWFYx2dM7C7Vw',
    notes = 'Restzahlung via /restzahlung/rigshospitalet – 81 Gäste (nachgetragen)',
    updated_at = now()
WHERE id = 'fd353ccf-4a1a-4ea5-8e65-675182d08899';

UPDATE public.v2_events
SET guests_quoted = COALESCE(guests_quoted, 70),
    guests_confirmed = 81,
    updated_at = now()
WHERE id = '316a0f27-8911-464f-97ea-c5135328f3d5';

INSERT INTO public.v2_guest_adjustments
  (event_id, payment_id, guests_before, guests_after, delta_guests,
   price_per_person_cents, delta_amount_cents, kind, status, stripe_session_id, notes)
SELECT '316a0f27-8911-464f-97ea-c5135328f3d5', 'fd353ccf-4a1a-4ea5-8e65-675182d08899',
       70, 81, 11, 7000, 77000, 'surcharge', 'open',
       'cs_live_a13SEOa5H4sOeQ9nShS1BVVRzIdwzp1ceVP4r8hqCeiqL8LuSbEjleEiOS',
       'Nachgetragen: Stripe-Restzahlung über Zahlungslink wurde vom Webhook nicht verarbeitet.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.v2_guest_adjustments
  WHERE stripe_session_id = 'cs_live_a13SEOa5H4sOeQ9nShS1BVVRzIdwzp1ceVP4r8hqCeiqL8LuSbEjleEiOS'
);