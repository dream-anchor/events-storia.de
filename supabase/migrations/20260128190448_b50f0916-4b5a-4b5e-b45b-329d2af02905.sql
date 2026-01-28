-- Create storage bucket for catering images
INSERT INTO storage.buckets (id, name, public)
VALUES ('catering-images', 'catering-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for catering images"
ON storage.objects FOR SELECT
USING (bucket_id = 'catering-images');

-- Allow admins to upload images
CREATE POLICY "Admins can upload catering images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'catering-images' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to update images
CREATE POLICY "Admins can update catering images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'catering-images' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete images
CREATE POLICY "Admins can delete catering images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'catering-images' 
  AND public.has_role(auth.uid(), 'admin')
);