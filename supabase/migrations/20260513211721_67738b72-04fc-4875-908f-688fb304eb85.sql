
CREATE TABLE public.staff_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text DEFAULT 'h',
  default_quantity integer NOT NULL DEFAULT 4,
  price_per_unit numeric NOT NULL DEFAULT 0,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage staff_catalog"
ON public.staff_catalog FOR ALL
USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff read staff_catalog"
ON public.staff_catalog FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_staff_catalog_updated_at
BEFORE UPDATE ON public.staff_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.staff_catalog (name, unit, default_quantity, price_per_unit, sort_order) VALUES
  ('Servicekraft', 'h', 4, 35, 10),
  ('Barkeeper', 'h', 4, 40, 20),
  ('Koch', 'h', 4, 50, 30),
  ('Spüler', 'h', 4, 25, 40),
  ('Fahrer', 'h', 2, 30, 50);
