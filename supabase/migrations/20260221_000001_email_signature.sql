-- E-Mail-Signatur als eigenes Template (category='signatur')
-- Wird automatisch an alle ausgehenden E-Mails angehängt
-- Im Online-Angebot wird nur der Name angezeigt (ohne Firmendaten)

INSERT INTO email_templates (name, subject, content, category, is_active, sort_order)
VALUES (
  'E-Mail-Signatur',
  '',
  'Speranza GmbH
Karlstraße 47a
80333 München
Deutschland

Telefon: +49 89 51519696
E-Mail: info@events-storia.de

Vertreten durch die Geschäftsführerin:
Agnese Lettieri

Registereintrag
Eingetragen im Handelsregister des Amtsgerichts München
Handelsregisternummer: HRB 209637

Umsatzsteuer-ID
DE 296024880

Steuernummer
143/182/00980',
  'signatur',
  true,
  0
)
ON CONFLICT DO NOTHING;
