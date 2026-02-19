-- ============================================
-- STORIA Vorlagen + Textbausteine
-- ============================================

-- Alte generische Templates deaktivieren
UPDATE public.email_templates SET is_active = false
WHERE category = 'angebot';

-- Sortierung hinzufügen (falls nicht vorhanden)
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- ============================================
-- 6 STORIA Vorlagen (entweder/oder)
-- ============================================

INSERT INTO public.email_templates (name, subject, body, category, sort_order, variables) VALUES
(
    'Network Aperitif',
    'Ihr Angebot: Network-Aperitivo im STORIA',
    'Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage und Ihr Interesse an einer Veranstaltung im STORIA. Gerne stellen wir Ihnen unser Business-Format vor.

Network-Aperitivo
69,00 € pro Person inkl. Getränke-Paket
ab 10 Personen
max. 45 Personen

Steh- oder Mixed-Event im Bar- und Open-Kitchen-Bereich.
Inklusive 4 italienische Fingerfood-Variationen sowie 1 Pasta oder Pizza pro Person.
Zusätzlich 5 Drinks pro Person nach Wahl, z. B. Spritz, Wein, Bier oder Cocktail.
Wasser und Kaffee sind ebenfalls inklusive.

Dieses Format eignet sich ideal für lockere Business-Events oder Networking-Veranstaltungen in kommunikativer Atmosphäre.

Für eine persönliche Abstimmung erreichen Sie uns jederzeit direkt:
Domenico Speranza – 0163 6033912
Madina Khader – 0179 2200921

Wir freuen uns darauf, Ihr Event gemeinsam mit Ihnen zu realisieren.

Mit freundlichen Grüßen
Domenico Speranza & Madina Khader
STORIA · Karlstraße 47a · 80333 München',
    'vorlage',
    1,
    ARRAY['{{kundenname}}', '{{eventdatum}}', '{{gaeste}}']
),
(
    'Business Dinner Exclusive',
    'Ihr Angebot: Business Dinner im STORIA',
    'Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage und Ihr Interesse an einer Veranstaltung im STORIA. Gerne stellen wir Ihnen unser Business-Format vor.

Business Dinner – Exclusive
99,00 € pro Person inkl. Getränke-Paket zzgl. gesetzlicher MwSt.
ab 10 Personen
max. 65 Personen
Exklusiver Raum ab 40 Personen

Exklusives Dinner im Private Room mit:
• Welcome-Aperitivo
• Vorspeisen
• Hauptgang
• Hausgemachtem Dessert
• Weinbegleitung, Wasser und Kaffee

Alternativ:
Zusätzlich 6 Drinks pro Person nach Wahl, z. B. Spritz, Wein, Bier oder Cocktail.
Wasser und Kaffee sind ebenfalls inklusive.

Gerne passen wir die Konzepte individuell an Ihr Event an. Für die Ausarbeitung eines konkreten Angebots freuen wir uns über folgende Informationen:
• gewünschtes Datum und Zeitraum
• geplante Personenanzahl
• Art des Events
• gewünschtes Catering-Format
• technischer Bedarf

Für eine persönliche Abstimmung erreichen Sie uns jederzeit direkt:
Domenico Speranza – 0163 6033912
Madina Khader – 0179 2200921

Wir freuen uns darauf, Ihr Event gemeinsam mit Ihnen zu realisieren.

Mit freundlichen Grüßen
Domenico Speranza & Madina Khader
STORIA · Karlstraße 47a · 80333 München',
    'vorlage',
    2,
    ARRAY['{{kundenname}}', '{{eventdatum}}', '{{gaeste}}']
),
(
    'Gesamte Location',
    'Ihr Angebot: Exklusive Location-Nutzung STORIA',
    'Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage und Ihr Interesse an einer exklusiven Veranstaltung im STORIA.

Gerne stellen wir Ihnen unser Paket für die gesamte Location vor.

Gesamte Location
8.500,00 € inkl. Getränke-Paket zzgl. gesetzlicher MwSt.
ab 70 Personen
max. 100 Personen

Exklusive Nutzung der gesamten STORIA-Location mit Platz für bis zu 100 Personen sitzend oder bis zu 180 Personen stehend.

Im Paket enthalten:
• Individuell gestaltbares Raum- und Bestuhlungskonzept, flexibel abgestimmt auf Ihr Veranstaltungskonzept
• Firmenbranding in der Location möglich
• Maßgeschneidertes Menü nach Ihren kulinarischen Vorstellungen
• Inklusive Getränke-Paket

Dieses Format eignet sich ideal für Firmenfeiern, Jahresauftaktveranstaltungen, Produktpräsentationen oder exklusive Kundenevents.

Gerne passen wir das Konzept individuell an Ihr Event an. Für die Ausarbeitung eines konkreten Angebots freuen wir uns über folgende Informationen:
• gewünschtes Datum und Zeitraum
• geplante Personenanzahl
• Art des Events
• gewünschtes Catering-Format
• technischer Bedarf
• gewünschtes Branding oder besondere Gestaltungselemente

Für eine persönliche Abstimmung erreichen Sie uns jederzeit direkt:
Domenico Speranza – 0163 6033912
Madina Khader – 0179 2200921

Wir freuen uns darauf, Ihr Event gemeinsam mit Ihnen zu realisieren.

Mit freundlichen Grüßen
Domenico Speranza & Madina Khader
STORIA · Karlstraße 47a · 80333 München',
    'vorlage',
    3,
    ARRAY['{{kundenname}}', '{{eventdatum}}', '{{gaeste}}']
),
(
    'Allgemein Restaurant Exclusiv',
    'Ihre Anfrage: Exklusive Nutzung im STORIA',
    'Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage und Ihr Interesse an einer Veranstaltung im STORIA. Gerne unterstützen wir Sie bei der Planung und professionellen Umsetzung Ihres Events.

Unsere klimatisierten und voll möblierten Restaurant-Räumlichkeiten bieten ein stilvoll gestaltetes Ambiente und Platz für bis zu 100 Personen sitzend oder bis zu 180 Personen stehend im Innenbereich.

Zusätzlich steht Ihnen unser überdachter Außenbereich zur Verfügung, der ebenfalls für Veranstaltungen in vergleichbarer Größenordnung genutzt werden kann und sich ideal für Empfänge, Aperitifs oder eine separate Eventfläche eignet.

Für eine exklusive Nutzung unserer Location am Vormittag oder Nachmittag berechnen wir regulär eine halbtägige Locationpauschale ab 3.000 €. Während der gebuchten Zeit stehen Ihnen die Räumlichkeiten selbstverständlich exklusiv zur Verfügung.

Raumaufteilung und Bestuhlung passen wir flexibel und individuell an Ihr Veranstaltungskonzept an – ob Business-Lunch, Präsentation, Paneltalk, Firmenfeier oder Abendveranstaltung.

Im Rahmen der Locationpauschale stellen wir Ihnen folgende Basistechnik zur Verfügung:
• Zwei Funkmikrofone
• Leinwand
• Lautsprechersystem

Erweiterte technische Anforderungen, Bühnen- oder Branding-Installationen sowie externe Dienstleister bieten wir bei Bedarf modular und transparent kalkuliert an.

Gerne erstellen wir Ihnen ein maßgeschneidertes Cateringkonzept – vom hochwertigen 3-Gänge-Menü über Flying Buffet bis hin zu individuell abgestimmten Getränkepauschalen.

Für die Ausarbeitung eines konkreten Angebots freuen wir uns über folgende Informationen:
• gewünschtes Datum und Zeitraum
• geplante Personenanzahl (inkl. Team / Technik etc.)
• Art des Events
• gewünschtes Catering-Format
• technischer oder gestalterischer Bedarf

Für eine persönliche Abstimmung stehen Ihnen Herr Domenico Speranza (Mobil: 0163 6033912) oder Frau Madina Khader (Mobil: 0179 2200921) jederzeit gerne zur Verfügung.

Wir freuen uns darauf, Ihr Event gemeinsam mit Ihnen zu realisieren.

Mit freundlichen Grüßen
Domenico Speranza & Madina Khader
STORIA · Karlstraße 47a · 80333 München',
    'vorlage',
    4,
    ARRAY['{{kundenname}}', '{{eventdatum}}', '{{gaeste}}']
),
(
    'Anfrage Veranstaltung (Alle Pakete)',
    'Ihre Anfrage: Event-Pakete im STORIA',
    'Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage und Ihr Interesse an einer Veranstaltung im STORIA. Gerne stellen wir Ihnen unsere Event-Pakete vor.

Network-Aperitivo
69,00 € pro Person inkl. Getränke-Paket zzgl. gesetzlicher MwSt.
ab 10 Personen / max. 45 Personen
Steh- oder Mixed-Event im Bar- und Open-Kitchen-Bereich.
Inklusive 4 italienische Fingerfood-Variationen sowie 1 Pasta oder Pizza pro Person.
Zusätzlich 5 Drinks pro Person nach Wahl, z. B. Spritz, Wein, Bier oder Cocktail.
Wasser und Kaffee sind ebenfalls inklusive.

Business Dinner – Exclusive
99,00 € pro Person inkl. Getränke-Paket zzgl. gesetzlicher MwSt.
ab 10 Personen / max. 65 Personen / Exklusiver Raum ab 40 Personen
Exklusives Dinner im Private Room mit:
• Welcome-Aperitivo
• Vorspeisen
• Hauptgang
• Hausgemachtem Dessert
• Weinbegleitung, Wasser und Kaffee

Gesamte Location
8.500,00 € inkl. Getränke-Paket zzgl. gesetzlicher MwSt.
ab 70 Personen / max. 100 Personen
Exklusive Nutzung der gesamten STORIA-Location. Max. 100 Personen sitzend oder max. 180 Personen stehend.
• Individuelles Setup
• Firmenbranding möglich
• Maßgeschneidertes Menü

Gerne passen wir die Konzepte individuell an Ihr Event an. Für die Ausarbeitung eines konkreten Angebots freuen wir uns über folgende Informationen:
• gewünschtes Datum und Zeitraum
• geplante Personenanzahl
• Art des Events
• gewünschtes Catering-Format
• technischer Bedarf

Für eine persönliche Abstimmung erreichen Sie uns jederzeit direkt:
Domenico Speranza – 0163 6033912
Madina Khader – 0179 2200921

Wir freuen uns darauf, Ihr Event gemeinsam mit Ihnen zu realisieren.

Mit freundlichen Grüßen
Domenico Speranza & Madina Khader
STORIA · Karlstraße 47a · 80333 München',
    'vorlage',
    5,
    ARRAY['{{kundenname}}', '{{eventdatum}}', '{{gaeste}}']
),
(
    'Reservierungsanfrage (Gruppen)',
    'Ihre Reservierung im STORIA',
    'Sehr geehrte Damen und Herren,

herzlichen Dank für Ihre Reservierung am {{eventdatum}} für {{gaeste}} Personen.

Wir freuen uns sehr darauf, Sie und Ihre Gäste bei uns im STORIA begrüßen zu dürfen.

Um einen reibungslosen Ablauf und den bestmöglichen Service zu gewährleisten, bieten wir Ihnen für Gruppen ab 6 Personen folgende Möglichkeiten an:

À-la-carte-Service
Gerne bereiten wir mehrere nebeneinanderstehende Tafeln für Sie vor, sodass Ihre Gruppe gemeinsam sitzen und individuell aus unserer Speisekarte wählen kann.

Lange Tafel mit Vorspeisen
Bis zu 12 Personen können wir eine lange gemeinsame Tafel realisieren.
Hierbei servieren wir zu Beginn eine gemischte Vorspeisenplatte (auf Wunsch auch vegetarisch oder vegan) zum Preis von 21,40 € zzgl. gesetzlicher MwSt. pro Person.
Im Anschluss können die Hauptgänge à la carte gewählt werden.
Bei einer größeren Gruppe bereiten wir entsprechend mehrere lange Tafeln nebeneinander vor, um allen Gästen ausreichend Platz und Komfort zu bieten.

Menüvorschläge auf Wunsch
• 3-Gänge-Menü: 52,90 € zzgl. gesetzlicher MwSt.
  mit Weinbegleitung: 71,50 € zzgl. gesetzlicher MwSt.
• 4-Gänge-Menü: 66,30 € zzgl. gesetzlicher MwSt.
  mit Weinbegleitung: 91,50 € zzgl. gesetzlicher MwSt.

Weitere Möglichkeiten sowie attraktive Pakete inklusive Getränke finden Sie unter:
https://www.events-storia.de/events

Gerne freuen wir uns über Ihre Rückmeldung, für welche Variante Sie sich entscheiden möchten, damit wir alles optimal vorbereiten können.

Für Rückfragen oder eine persönliche Abstimmung erreichen Sie uns jederzeit direkt:
Domenico Speranza – 0163 6033912
Madina Khader – 0179 2200921

Herzlichen Dank und freundliche Grüße
Domenico Speranza & Madina Khader
STORIA · Karlstraße 47a · 80333 München',
    'vorlage',
    6,
    ARRAY['{{kundenname}}', '{{eventdatum}}', '{{gaeste}}']
);

