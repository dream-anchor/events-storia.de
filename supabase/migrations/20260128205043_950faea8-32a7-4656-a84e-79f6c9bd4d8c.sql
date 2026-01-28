-- Create junction table for package-location relationships
CREATE TABLE public.package_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(package_id, location_id)
);

-- Enable RLS
ALTER TABLE public.package_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage package_locations" 
ON public.package_locations FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Package locations viewable by everyone" 
ON public.package_locations FOR SELECT 
USING (true);

-- Rename location and update descriptions
UPDATE public.locations 
SET name = 'Gesamte Location (sitzend)',
    name_en = 'Full Location (seated)',
    description = 'Zwei miteinander verbundene Räume',
    description_en = 'Two interconnected rooms'
WHERE name = 'Kombinierte Räume (sitzend)';

UPDATE public.locations 
SET description = 'Zwei miteinander verbundene Räume',
    description_en = 'Two interconnected rooms'
WHERE name = 'Gesamte Location (stehend)';