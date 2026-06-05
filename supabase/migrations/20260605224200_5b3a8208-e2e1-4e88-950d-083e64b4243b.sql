ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS homepage_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS menu_categories_homepage_slug_uniq
  ON public.menu_categories (homepage_slug)
  WHERE homepage_slug IS NOT NULL AND deleted_at IS NULL AND archived_at IS NULL;

-- Backfill homepage_slug for existing categories so they map to the homepage cards
UPDATE public.menu_categories SET homepage_slug = 'fingerfood'
  WHERE homepage_slug IS NULL AND lower(name) LIKE 'fingerfood%';

UPDATE public.menu_categories SET homepage_slug = 'platten'
  WHERE homepage_slug IS NULL AND lower(name) LIKE 'platten%';

UPDATE public.menu_categories SET homepage_slug = 'auflauf'
  WHERE homepage_slug IS NULL AND (lower(name) LIKE 'warme%' OR lower(name) LIKE '%auflauf%');

UPDATE public.menu_categories SET homepage_slug = 'desserts'
  WHERE homepage_slug IS NULL AND lower(name) LIKE 'dessert%';

UPDATE public.menu_categories SET homepage_slug = 'pizza'
  WHERE homepage_slug IS NULL AND id = 'cccc3333-3333-3333-3333-333333333332';