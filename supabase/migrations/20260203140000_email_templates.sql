-- ============================================
-- EMAIL TEMPLATES TABLE
-- ============================================
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'angebot',
    variables TEXT[] DEFAULT ARRAY['{{kundenname}}', '{{eventdatum}}', '{{paketname}}', '{{gaeste}}'],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast category lookups
CREATE INDEX idx_email_templates_category ON public.email_templates(category);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage
CREATE POLICY "Admins can manage email_templates"
    ON public.email_templates FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT DEFAULT TEMPLATES
-- ============================================
INSERT INTO public.email_templates (name, subject, body, category) VALUES
(
    'Firmenfeier Angebot',
    'Ihr Angebot für die Firmenfeier',
    'Guten Tag {{kundenname}},

vielen Dank für Ihre Anfrage bezüglich Ihrer Firmenfeier.

Gerne unterbreiten wir Ihnen folgendes Angebot für {{gaeste}} Gäste am {{eventdatum}}:

[Angebot Details hier einfügen]

Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.

Mit freundlichen Grüßen',
    'angebot'
),
(
    'Hochzeit Angebot',
    'Ihr Angebot für Ihre Hochzeitsfeier',
    'Liebe {{kundenname}},

herzlichen Glückwunsch zu Ihrer bevorstehenden Hochzeit!

Wir freuen uns sehr, dass Sie an uns gedacht haben und unterbreiten Ihnen gerne ein individuelles Angebot für Ihren besonderen Tag am {{eventdatum}} mit {{gaeste}} Gästen:

[Angebot Details hier einfügen]

Wir würden uns freuen, Ihren großen Tag kulinarisch begleiten zu dürfen.

Herzliche Grüße',
    'angebot'
),
(
    'Geburtstag Angebot',
    'Ihr Angebot für Ihre Geburtstagsfeier',
    'Guten Tag {{kundenname}},

vielen Dank für Ihre Anfrage zu Ihrer Geburtstagsfeier.

Für {{gaeste}} Gäste am {{eventdatum}} haben wir folgendes Angebot zusammengestellt:

[Angebot Details hier einfügen]

Wir freuen uns auf Ihre Rückmeldung.

Mit freundlichen Grüßen',
    'angebot'
),
(
    'Standard Angebot',
    'Ihr Angebot von STORIA Events',
    'Guten Tag {{kundenname}},

vielen Dank für Ihre Anfrage.

Für Ihr Event am {{eventdatum}} mit {{gaeste}} Gästen unterbreiten wir Ihnen folgendes Angebot:

[Angebot Details hier einfügen]

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen',
    'angebot'
);
