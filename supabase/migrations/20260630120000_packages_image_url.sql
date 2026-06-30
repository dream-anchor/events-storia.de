-- Bild pro Paket: im Admin-Paketeditor frei wählbar.
-- Upload läuft in den public Bucket "catering-images" -> dauerhafte öffentliche URL.
-- Das Frontend fällt auf das namensbasierte Default-Bild zurück, wenn image_url leer ist.
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS image_url text;
