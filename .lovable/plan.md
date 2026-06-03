## Plan: Rechnung exakt wie Maestro-Angebot erzeugen

1. **Einzelpositionen korrigieren**
   - In `create-event-quotation` den Modus `full_menu` genauso behandeln wie `menu`.
   - Bei `pricingMode: per_event` jede Menüzeile mit echter Menge aus Maestro ausgeben:
     - Menge = z. B. `3`
     - Einzelpreis = z. B. `52,00 €`
     - Gesamt = `156,00 €`
   - Keine künstlichen Zeilen mehr wie „1 Portion 156,00 €“, wenn Maestro eigentlich `3 × 52 €` zeigt.

2. **Totals unverändert aus Maestro übernehmen**
   - Die Rechnung nutzt weiterhin die gespeicherten Maestro-Bruttowerte.
   - Keine Neuberechnung/Umrechnung außer der notwendigen Zeilenabbildung für LexOffice.

3. **Zahlungskonditionen aus Maestro auf Rechnung übernehmen**
   - Für die gezeigten Einstellungen:
     - Anzahlung: `20 %`, Methode `Stripe – sofort`, Frist `5 Tage`
     - Restzahlung: `Stripe – vorab`, Frist `10 Tage vor Event`
     - Angebotsgültigkeit: `14 Tage`
   - Die Rechnung/Schlussrechnung bekommt passende LexOffice-Zahlungsbedingungen und einen klaren Bemerkungstext mit diesen Konditionen.
   - Keine generische Formulierung mehr wie „14 Tage nach Veranstaltung“, wenn Maestro andere Konditionen vorgibt.

4. **Stornierte/falsche Rechnung neu erzeugbar machen**
   - Der Fix greift für neu erzeugte Rechnungen.
   - Bereits erstellte LexOffice-Rechnungen können inhaltlich nicht nachträglich geändert werden; die falsche Schlussrechnung muss storniert und danach neu erzeugt werden.

## Technische Details

- Datei: `supabase/functions/create-event-quotation/index.ts`
- Wahrscheinliche Ursache: `offer_mode = full_menu` fällt aktuell nicht in den Menü-Zweig und wird dadurch als Paket/Gesamtposition bzw. mit falscher Zeilenlogik behandelt.
- Zusätzlich wird im `per_event`-Zweig aktuell der Zeilen-Gesamtbetrag als `grossAmount` mit `quantity: 1` übergeben. Das wird auf `quantity` + `unitPrice.grossAmount` geändert.
- Danach wird die Edge Function neu deployed.