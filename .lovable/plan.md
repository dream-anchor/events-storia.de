## Ziel
Mengenfeld auf Stripe-Checkout auffälliger machen – durch klareren Produktnamen/-beschreibung (das einzige was wir an Stripe steuern können).

## Vorgehen
1. Stripe-Produkt `prod_…` (Restzahlung Rigshospitalet Veranstaltung 28.08.2026) aktualisieren:
   - **Name:** `⚠️ MENGE = finale Gästeanzahl anpassen!`
   - **Description:** `Restzahlung Rigshospitalet · 28.08.2026 · 63 € pro Gast · Bitte links bei "Menge" die finale Gästezahl eintragen (min. 70).`
2. Damit erscheint links neben dem Mengen-Dropdown ein deutlicher Hinweis-Text – das ist die einzige Stelle, die Stripe an der Hosted-Checkout-Seite individualisieren lässt.
3. Bestehender Payment Link bleibt gültig (gleiche Price-ID, adjustable_quantity 70–120).

## Hinweis
Das blau umrandete „Menge 70"-Dropdown selbst kann nicht vergrößert/umgestylt werden – Stripe-Checkout ist nicht anpassbar. Wenn das nicht reicht, wäre Option 2 (eigene Zwischenseite auf events-storia.de mit großem Gäste-Zahl-Picker, dann fixer Stripe-Link) der einzige Weg zu wirklich großem Auswahlfeld.