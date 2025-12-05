-- Add 'catering' to the menu_type enum
ALTER TYPE menu_type ADD VALUE 'catering';

-- Add image_url column to menu_items for catering images
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url text;

-- Add serving_info column for serving information (e.g., "Ein Fingerfood-Glas pro Person")
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS serving_info text;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS serving_info_en text;

-- Add min_order column for minimum order information (e.g., "Ab 4 Personen bestellbar")
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS min_order text;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS min_order_en text;

-- Add additional_info to menus for extra content like "Zusatzleistungen"
ALTER TABLE menus ADD COLUMN IF NOT EXISTS additional_info text;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS additional_info_en text;