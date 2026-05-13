-- Reisegruppen-spezifische Felder zu v2_events hinzufügen
ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS arrival_time text,
  ADD COLUMN IF NOT EXISTS preferred_menu text,
  ADD COLUMN IF NOT EXISTS travel_plan_url text,
  ADD COLUMN IF NOT EXISTS travel_plan_filename text,
  ADD COLUMN IF NOT EXISTS preferred_date_flexible boolean DEFAULT false;
