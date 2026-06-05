ALTER TABLE public.photo_album
  ADD COLUMN IF NOT EXISTS source_origin TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_filename TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS photo_album_source_unique_idx
  ON public.photo_album (source_origin, source_filename)
  WHERE source_origin IS NOT NULL;