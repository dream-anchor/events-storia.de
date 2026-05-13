-- Backfill: group_inquiries -> v2_customers + v2_events
DO $$
DECLARE
  gi RECORD;
  v_customer_id uuid;
  v_status v2_event_status;
  v_archived boolean;
BEGIN
  FOR gi IN SELECT * FROM public.group_inquiries LOOP
    -- Skip wenn das Event bereits existiert
    IF EXISTS (SELECT 1 FROM public.v2_events WHERE id = gi.id) THEN
      CONTINUE;
    END IF;

    -- Kunde finden oder anlegen
    SELECT id INTO v_customer_id
    FROM public.v2_customers
    WHERE lower(email) = lower(gi.email)
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO public.v2_customers (name, company, email, phone)
      VALUES (
        COALESCE(NULLIF(trim(gi.contact_name), ''), gi.email),
        NULLIF(trim(COALESCE(gi.company_name, '')), ''),
        gi.email,
        gi.phone
      )
      RETURNING id INTO v_customer_id;
    END IF;

    -- Status mappen
    v_archived := false;
    v_status := CASE gi.status
      WHEN 'new'         THEN 'inquiry'::v2_event_status
      WHEN 'in_progress' THEN 'offer_draft'::v2_event_status
      WHEN 'offer_sent'  THEN 'offer_sent'::v2_event_status
      WHEN 'confirmed'   THEN 'paid'::v2_event_status
      WHEN 'rejected'    THEN 'cancelled'::v2_event_status
      WHEN 'archived'    THEN 'cancelled'::v2_event_status
      ELSE 'inquiry'::v2_event_status
    END;
    IF gi.status = 'archived' THEN v_archived := true; END IF;

    INSERT INTO public.v2_events (
      id, customer_id, status, service_type, source,
      date, guest_count, occasion, customer_notes, internal_notes,
      created_at, updated_at,
      language, arrival_time, preferred_menu,
      travel_plan_url, travel_plan_filename, preferred_date_flexible,
      assigned_to, archived,
      notification_sent
    ) VALUES (
      gi.id,
      v_customer_id,
      v_status,
      'group'::v2_event_service,
      'reisegruppen'::v2_event_source,
      gi.preferred_date,
      gi.group_size,
      'Reisegruppe',
      gi.message,
      gi.internal_notes,
      COALESCE(gi.created_at, now()),
      COALESCE(gi.updated_at, gi.created_at, now()),
      COALESCE(gi.language, 'de'),
      gi.arrival_time,
      gi.preferred_menu,
      gi.travel_plan_url,
      gi.travel_plan_filename,
      COALESCE(gi.preferred_date_flexible, false),
      gi.assigned_to::text,
      v_archived,
      true
    );
  END LOOP;
END $$;

-- Alte Tabelle als Legacy umbenennen
ALTER TABLE public.group_inquiries RENAME TO _legacy_group_inquiries;
