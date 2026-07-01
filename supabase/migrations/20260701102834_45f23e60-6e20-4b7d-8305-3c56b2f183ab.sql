-- 1) Snapshot-Spalten an v2_event_offer_history hängen (nullable → Alt-Daten bleiben ok)
ALTER TABLE public.v2_event_offer_history
  ADD COLUMN IF NOT EXISTS inquiry_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS address_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS payment_terms_snapshot jsonb;

-- 2) View + Trigger neu aufsetzen, damit die neuen Spalten mitgeführt werden
DROP VIEW IF EXISTS public.inquiry_offer_history CASCADE;

CREATE VIEW public.inquiry_offer_history AS
SELECT
  id,
  event_id   AS inquiry_id,
  version,
  sent_at,
  sent_by,
  email_content,
  email_html,
  pdf_url,
  options_snapshot,
  inquiry_snapshot,
  address_snapshot,
  payment_terms_snapshot,
  created_at
FROM public.v2_event_offer_history;

CREATE OR REPLACE FUNCTION public.inquiry_offer_history_insert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.v2_event_offer_history (
    id, event_id, version, sent_at, sent_by, email_content, email_html,
    pdf_url, options_snapshot,
    inquiry_snapshot, address_snapshot, payment_terms_snapshot,
    created_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.inquiry_id, NEW.version,
    COALESCE(NEW.sent_at, now()), NEW.sent_by,
    NEW.email_content, NEW.email_html, NEW.pdf_url, NEW.options_snapshot,
    NEW.inquiry_snapshot, NEW.address_snapshot, NEW.payment_terms_snapshot,
    COALESCE(NEW.created_at, now())
  ) RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER inquiry_offer_history_insert_trigger
INSTEAD OF INSERT ON public.inquiry_offer_history
FOR EACH ROW EXECUTE FUNCTION public.inquiry_offer_history_insert_trigger();

REVOKE EXECUTE ON FUNCTION public.inquiry_offer_history_insert_trigger() FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiry_offer_history TO authenticated, service_role;
