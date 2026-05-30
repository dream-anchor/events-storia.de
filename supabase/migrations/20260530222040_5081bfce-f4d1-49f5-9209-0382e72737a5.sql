ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS last_translated_language TEXT;

COMMENT ON COLUMN public.v2_events.last_translated_language IS
  'Letzte Sprache, in der Anschreiben/Menü/AI-Texte aktiv re-synchronisiert wurden. Banner-Erkennung im Editor.';