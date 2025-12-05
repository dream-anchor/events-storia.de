-- Tabelle für Catering-Bestellungen
CREATE TABLE public.catering_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  company_name text,
  delivery_address text,
  is_pickup boolean DEFAULT false,
  desired_date date,
  desired_time time,
  notes text,
  items jsonb NOT NULL,
  total_amount numeric,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.catering_orders ENABLE ROW LEVEL SECURITY;

-- Jeder kann Bestellungen erstellen (Gäste)
CREATE POLICY "Anyone can insert orders"
ON public.catering_orders
FOR INSERT
WITH CHECK (true);

-- Nur Admins können Bestellungen lesen
CREATE POLICY "Admins can view all orders"
ON public.catering_orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Nur Admins können Bestellungen aktualisieren
CREATE POLICY "Admins can update orders"
ON public.catering_orders
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Nur Admins können Bestellungen löschen
CREATE POLICY "Admins can delete orders"
ON public.catering_orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));