CREATE OR REPLACE FUNCTION public.enqueue_v2_event_handoff_by_id(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  ev record;
  v_cust record;
  v_row jsonb;
  v_source text;
  v_detail text;
  v_email text;
  v_details jsonb;
  v_inquiry jsonb;
  v_payload jsonb;
  v_raw text;
  v_delivery text;
  v_inserted int;
BEGIN
  SELECT * INTO ev FROM public.v2_events WHERE id = p_event_id;
  IF ev.id IS NULL THEN RETURN 'event_not_found'; END IF;
  IF COALESCE(ev.is_test, false) THEN RETURN 'skipped_test'; END IF;

  SELECT name, email, phone, company INTO v_cust
    FROM public.v2_customers WHERE id = ev.customer_id;
  IF v_cust.name IS NULL OR btrim(v_cust.name) = '' THEN RETURN 'no_customer'; END IF;

  v_row := to_jsonb(ev);

  v_source := CASE ev.source::text
    WHEN 'email_inbound' THEN 'email'
    WHEN 'email_forward' THEN 'email'
    WHEN 'phone'         THEN 'phone'
    WHEN 'manual'        THEN 'manual'
    ELSE 'form'
  END;
  v_detail := CASE ev.source::text
    WHEN 'reisegruppen'  THEN 'ristorante_reisegruppen'
    WHEN 'catering_form' THEN 'catering_form'
    WHEN 'website'       THEN 'events_website'
    ELSE ev.source::text
  END;

  v_email := lower(btrim(coalesce(v_cust.email, '')));
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    v_email := NULL;
  END IF;

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'v2Status',      ev.status::text,
    'v2Source',      ev.source::text,
    'serviceType',   v_row->>'service_type',
    'arrivalTime',   v_row->>'arrival_time',
    'preferredMenu', v_row->>'preferred_menu',
    'dateFlexible',  v_row->'preferred_date_flexible',
    'timeSlot',      v_row->>'time_slot',
    'locationType',  v_row->>'location_type'
  ));
  IF v_details = '{}'::jsonb THEN v_details := NULL; END IF;

  v_inquiry := jsonb_strip_nulls(jsonb_build_object(
    'customerName',  left(btrim(v_cust.name), 200),
    'customerEmail', left(v_email, 320),
    'phone',         left(nullif(btrim(coalesce(v_cust.phone, '')), ''), 60),
    'company',       left(coalesce(nullif(btrim(coalesce(v_row->>'company_name', '')), ''),
                                   nullif(btrim(coalesce(v_cust.company, '')), '')), 200),
    'message',       left(nullif(ev.customer_notes, ''), 5000),
    'guests',        CASE WHEN ev.guest_count IS NOT NULL AND ev.guest_count > 0
                          THEN least(ev.guest_count, 100000) END,
    'eventDate',     ev.date::text,
    'eventTime',     left(nullif(btrim(coalesce(ev.event_time, '')), ''), 20),
    'eventType',     left(nullif(btrim(coalesce(ev.occasion, '')), ''), 120),
    'source',        v_source,
    'sourceDetail',  left(v_detail, 100),
    'language',      left(lower(nullif(btrim(coalesce(v_row->>'language', '')), '')), 8),
    'details',       v_details
  ));

  v_delivery := 'inquiry_' || ev.id;
  v_payload := jsonb_build_object(
    'deliveryEventId',  v_delivery,
    'sourceSystem',     'events-storia-v1',
    'sourceRecordType', 'v2_events',
    'sourceRecordId',   ev.id::text,
    'inquiry',          v_inquiry
  );
  v_raw := v_payload::text;

  INSERT INTO public.maestro_handoff_outbox
      (delivery_event_id, kind, source_system, source_order_id,
       payload, raw_body, payload_hash, status)
    VALUES
      (v_delivery, 'inquiry', 'events-storia-v1', ev.id::text,
       v_payload, v_raw, encode(digest(v_raw, 'sha256'), 'hex'), 'pending')
    ON CONFLICT (delivery_event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN CASE WHEN v_inserted > 0 THEN 'enqueued' ELSE 'already_present' END;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_v2_event_handoff_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_v2_event_handoff_by_id(uuid) TO service_role;