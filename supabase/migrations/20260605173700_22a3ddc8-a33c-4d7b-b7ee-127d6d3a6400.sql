
-- ============================================================
-- Photo Album: table + storage policies
-- ============================================================

CREATE TABLE public.photo_album (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  filename TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  ai_classified BOOLEAN NOT NULL DEFAULT FALSE,
  ai_confidence NUMERIC,
  ai_model TEXT,
  ai_error TEXT,
  title TEXT,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX photo_album_category_idx ON public.photo_album (category) WHERE is_archived = FALSE;
CREATE INDEX photo_album_tags_idx ON public.photo_album USING GIN (tags);
CREATE INDEX photo_album_created_at_idx ON public.photo_album (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_album TO authenticated;
GRANT SELECT ON public.photo_album TO anon;
GRANT ALL ON public.photo_album TO service_role;

ALTER TABLE public.photo_album ENABLE ROW LEVEL SECURITY;

-- Public read (non-archived) — fotos must be visible on public website
CREATE POLICY "Anyone can read non-archived photos"
ON public.photo_album FOR SELECT
USING (is_archived = FALSE);

-- Admins/staff full access
CREATE POLICY "Admins and staff can read all"
ON public.photo_album FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can insert"
ON public.photo_album FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can update"
ON public.photo_album FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can delete"
ON public.photo_album FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- updated_at trigger
CREATE TRIGGER photo_album_updated_at
BEFORE UPDATE ON public.photo_album
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_album;

-- ============================================================
-- Storage policies for photo-album bucket
-- ============================================================

CREATE POLICY "Anyone can view photo-album files"
ON storage.objects FOR SELECT
USING (bucket_id = 'photo-album');

CREATE POLICY "Admins and staff can upload to photo-album"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photo-album'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Admins and staff can update photo-album"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photo-album'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Admins and staff can delete photo-album"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photo-album'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
);
