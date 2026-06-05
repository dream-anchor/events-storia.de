
ALTER TABLE public.photo_album
  ADD COLUMN IF NOT EXISTS parent_photo_id uuid REFERENCES public.photo_album(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_photo_album_parent_version
  ON public.photo_album (parent_photo_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_photo_album_is_current
  ON public.photo_album (is_current) WHERE is_current = true;
