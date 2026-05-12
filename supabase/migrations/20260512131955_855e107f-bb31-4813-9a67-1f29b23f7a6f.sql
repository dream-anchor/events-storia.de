
-- ====================================================================
-- 1. Erweitere group_inquiries (additiv)
-- ====================================================================
ALTER TABLE public.group_inquiries
  ADD COLUMN IF NOT EXISTS external_id uuid,
  ADD COLUMN IF NOT EXISTS travel_plan_url text,
  ADD COLUMN IF NOT EXISTS travel_plan_filename text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

-- CHECK-Constraint auf Status (nur 'new' existiert aktuell, kompatibel)
ALTER TABLE public.group_inquiries
  DROP CONSTRAINT IF EXISTS group_inquiries_status_check;
ALTER TABLE public.group_inquiries
  ADD CONSTRAINT group_inquiries_status_check
  CHECK (status IN ('new', 'in_progress', 'offer_sent', 'confirmed', 'rejected', 'archived'));

-- Indizes
CREATE INDEX IF NOT EXISTS idx_group_inquiries_status ON public.group_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_group_inquiries_created_at ON public.group_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_inquiries_preferred_date ON public.group_inquiries(preferred_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_inquiries_external_id ON public.group_inquiries(external_id) WHERE external_id IS NOT NULL;

-- updated_at Trigger
DROP TRIGGER IF EXISTS update_group_inquiries_updated_at ON public.group_inquiries;
CREATE TRIGGER update_group_inquiries_updated_at
  BEFORE UPDATE ON public.group_inquiries
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Realtime aktivieren
ALTER TABLE public.group_inquiries REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_inquiries'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_inquiries';
  END IF;
END $$;

-- ====================================================================
-- 2. Erweitere packages (additiv) für Gruppenreisen
-- ====================================================================
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS language_support jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_groups jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extras_available jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS website_menu_key text,
  ADD COLUMN IF NOT EXISTS visible_on_website boolean DEFAULT false;

-- ====================================================================
-- 3. Storage Bucket für Reiseplan-PDFs (privat)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-inquiry-uploads', 'group-inquiry-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Authentifizierte Admins/Staff können PDFs lesen
CREATE POLICY "Authenticated can read group-inquiry-uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'group-inquiry-uploads');

-- ====================================================================
-- 4. Drei Gruppenreisen-Pakete einfügen
-- ====================================================================
INSERT INTO public.packages (
  name, name_en, package_type, subtitle, description,
  price, price_per_person, currency, min_guests, max_guests,
  duration_minutes, language_support, target_groups, includes,
  extras_available, website_menu_key, visible_on_website,
  is_active, sort_order
) VALUES
(
  'Pizza e Pasta', 'Pizza e Pasta', 'gruppenreisen',
  'Das schnelle Pizzeria-Menü für Reisegruppen',
  'Ideal als Mittagsstopp während des Münchner Stadtprogramms. Schneller Service, satte Portionen, klare Auswahl. Begleitende Lehrkräfte und Reiseleiter essen ab 25 Personen kostenfrei mit.',
  25.00, true, 'EUR', 20, 200, 45,
  '["de","en","it","fr"]'::jsonb,
  '["Klassenfahrten","Studienreisen","Bus-Tagesausflüge"]'::jsonb,
  '["Wahl aus 3 klassischen Pizza-Sorten oder Pasta-Klassiker","Wasser und ein Softdrink pro Person","Espresso oder Tee am Ende"]'::jsonb,
  '["Antipasti-Vorspeise: +5 €/Person","Dessert: +4 €/Person","Weinbegleitung: +7 €/Person"]'::jsonb,
  'A', true, true, 100
),
(
  'Benvenuti', 'Benvenuti', 'gruppenreisen',
  'Das mittlere Menü mit italienischem Standard',
  'Drei-Gang-Menü mit Vorspeise, Hauptgang und Dessert. Perfekt für entspannte Mittagessen oder frühe Abendessen mit Stadtprogramm davor und danach.',
  35.00, true, 'EUR', 20, 200, 90,
  '["de","en","it","fr"]'::jsonb,
  '["Vereinsausflüge","Senioren-Reisegruppen","Internationale Reisegruppen"]'::jsonb,
  '["Antipasti-Vorspeise (Tagesvariation)","Hauptgang nach Wahl (Pasta, Pizza, Fleisch oder vegetarisch)","Dessert (Tiramisu, Panna Cotta oder Eis)","Wasser, ein Softdrink, Espresso"]'::jsonb,
  '["Weinbegleitung (3 Gläser): +12 €/Person","Prosecco-Aperitif zur Begrüßung: +6 €/Person"]'::jsonb,
  'B', true, true, 110
),
(
  'Tradizione', 'Tradizione', 'gruppenreisen',
  'Das Premium-Menü für besondere Anlässe',
  'Vier-Gang-Menü mit traditionellen süditalienischen Gerichten. Authentische italienische Küche aus dem Cilento, wie Familie Speranza sie zu Hause kocht. Ideal für Premium-Reisegruppen, Firmenausflüge mit Repräsentationscharakter, Jahres-Höhepunkte.',
  49.00, true, 'EUR', 20, 100, 120,
  '["de","en","it","fr"]'::jsonb,
  '["Firmenausflüge","Jahresreisen","Premium-Tour-Operator"]'::jsonb,
  '["Antipasti-Vielfalt zum Teilen","Pasta-Gang (z.B. handgemachte Tagliatelle mit Cinghiale-Ragout)","Hauptgang (Fisch oder Fleisch, mit Beilagen)","Dessert-Selection","Hauswein-Begleitung (3 Gläser)","Espresso, Grappa oder Limoncello zum Abschluss"]'::jsonb,
  '["Aperitif-Empfang mit Prosecco und Antipasti-Häppchen: +9 €/Person","Sommelier-Empfehlung mit 4 Weinen: +15 €/Person"]'::jsonb,
  'C', true, true, 120
);
