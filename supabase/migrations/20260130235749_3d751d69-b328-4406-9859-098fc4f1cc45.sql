-- Add created_in_version column to track when an option was first created
ALTER TABLE public.inquiry_offer_options 
ADD COLUMN created_in_version integer;

-- Migrate existing data: set created_in_version based on history or offer_version
UPDATE inquiry_offer_options o
SET created_in_version = COALESCE(
  (SELECT MIN(h.version) FROM inquiry_offer_history h WHERE h.inquiry_id = o.inquiry_id),
  o.offer_version
);