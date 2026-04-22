-- Drop if exist (idempotent), then add INSTEAD OF DELETE triggers
DROP TRIGGER IF EXISTS tg_event_bookings_delete ON public.event_bookings;
DROP TRIGGER IF EXISTS tg_catering_orders_delete ON public.catering_orders;

CREATE TRIGGER tg_event_bookings_delete
  INSTEAD OF DELETE ON public.event_bookings
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_delete_trigger();

CREATE TRIGGER tg_catering_orders_delete
  INSTEAD OF DELETE ON public.catering_orders
  FOR EACH ROW EXECUTE FUNCTION public.event_inquiries_delete_trigger();