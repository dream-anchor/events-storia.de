-- Fix INSTEAD-OF triggers on inquiry_offer_options view: map 'freeform' correctly
CREATE OR REPLACE FUNCTION public.inquiry_offer_options_insert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_id uuid; v_mode v2_offer_mode;
BEGIN
  v_mode := CASE NEW.offer_mode
    WHEN 'alacarte' THEN 'alacarte'::v2_offer_mode
    WHEN 'a_la_carte' THEN 'alacarte'::v2_offer_mode
    WHEN 'partial_menu' THEN 'partial_menu'::v2_offer_mode
    WHEN 'teil_menu' THEN 'partial_menu'::v2_offer_mode
    WHEN 'full_menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'fest_menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'paket' THEN 'package'::v2_offer_mode
    WHEN 'package' THEN 'package'::v2_offer_mode
    WHEN 'email' THEN 'email'::v2_offer_mode
    WHEN 'freeform' THEN 'freeform'::v2_offer_mode
    ELSE NULL
  END;

  INSERT INTO v2_offer_options (
    id, event_id, label, package_id, offer_mode, menu_selection,
    guest_count, amount_total, version, is_active,
    stripe_payment_link_id, stripe_payment_link_url, sort_order,
    created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), NEW.inquiry_id, COALESCE(NEW.option_label,'A'),
    NEW.package_id, v_mode, NEW.menu_selection,
    NEW.guest_count, NEW.total_amount, COALESCE(NEW.offer_version,1), COALESCE(NEW.is_active,true),
    NEW.stripe_payment_link_id, NEW.stripe_payment_link_url, COALESCE(NEW.sort_order,0),
    COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
  ) RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.inquiry_offer_options_update_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_mode v2_offer_mode;
BEGIN
  v_mode := CASE NEW.offer_mode
    WHEN 'alacarte' THEN 'alacarte'::v2_offer_mode
    WHEN 'a_la_carte' THEN 'alacarte'::v2_offer_mode
    WHEN 'partial_menu' THEN 'partial_menu'::v2_offer_mode
    WHEN 'teil_menu' THEN 'partial_menu'::v2_offer_mode
    WHEN 'full_menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'fest_menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'menu' THEN 'full_menu'::v2_offer_mode
    WHEN 'paket' THEN 'package'::v2_offer_mode
    WHEN 'package' THEN 'package'::v2_offer_mode
    WHEN 'email' THEN 'email'::v2_offer_mode
    WHEN 'freeform' THEN 'freeform'::v2_offer_mode
    ELSE NULL
  END;
  UPDATE v2_offer_options SET
    label = NEW.option_label, package_id = NEW.package_id, offer_mode = v_mode,
    menu_selection = NEW.menu_selection, guest_count = NEW.guest_count,
    amount_total = NEW.total_amount, version = COALESCE(NEW.offer_version,1),
    is_active = NEW.is_active,
    stripe_payment_link_id = NEW.stripe_payment_link_id,
    stripe_payment_link_url = NEW.stripe_payment_link_url,
    sort_order = NEW.sort_order, updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END $function$;

-- Backfill: mark freeform options correctly + restore lost total for the user's row
UPDATE public.v2_offer_options
SET offer_mode = 'freeform'::v2_offer_mode
WHERE menu_selection ? 'freeformProgram'
  AND (offer_mode IS NULL OR offer_mode <> 'freeform'::v2_offer_mode);

UPDATE public.v2_offer_options
SET amount_total = COALESCE(
  GREATEST(
    0,
    NULLIF((menu_selection->'freeformProgram'->'totalsFromText'->>'gross'),'')::numeric
    - CASE
        WHEN (menu_selection->'freeformProgram'->'discount'->>'mode') = 'percent'
          THEN COALESCE(NULLIF((menu_selection->'freeformProgram'->'totalsFromText'->>'gross'),'')::numeric,0)
               * COALESCE(NULLIF((menu_selection->'freeformProgram'->'discount'->>'value'),'')::numeric,0) / 100
        WHEN (menu_selection->'freeformProgram'->'discount'->>'mode') = 'amount'
          THEN COALESCE(NULLIF((menu_selection->'freeformProgram'->'discount'->>'value'),'')::numeric,0)
        ELSE 0
      END
  ),
  amount_total
)
WHERE menu_selection ? 'freeformProgram'
  AND (amount_total IS NULL OR amount_total = 0);