-- Erweitere email_templates Tabelle
ALTER TABLE public.email_templates 
ADD COLUMN IF NOT EXISTS subject TEXT,
ADD COLUMN IF NOT EXISTS variables TEXT[] DEFAULT '{}';

-- Update existing rows to have a default subject
UPDATE public.email_templates SET subject = name WHERE subject IS NULL;

-- Make subject NOT NULL after setting defaults
ALTER TABLE public.email_templates ALTER COLUMN subject SET NOT NULL;

-- Füge Reminder-Tracking zu event_inquiries hinzu
ALTER TABLE public.event_inquiries
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Füge Standard-Vorlagen ein (nur wenn noch nicht vorhanden)
INSERT INTO public.email_templates (name, subject, content, category, variables, is_active, sort_order)
VALUES 
  (
    'Firmenfeier Angebot',
    'Ihr exklusives Angebot für Ihre Firmenfeier bei STORIA',
    'Sehr geehrte/r {{contact_name}},

vielen Dank für Ihr Interesse an einer Firmenfeier bei STORIA.

Gerne unterbreiten wir Ihnen folgendes Angebot für Ihre Veranstaltung am {{event_date}} mit {{guest_count}} Gästen:

{{offer_details}}

{{payment_links}}

Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.

Mit freundlichen Grüßen
Ihr STORIA Events Team',
    'angebot',
    ARRAY['contact_name', 'event_date', 'guest_count', 'offer_details', 'payment_links'],
    true,
    1
  ),
  (
    'Hochzeit Angebot',
    'Ihr Hochzeitsangebot von STORIA – Ein unvergesslicher Tag',
    'Liebe/r {{contact_name}},

herzlichen Glückwunsch zu Ihrer bevorstehenden Hochzeit!

Wir freuen uns sehr, dass Sie Ihren besonderen Tag bei uns im STORIA feiern möchten. Für Ihre Hochzeitsfeier am {{event_date}} mit {{guest_count}} Gästen haben wir folgendes Angebot zusammengestellt:

{{offer_details}}

{{payment_links}}

Wir würden uns freuen, Teil Ihres besonderen Tages zu sein.

Herzliche Grüße
Ihr STORIA Events Team',
    'angebot',
    ARRAY['contact_name', 'event_date', 'guest_count', 'offer_details', 'payment_links'],
    true,
    2
  ),
  (
    'Geburtstag Angebot',
    'Ihr Geburtstagsangebot von STORIA',
    'Liebe/r {{contact_name}},

vielen Dank für Ihre Anfrage für eine Geburtstagsfeier bei STORIA!

Für Ihre Feier am {{event_date}} mit {{guest_count}} Gästen bieten wir Ihnen:

{{offer_details}}

{{payment_links}}

Wir freuen uns darauf, Ihren Geburtstag zu einem unvergesslichen Erlebnis zu machen!

Mit besten Grüßen
Ihr STORIA Events Team',
    'angebot',
    ARRAY['contact_name', 'event_date', 'guest_count', 'offer_details', 'payment_links'],
    true,
    3
  ),
  (
    'Standard Angebot',
    'Ihr Angebot von STORIA Events',
    'Sehr geehrte/r {{contact_name}},

vielen Dank für Ihre Anfrage bei STORIA Events.

Gerne unterbreiten wir Ihnen folgendes Angebot für Ihre Veranstaltung am {{event_date}} mit {{guest_count}} Gästen:

{{offer_details}}

{{payment_links}}

Für Rückfragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr STORIA Events Team',
    'angebot',
    ARRAY['contact_name', 'event_date', 'guest_count', 'offer_details', 'payment_links'],
    true,
    10
  )
ON CONFLICT DO NOTHING;