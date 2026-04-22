-- ============================================================
-- Phase 4 Cleanup: Zombie views + write triggers for remaining views
-- ============================================================

-- ---------- 1. Repair zombie view event_payments_enriched ----------
DROP VIEW IF EXISTS public.event_payments_enriched CASCADE;

CREATE VIEW public.event_payments_enriched
WITH (security_invoker=true) AS
SELECT 
  p.id,
  p.event_id AS inquiry_id,
  p.amount_cents,
  p.payment_type::text AS payment_type,
  p.status::text AS status,
  p.due_date,
  p.due_days_before_event,
  p.stripe_checkout_session_id,
  p.stripe_payment_intent_id,
  p.stripe_payment_link_url,
  p.paid_at,
  p.paid_via,
  p.lexoffice_invoice_id,
  p.lexoffice_invoice_number,
  p.email_sent_at,
  p.email_resend_id,
  p.reminder_sent_at,
  p.notes,
  p.created_by,
  p.created_at,
  p.updated_at,
  p.effective_due_date,
  p.computed_status,
  p.event_date,
  p.event_date AS preferred_date,
  p.guest_count,
  p.customer_email,
  p.customer_name,
  p.service_type::text AS service_type,
  NULL::text AS event_type
FROM public.v2_payments_enriched p;

GRANT SELECT ON public.event_payments_enriched TO authenticated, anon, service_role;

-- ---------- 2. event_payments INSTEAD OF triggers ----------
CREATE OR REPLACE FUNCTION public.event_payments_update_trigger()
RETURNS trigger AS $$
BEGIN
  UPDATE public.v2_payments SET
    status = CASE NEW.status
      WHEN 'draft' THEN 'draft'::v2_payment_status
      WHEN 'sent' THEN 'sent'::v2_payment_status
      WHEN 'paid' THEN 'paid'::v2_payment_status
      WHEN 'overdue' THEN 'overdue'::v2_payment_status
      WHEN 'cancelled' THEN 'cancelled'::v2_payment_status
      WHEN 'refunded' THEN 'refunded'::v2_payment_status
      WHEN 'failed' THEN 'failed'::v2_payment_status
      ELSE OLD.status::v2_payment_status
    END,
    due_date = NEW.due_date,
    due_days_before_event = NEW.due_days_before_event,
    stripe_checkout_session_id = NEW.stripe_checkout_session_id,
    stripe_payment_intent_id = NEW.stripe_payment_intent_id,
    stripe_payment_link_url = NEW.stripe_payment_link_url,
    paid_at = NEW.paid_at,
    paid_via = NEW.paid_via,
    lexoffice_invoice_id = NEW.lexoffice_invoice_id,
    lexoffice_invoice_number = NEW.lexoffice_invoice_number,
    email_sent_at = NEW.email_sent_at,
    email_resend_id = NEW.email_resend_id,
    reminder_sent_at = NEW.reminder_sent_at,
    notes = NEW.notes,
    updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tg_event_payments_update ON public.event_payments;
CREATE TRIGGER tg_event_payments_update
  INSTEAD OF UPDATE ON public.event_payments
  FOR EACH ROW EXECUTE FUNCTION public.event_payments_update_trigger();

CREATE OR REPLACE FUNCTION public.event_payments_insert_trigger()
RETURNS trigger AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.v2_payments (
    id, event_id, amount_cents, payment_type, status, due_date,
    due_days_before_event, stripe_checkout_session_id,
    stripe_payment_intent_id, stripe_payment_link_url, paid_at,
    paid_via, lexoffice_invoice_id, lexoffice_invoice_number,
    email_sent_at, email_resend_id, reminder_sent_at, notes,
    created_by, created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.inquiry_id,
    NEW.amount_cents,
    NEW.payment_type::v2_payment_type,
    COALESCE(NEW.status, 'draft')::v2_payment_status,
    NEW.due_date, NEW.due_days_before_event,
    NEW.stripe_checkout_session_id, NEW.stripe_payment_intent_id,
    NEW.stripe_payment_link_url, NEW.paid_at, NEW.paid_via,
    NEW.lexoffice_invoice_id, NEW.lexoffice_invoice_number,
    NEW.email_sent_at, NEW.email_resend_id, NEW.reminder_sent_at, NEW.notes,
    NEW.created_by, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
  ) RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tg_event_payments_insert ON public.event_payments;
CREATE TRIGGER tg_event_payments_insert
  INSTEAD OF INSERT ON public.event_payments
  FOR EACH ROW EXECUTE FUNCTION public.event_payments_insert_trigger();

CREATE OR REPLACE FUNCTION public.event_payments_delete_trigger()
RETURNS trigger AS $$
BEGIN DELETE FROM public.v2_payments WHERE id = OLD.id; RETURN OLD;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tg_event_payments_delete ON public.event_payments;
CREATE TRIGGER tg_event_payments_delete
  INSTEAD OF DELETE ON public.event_payments
  FOR EACH ROW EXECUTE FUNCTION public.event_payments_delete_trigger();

-- ---------- 3. email_messages INSERT trigger ----------
CREATE OR REPLACE FUNCTION public.email_messages_insert_trigger()
RETURNS trigger AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.v2_event_emails (
    id, event_id, direction, from_email, to_email, subject,
    body_text, body_html, attachments, resend_message_id,
    resend_status, in_reply_to, created_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.inquiry_id,
    NEW.direction::v2_email_direction,
    NEW.from_email, NEW.to_email, NEW.subject,
    NEW.body_text, NEW.body_html,
    COALESCE(NEW.attachments, '[]'::jsonb),
    NEW.resend_message_id, COALESCE(NEW.resend_status, 'queued'),
    NEW.in_reply_to, COALESCE(NEW.created_at, now())
  ) RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tg_email_messages_insert ON public.email_messages;
CREATE TRIGGER tg_email_messages_insert
  INSTEAD OF INSERT ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.email_messages_insert_trigger();

-- ---------- 4. inquiry_offer_history INSERT trigger ----------
CREATE OR REPLACE FUNCTION public.inquiry_offer_history_insert_trigger()
RETURNS trigger AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.v2_event_offer_history (
    id, event_id, version, sent_at, sent_by, email_content,
    pdf_url, options_snapshot, created_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.inquiry_id, NEW.version,
    COALESCE(NEW.sent_at, now()), NEW.sent_by,
    NEW.email_content, NEW.pdf_url, NEW.options_snapshot,
    COALESCE(NEW.created_at, now())
  ) RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tg_inquiry_offer_history_insert ON public.inquiry_offer_history;
CREATE TRIGGER tg_inquiry_offer_history_insert
  INSTEAD OF INSERT ON public.inquiry_offer_history
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_offer_history_insert_trigger();