-- ============================================
-- Textbausteine (mehrfach einfügbar)
-- ============================================

INSERT INTO public.email_templates (name, subject, body, category, sort_order) VALUES
(
    'Allergien & Unverträglichkeiten',
    '',
    'Bitte teilen Sie uns eventuelle Allergien oder Unverträglichkeiten Ihrer Gäste mit, damit wir das Menü entsprechend anpassen können.',
    'baustein',
    1
),
(
    'Vegetarisch / Vegan',
    '',
    'Selbstverständlich bieten wir auch vegetarische und vegane Alternativen an. Bitte geben Sie uns die Anzahl der betroffenen Gäste durch.',
    'baustein',
    2
),
(
    'Kindermenü',
    '',
    'Für Kinder bieten wir gerne ein eigenes Kindermenü an. Bitte teilen Sie uns die Anzahl und das ungefähre Alter der Kinder mit.',
    'baustein',
    3
),
(
    'Bestuhlung & Tischordnung',
    '',
    'Die Bestuhlung und Tischordnung stimmen wir gerne individuell mit Ihnen ab. Ob U-Form, Bankett, runde Tische oder Stehtische – wir richten uns nach Ihren Wünschen.',
    'baustein',
    4
),
(
    'Technik-Hinweis',
    '',
    'Für Präsentationen stehen Ihnen Beamer, Leinwand, Funkmikrofone und ein Soundsystem zur Verfügung. Weitergehende Technikwünsche koordinieren wir gerne mit unseren Partnern.',
    'baustein',
    5
),
(
    'Parkhinweis',
    '',
    'Für Ihre Gäste stehen in unmittelbarer Nähe das Parkhaus an der Karlstraße sowie das Parkhaus am Stachus zur Verfügung. Bei Anreise mit öffentlichen Verkehrsmitteln ist der Karlsplatz (Stachus) die nächstgelegene U-Bahn-Station.',
    'baustein',
    6
),
(
    'Anzahlung / Kaution',
    '',
    'Für die verbindliche Reservierung bitten wir um eine Anzahlung in Höhe von [BETRAG] €. Diese wird selbstverständlich mit der Endabrechnung verrechnet.',
    'baustein',
    7
),
(
    'Stornobedingungen',
    '',
    'Eine kostenfreie Stornierung ist bis 14 Tage vor dem Event möglich. Bei kurzfristigeren Absagen behalten wir uns vor, die entstandenen Kosten anteilig in Rechnung zu stellen.',
    'baustein',
    8
);
