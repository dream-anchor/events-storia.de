CREATE OR REPLACE FUNCTION public.notify_maestro_handoff_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'conflict' AND (OLD.status IS DISTINCT FROM 'conflict') THEN
    PERFORM public.report_system_error_internal(
      'events_storia',
      'maestro-handoff:conflict',
      'critical',
      format('MAESTRO-Handoff KONFLIKT: Bestellung %s (%s) — Zahlung ggf. manuell nachtragen. Delivery-ID: %s',
        COALESCE(NEW.payload->>'orderNumber', '?'),
        COALESCE(NEW.payload->>'customerEmail', '?'),
        NEW.delivery_event_id),
      md5(NEW.delivery_event_id),
      jsonb_build_object(
        'outbox_id', NEW.id,
        'delivery_event_id', NEW.delivery_event_id,
        'source_order_id', NEW.source_order_id,
        'order_number', NEW.payload->>'orderNumber',
        'customer_email', NEW.payload->>'customerEmail',
        'customer_name', NEW.payload->>'customerName',
        'amount_total_cents', NEW.payload->>'amountTotalCents',
        'has_transaction', (NEW.payload ? 'transaction'),
        'transaction', NEW.payload->'transaction',
        'last_error', NEW.last_error
      ),
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_maestro_handoff_conflict_notify ON public.maestro_handoff_outbox;
CREATE TRIGGER tg_maestro_handoff_conflict_notify
  AFTER UPDATE ON public.maestro_handoff_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_maestro_handoff_conflict();