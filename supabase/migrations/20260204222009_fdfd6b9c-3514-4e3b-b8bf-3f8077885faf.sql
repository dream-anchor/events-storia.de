-- Migration: Add localized slug columns to menus table
-- Purpose: Enable multi-language URLs for special occasion menus

-- Add slug columns for EN, IT, FR
ALTER TABLE menus ADD COLUMN IF NOT EXISTS slug_en TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS slug_it TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS slug_fr TEXT;

-- Create index for faster lookups across all slug columns
CREATE INDEX IF NOT EXISTS idx_menus_slug_en ON menus(slug_en) WHERE slug_en IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menus_slug_it ON menus(slug_it) WHERE slug_it IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menus_slug_fr ON menus(slug_fr) WHERE slug_fr IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN menus.slug_en IS 'English URL slug for the menu (auto-generated or manual)';
COMMENT ON COLUMN menus.slug_it IS 'Italian URL slug for the menu (auto-generated or manual)';
COMMENT ON COLUMN menus.slug_fr IS 'French URL slug for the menu (auto-generated or manual)';

-- Update existing menus with auto-translated slugs (basic translation)

-- Valentinstag -> valentines / san-valentino / saint-valentin
UPDATE menus SET
  slug_en = REPLACE(REPLACE(slug, 'valentinstag', 'valentines'), 'menue', 'menu'),
  slug_it = REPLACE(REPLACE(slug, 'valentinstag', 'san-valentino'), 'menue', 'menu'),
  slug_fr = REPLACE(REPLACE(slug, 'valentinstag', 'saint-valentin'), 'menue', 'menu')
WHERE slug LIKE '%valentinstag%' AND slug_en IS NULL;

-- Weihnachts -> christmas / natale / noel
UPDATE menus SET
  slug_en = REPLACE(REPLACE(slug, 'weihnachts', 'christmas-'), 'menues', 'menus'),
  slug_it = REPLACE(REPLACE(slug, 'weihnachts', 'natale-'), 'menues', 'menu'),
  slug_fr = REPLACE(REPLACE(slug, 'weihnachts', 'noel-'), 'menues', 'menus')
WHERE slug LIKE '%weihnacht%' AND slug_en IS NULL;

-- Silvester -> new-years / capodanno / nouvel-an
UPDATE menus SET
  slug_en = REPLACE(slug, 'silvester', 'new-years'),
  slug_it = REPLACE(slug, 'silvester', 'capodanno'),
  slug_fr = REPLACE(slug, 'silvester', 'nouvel-an')
WHERE slug LIKE '%silvester%' AND slug_en IS NULL;

-- Ostern -> easter / pasqua / paques
UPDATE menus SET
  slug_en = REPLACE(slug, 'ostern', 'easter'),
  slug_it = REPLACE(slug, 'ostern', 'pasqua'),
  slug_fr = REPLACE(slug, 'ostern', 'paques')
WHERE slug LIKE '%ostern%' AND slug_en IS NULL;

-- For any remaining menus without translations, copy the German slug as fallback
UPDATE menus SET slug_en = slug WHERE slug_en IS NULL AND slug IS NOT NULL;
UPDATE menus SET slug_it = slug WHERE slug_it IS NULL AND slug IS NOT NULL;
UPDATE menus SET slug_fr = slug WHERE slug_fr IS NULL AND slug IS NOT NULL;