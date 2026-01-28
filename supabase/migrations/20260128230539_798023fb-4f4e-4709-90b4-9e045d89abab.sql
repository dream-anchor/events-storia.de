-- Create table to link menu items to packages
CREATE TABLE public.package_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  item_source TEXT NOT NULL CHECK (item_source IN ('catering', 'ristorante')),
  item_id TEXT NOT NULL, -- UUID as text to support external IDs
  item_name TEXT NOT NULL, -- Cached for display
  item_price NUMERIC, -- Cached price at time of assignment
  quantity INTEGER NOT NULL DEFAULT 1,
  is_included BOOLEAN DEFAULT true, -- Whether included in package price or add-on
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(package_id, item_source, item_id)
);

-- Enable RLS
ALTER TABLE public.package_menu_items ENABLE ROW LEVEL SECURITY;

-- Admins can manage package menu items
CREATE POLICY "Admins can manage package_menu_items"
ON public.package_menu_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can view package menu items for active packages
CREATE POLICY "Package menu items viewable by everyone"
ON public.package_menu_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.packages 
    WHERE packages.id = package_menu_items.package_id 
    AND packages.is_active = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_package_menu_items_updated_at
BEFORE UPDATE ON public.package_menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();