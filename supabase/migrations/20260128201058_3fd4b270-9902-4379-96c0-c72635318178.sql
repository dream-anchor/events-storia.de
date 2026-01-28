-- Create inquiry_type enum for differentiating EVENT vs CATERING
CREATE TYPE public.inquiry_type AS ENUM ('event', 'catering');

-- Add type column to event_inquiries (unified inquiries table)
ALTER TABLE public.event_inquiries 
ADD COLUMN IF NOT EXISTS inquiry_type public.inquiry_type DEFAULT 'event';

-- Add additional fields for the smart editor
ALTER TABLE public.event_inquiries
ADD COLUMN IF NOT EXISTS room_selection text,
ADD COLUMN IF NOT EXISTS time_slot text,
ADD COLUMN IF NOT EXISTS delivery_street text,
ADD COLUMN IF NOT EXISTS delivery_zip text,
ADD COLUMN IF NOT EXISTS delivery_city text,
ADD COLUMN IF NOT EXISTS delivery_time_slot text,
ADD COLUMN IF NOT EXISTS selected_items jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS selected_packages jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS quote_items jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS quote_notes text,
ADD COLUMN IF NOT EXISTS email_draft text,
ADD COLUMN IF NOT EXISTS lexoffice_quotation_id text;

-- Create packages table for event packages/pauschalen
CREATE TABLE public.packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    name_en text,
    description text,
    description_en text,
    package_type text NOT NULL DEFAULT 'general', -- e.g., 'hochzeit', 'firmenfeier', 'getraenke', 'general'
    price numeric NOT NULL DEFAULT 0,
    price_per_person boolean DEFAULT false,
    min_guests integer,
    max_guests integer,
    includes jsonb DEFAULT '[]'::jsonb, -- Array of included items/services
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on packages
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Packages policies
CREATE POLICY "Packages are viewable by admins"
ON public.packages FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert packages"
ON public.packages FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update packages"
ON public.packages FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete packages"
ON public.packages FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create email_templates table for standard text snippets
CREATE TABLE public.email_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text NOT NULL DEFAULT 'general', -- e.g., 'storno', 'allergiker', 'zahlungsbedingungen'
    content text NOT NULL,
    content_en text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Email templates policies
CREATE POLICY "Templates are viewable by admins"
ON public.email_templates FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert templates"
ON public.email_templates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update templates"
ON public.email_templates FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete templates"
ON public.email_templates FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert some default packages
INSERT INTO public.packages (name, description, package_type, price, price_per_person, min_guests) VALUES
('Hochzeitspaket Premium', 'Vollständiges Hochzeitsmenü inkl. Aperitivo, 4-Gänge-Menü, Dessertbuffet', 'hochzeit', 89, true, 30),
('Hochzeitspaket Classic', '3-Gänge-Menü mit Aperitivo und Kaffee', 'hochzeit', 69, true, 20),
('Getränkepauschale 4h', 'Softdrinks, Wein, Bier, Kaffee für 4 Stunden', 'getraenke', 35, true, 10),
('Getränkepauschale 6h', 'Softdrinks, Wein, Bier, Kaffee für 6 Stunden', 'getraenke', 45, true, 10),
('Firmenfeier Business', 'Flying Buffet mit Premium-Auswahl und Getränken', 'firmenfeier', 55, true, 15),
('Geburtstag Family', 'Familienfreundliches Buffet mit Kinderoptionen', 'geburtstag', 45, true, 10);

-- Insert default email templates
INSERT INTO public.email_templates (name, category, content) VALUES
('Stornobedingungen', 'storno', 'Stornierungen bis 14 Tage vor dem Event sind kostenfrei. Danach berechnen wir 50% des Gesamtbetrags. Absagen innerhalb von 48 Stunden vor dem Event werden vollständig berechnet.'),
('Allergiker-Hinweis', 'allergiker', 'Bitte teilen Sie uns Allergien oder Unverträglichkeiten Ihrer Gäste mindestens 7 Tage vor dem Event mit, damit wir entsprechende Alternativen vorbereiten können.'),
('Zahlungsbedingungen', 'zahlung', 'Die Zahlung erfolgt nach Erhalt der Rechnung innerhalb von 14 Tagen. Bei Buchungen über 1.000€ bitten wir um eine Anzahlung von 30%.'),
('Lieferhinweis', 'lieferung', 'Die Lieferung erfolgt zum vereinbarten Zeitpunkt. Bitte stellen Sie sicher, dass eine Person zur Annahme bereitsteht. Aufbau und Abbau sind im Lieferpreis enthalten.');

-- Add trigger for updated_at on packages
CREATE TRIGGER update_packages_updated_at
BEFORE UPDATE ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();