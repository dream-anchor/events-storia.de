-- =====================================================
-- MENÜ-KOMPOSITIONS-SYSTEM: Datenbank-Erweiterungen
-- =====================================================

-- 1. Neue Tabelle: package_course_config
CREATE TABLE public.package_course_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  course_type TEXT NOT NULL,
  course_label TEXT NOT NULL,
  course_label_en TEXT,
  is_required BOOLEAN DEFAULT true,
  allowed_sources TEXT[] DEFAULT ARRAY['ristorante'],
  allowed_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_custom_item BOOLEAN DEFAULT false,
  custom_item_name TEXT,
  custom_item_name_en TEXT,
  custom_item_description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Neue Tabelle: package_drink_config
CREATE TABLE public.package_drink_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  drink_group TEXT NOT NULL,
  drink_label TEXT NOT NULL,
  drink_label_en TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  quantity_per_person TEXT,
  quantity_label TEXT,
  quantity_label_en TEXT,
  is_choice BOOLEAN DEFAULT false,
  is_included BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Erweiterung event_inquiries
ALTER TABLE public.event_inquiries 
ADD COLUMN IF NOT EXISTS menu_selection JSONB DEFAULT '{}'::jsonb;

-- 4. RLS für package_course_config
ALTER TABLE public.package_course_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Course configs viewable by everyone"
ON public.package_course_config FOR SELECT
USING (EXISTS (SELECT 1 FROM packages WHERE packages.id = package_course_config.package_id AND packages.is_active = true));

CREATE POLICY "Admins can manage course configs"
ON public.package_course_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. RLS für package_drink_config
ALTER TABLE public.package_drink_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drink configs viewable by everyone"
ON public.package_drink_config FOR SELECT
USING (EXISTS (SELECT 1 FROM packages WHERE packages.id = package_drink_config.package_id AND packages.is_active = true));

CREATE POLICY "Admins can manage drink configs"
ON public.package_drink_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Indizes
CREATE INDEX idx_package_course_config_package ON public.package_course_config(package_id);
CREATE INDEX idx_package_drink_config_package ON public.package_drink_config(package_id)