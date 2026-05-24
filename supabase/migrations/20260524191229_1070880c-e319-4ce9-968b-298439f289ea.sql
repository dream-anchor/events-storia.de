
-- Helper: format date as DD.MM.YYYY (German)
CREATE OR REPLACE FUNCTION public._fmt_date(d date)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN d IS NULL THEN '—' ELSE to_char(d, 'DD.MM.YYYY') END
$$;

-- Helper: format money as German currency
CREATE OR REPLACE FUNCTION public._fmt_money(n numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n IS NULL THEN '—'
              ELSE replace(replace(replace(to_char(n, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.') || ' €'
         END
$$;

-- Helper: format bool as Ja/Nein
CREATE OR REPLACE FUNCTION public._fmt_bool(b boolean)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN b IS NULL THEN '—' WHEN b THEN 'Ja' ELSE 'Nein' END
$$;

-- Helper: nullable text → display
CREATE OR REPLACE FUNCTION public._fmt_text(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t IS NULL OR t = '' THEN '—' ELSE t END
$$;

-- Helper: build single-line address
CREATE OR REPLACE FUNCTION public._fmt_address(street text, zip text, city text, country text DEFAULT NULL, floor_ text DEFAULT NULL)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    trim(both ', ' FROM
      concat_ws(', ',
        NULLIF(trim(coalesce(street,'')), ''),
        NULLIF(trim(concat_ws(' ', NULLIF(zip,''), NULLIF(city,''))), ''),
        NULLIF(trim(coalesce(country,'')), ''),
        CASE WHEN floor_ IS NOT NULL AND floor_ <> '' THEN 'Etage ' || floor_ ELSE NULL END
      )
    ), ''
  )
$$;

-- Helper: insert a field_changed log row (skipped if displays are equal/empty)
CREATE OR REPLACE FUNCTION public._log_field_change(
  p_entity_type text, p_entity_id uuid,
  p_field text, p_label text, p_group text,
  p_old_display text, p_new_display text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := nullif(current_setting('request.jwt.claims', true)::json->>'email', '');
BEGIN
  IF coalesce(p_old_display,'') = coalesce(p_new_display,'') THEN RETURN; END IF;
  INSERT INTO public.activity_logs (entity_type, entity_id, action, actor_id, actor_email, metadata)
  VALUES (p_entity_type, p_entity_id, 'field_changed', v_actor, v_email,
    jsonb_build_object(
      'field', p_field,
      'label', p_label,
      'group', p_group,
      'old_display', coalesce(p_old_display, '—'),
      'new_display', coalesce(p_new_display, '—')
    )
  );
END $$;

-- Main trigger function on v2_events
CREATE OR REPLACE FUNCTION public.log_v2_event_field_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_etype text;
  v_old_addr text;
  v_new_addr text;
BEGIN
  -- Determine entity_type matching the legacy views
  IF NEW.source_inquiry_id IS NOT NULL THEN
    v_etype := 'event_inquiry';
  ELSIF NEW.source_booking_id IS NOT NULL THEN
    v_etype := 'event_booking';
  ELSIF NEW.source_catering_id IS NOT NULL THEN
    v_etype := 'catering_order';
  ELSE
    RETURN NEW;
  END IF;

  -- Schedule
  IF NEW.date IS DISTINCT FROM OLD.date THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'date', 'Veranstaltungsdatum', 'schedule',
      _fmt_date(OLD.date), _fmt_date(NEW.date));
  END IF;
  IF NEW.event_end_date IS DISTINCT FROM OLD.event_end_date THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'event_end_date', 'Enddatum', 'schedule',
      _fmt_date(OLD.event_end_date), _fmt_date(NEW.event_end_date));
  END IF;
  IF NEW.event_time IS DISTINCT FROM OLD.event_time THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'event_time', 'Uhrzeit', 'schedule',
      _fmt_text(OLD.event_time), _fmt_text(NEW.event_time));
  END IF;
  IF NEW.time_from IS DISTINCT FROM OLD.time_from THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'time_from', 'Uhrzeit', 'schedule',
      _fmt_text(OLD.time_from::text), _fmt_text(NEW.time_from::text));
  END IF;

  -- Guests
  IF NEW.guest_count IS DISTINCT FROM OLD.guest_count THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'guest_count', 'Gäste', 'guests',
      coalesce(OLD.guest_count::text,'—'), coalesce(NEW.guest_count::text,'—'));
  END IF;

  -- Delivery address (grouped)
  v_old_addr := _fmt_address(OLD.delivery_street, OLD.delivery_zip, OLD.delivery_city, NULL, OLD.delivery_floor);
  v_new_addr := _fmt_address(NEW.delivery_street, NEW.delivery_zip, NEW.delivery_city, NULL, NEW.delivery_floor);
  IF coalesce(v_old_addr,'') <> coalesce(v_new_addr,'') THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'delivery_address', 'Lieferadresse', 'address',
      coalesce(v_old_addr,'—'), coalesce(v_new_addr,'—'));
  END IF;
  IF NEW.has_elevator IS DISTINCT FROM OLD.has_elevator THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'has_elevator', 'Aufzug vorhanden', 'delivery',
      _fmt_bool(OLD.has_elevator), _fmt_bool(NEW.has_elevator));
  END IF;
  IF NEW.is_pickup IS DISTINCT FROM OLD.is_pickup THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'is_pickup', 'Selbstabholung', 'delivery',
      _fmt_bool(OLD.is_pickup), _fmt_bool(NEW.is_pickup));
  END IF;

  -- Billing address (grouped)
  v_old_addr := _fmt_address(OLD.billing_street, OLD.billing_postal_code, OLD.billing_city, OLD.billing_country);
  v_new_addr := _fmt_address(NEW.billing_street, NEW.billing_postal_code, NEW.billing_city, NEW.billing_country);
  IF coalesce(v_old_addr,'') <> coalesce(v_new_addr,'') THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'billing_address', 'Rechnungsadresse', 'address',
      coalesce(v_old_addr,'—'), coalesce(v_new_addr,'—'));
  END IF;
  IF NEW.billing_company_name IS DISTINCT FROM OLD.billing_company_name THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'billing_company_name', 'Rechnungs-Firmenname', 'address',
      _fmt_text(OLD.billing_company_name), _fmt_text(NEW.billing_company_name));
  END IF;
  IF NEW.billing_address_different IS DISTINCT FROM OLD.billing_address_different THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'billing_address_different', 'Abweichende Rechnungsadresse', 'address',
      _fmt_bool(OLD.billing_address_different), _fmt_bool(NEW.billing_address_different));
  END IF;

  -- Venue / Location
  v_old_addr := _fmt_address(OLD.location_street, OLD.location_postal_code, OLD.location_city, OLD.location_country);
  v_new_addr := _fmt_address(NEW.location_street, NEW.location_postal_code, NEW.location_city, NEW.location_country);
  IF coalesce(v_old_addr,'') <> coalesce(v_new_addr,'') THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'location_address', 'Veranstaltungsort', 'address',
      coalesce(v_old_addr,'—'), coalesce(v_new_addr,'—'));
  END IF;
  IF NEW.location_name IS DISTINCT FROM OLD.location_name THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'location_name', 'Location-Name', 'address',
      _fmt_text(OLD.location_name), _fmt_text(NEW.location_name));
  END IF;

  -- Payment
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'payment_method', 'Zahlungsmethode', 'payment',
      _fmt_text(OLD.payment_method), _fmt_text(NEW.payment_method));
  END IF;
  IF NEW.payment_type IS DISTINCT FROM OLD.payment_type THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'payment_type', 'Zahlungsart', 'payment',
      _fmt_text(OLD.payment_type), _fmt_text(NEW.payment_type));
  END IF;
  IF NEW.deposit_percent IS DISTINCT FROM OLD.deposit_percent THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'deposit_percent', 'Anzahlung in %', 'payment',
      coalesce(OLD.deposit_percent::text,'—'), coalesce(NEW.deposit_percent::text,'—'));
  END IF;
  IF NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'deposit_amount', 'Anzahlungsbetrag', 'payment',
      _fmt_money(OLD.deposit_amount), _fmt_money(NEW.deposit_amount));
  END IF;
  IF NEW.invoice_due_days IS DISTINCT FROM OLD.invoice_due_days THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'invoice_due_days', 'Zahlungsziel (Tage)', 'payment',
      coalesce(OLD.invoice_due_days::text,'—'), coalesce(NEW.invoice_due_days::text,'—'));
  END IF;

  -- Amount
  IF NEW.amount_total IS DISTINCT FROM OLD.amount_total THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'amount_total', 'Gesamtbetrag', 'amount',
      _fmt_money(OLD.amount_total), _fmt_money(NEW.amount_total));
  END IF;

  -- Delivery cost
  IF NEW.delivery_cost_cents IS DISTINCT FROM OLD.delivery_cost_cents THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'delivery_cost', 'Lieferkosten', 'delivery',
      _fmt_money(OLD.delivery_cost_cents/100.0), _fmt_money(NEW.delivery_cost_cents/100.0));
  END IF;

  -- Status / phase
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'status', 'Status', 'status',
      _fmt_text(OLD.status::text), _fmt_text(NEW.status::text));
  END IF;
  IF NEW.offer_phase IS DISTINCT FROM OLD.offer_phase THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'offer_phase', 'Angebots-Phase', 'status',
      _fmt_text(OLD.offer_phase), _fmt_text(NEW.offer_phase));
  END IF;
  IF NEW.menu_confirmed IS DISTINCT FROM OLD.menu_confirmed THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'menu_confirmed', 'Menü bestätigt', 'status',
      _fmt_bool(OLD.menu_confirmed), _fmt_bool(NEW.menu_confirmed));
  END IF;

  -- Notes
  IF NEW.internal_notes IS DISTINCT FROM OLD.internal_notes THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'internal_notes', 'Interne Notiz', 'notes',
      _fmt_text(OLD.internal_notes), _fmt_text(NEW.internal_notes));
  END IF;
  IF NEW.customer_notes IS DISTINCT FROM OLD.customer_notes THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'customer_notes', 'Kundennotiz', 'notes',
      _fmt_text(OLD.customer_notes), _fmt_text(NEW.customer_notes));
  END IF;

  -- Priority
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'priority', 'Priorität', 'status',
      _fmt_text(OLD.priority::text), _fmt_text(NEW.priority::text));
  END IF;

  -- Assignment
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    PERFORM _log_field_change(v_etype, NEW.id, 'assigned_to', 'Zuständig', 'status',
      _fmt_text(OLD.assigned_to), _fmt_text(NEW.assigned_to));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_v2_event_field_changes ON public.v2_events;
CREATE TRIGGER trg_log_v2_event_field_changes
AFTER UPDATE ON public.v2_events
FOR EACH ROW
EXECUTE FUNCTION public.log_v2_event_field_changes();
