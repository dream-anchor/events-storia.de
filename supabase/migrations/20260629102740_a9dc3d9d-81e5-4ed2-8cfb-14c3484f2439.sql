-- Foto-Ordner: manuelle Organisationsebene neben den KI-Kategorien.
-- Ein Foto kann in mehreren Ordnern liegen (many-to-many).
-- Hinweis: photo_album hat (noch) keine tenant_id -> Ordner ebenfalls ohne.
-- Wenn photo_album in einer späteren MT-Phase tenant_id bekommt, hier nachziehen.

-- 1) Ordner-Tabelle
CREATE TABLE IF NOT EXISTS public.photo_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Zuordnung Foto <-> Ordner (many-to-many)
CREATE TABLE IF NOT EXISTS public.photo_folder_items (
  folder_id uuid NOT NULL REFERENCES public.photo_folders(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.photo_album(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, photo_id)
);

CREATE INDEX IF NOT EXISTS photo_folder_items_photo_idx ON public.photo_folder_items (photo_id);
CREATE INDEX IF NOT EXISTS photo_folder_items_folder_idx ON public.photo_folder_items (folder_id);
CREATE INDEX IF NOT EXISTS photo_folders_sort_idx ON public.photo_folders (sort_order, created_at);

-- 3) GRANTs (Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_folders TO authenticated;
GRANT ALL ON public.photo_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_folder_items TO authenticated;
GRANT ALL ON public.photo_folder_items TO service_role;

-- 4) RLS (Admin + Staff; gleiche Logik wie photo_album)
ALTER TABLE public.photo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_folder_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff manage folders"
ON public.photo_folders FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff manage folder items"
ON public.photo_folder_items FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- 5) updated_at-Trigger
CREATE TRIGGER photo_folders_updated_at
BEFORE UPDATE ON public.photo_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Realtime (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'photo_folders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_folders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'photo_folder_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_folder_items;
  END IF;
END $$;