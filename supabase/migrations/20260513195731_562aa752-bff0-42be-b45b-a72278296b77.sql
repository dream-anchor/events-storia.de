
ALTER TABLE public.package_course_config
  ADD COLUMN IF NOT EXISTS course_label_it text,
  ADD COLUMN IF NOT EXISTS course_label_fr text,
  ADD COLUMN IF NOT EXISTS custom_item_name_it text,
  ADD COLUMN IF NOT EXISTS custom_item_name_fr text,
  ADD COLUMN IF NOT EXISTS custom_item_description_en text,
  ADD COLUMN IF NOT EXISTS custom_item_description_it text,
  ADD COLUMN IF NOT EXISTS custom_item_description_fr text;

ALTER TABLE public.package_drink_config
  ADD COLUMN IF NOT EXISTS drink_label_it text,
  ADD COLUMN IF NOT EXISTS drink_label_fr text,
  ADD COLUMN IF NOT EXISTS quantity_label_it text,
  ADD COLUMN IF NOT EXISTS quantity_label_fr text,
  ADD COLUMN IF NOT EXISTS options_translations jsonb;
