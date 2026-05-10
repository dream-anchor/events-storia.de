CREATE TABLE IF NOT EXISTS public.equipment_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_quantity integer NOT NULL DEFAULT 1,
  price_per_unit numeric NOT NULL DEFAULT 0,
  unit text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read equipment_catalog" ON public.equipment_catalog
  FOR SELECT USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff manage equipment_catalog" ON public.equipment_catalog
  FOR ALL USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER equipment_catalog_updated_at
  BEFORE UPDATE ON public.equipment_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_equipment_catalog_active_sort
  ON public.equipment_catalog (is_active, sort_order, name);