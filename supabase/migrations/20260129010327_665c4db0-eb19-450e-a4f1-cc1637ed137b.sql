-- Add public SELECT policy for packages (active packages only)
CREATE POLICY "Active packages are viewable by everyone"
ON public.packages
FOR SELECT
USING (is_active = true);