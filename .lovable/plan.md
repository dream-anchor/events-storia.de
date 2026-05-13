## Druckansicht „Nächste Aufträge" auf /admin/inquiries

Neuer Druck-Button in der Anfragen-Übersicht öffnet eine kompakte, druckoptimierte Liste der kommenden Aufträge — gruppiert nach Woche oder Monat und gefiltert nach In Haus / Außer Haus.

### Bedienung (Toolbar oben rechts)

- **Drucken**-Button → öffnet Dialog
- Im Dialog drei Toggles:
  - **Zeitraum:** Woche · Monat (Default: Woche, ab heute, 4 Wochen / 3 Monate Voraus)
  - **Ort:** In Haus · Außer Haus · Beides (Default: Beides)
  - **Status:** standardmäßig nur bestätigte/bezahlte Buchungen (versendete Angebote optional zuschaltbar)
- Knopf **„Drucken"** → `window.print()` mit dedizierter `@media print` CSS-Klasse, sonst Vorschau im Dialog

### Layout der Druckansicht

Kopfzeile: Logo-Mark · „Nächste Aufträge" · Zeitraum (z. B. „KW 20–23 / 2026") · Druckdatum · Ersteller-Initialen.

Gliederung:

```
WOCHE 20 (11.–17. Mai 2026)
─────────────────────────────────────
  IN HAUS  (3)
    Mi 13.05  18:30  Lagourrès        24 P  Tartuferia      AM
    Sa 16.05  19:00  Müller GmbH      40 P  Hauptraum       MK
  AUSSER HAUS  (2)
    Do 14.05  12:00  BMW AG           80 P  Petuelring 130  AM
    ...

WOCHE 21 (18.–24. Mai 2026)
...
```

Pro Zeile kompakt:
- Datum + Wochentag, Uhrzeit
- Kunde (Firma oder Name)
- Personenzahl
- Location/Adresse (bei Außer Haus die Straße, bei In Haus den Raum)
- Verantwortliche/r (2-Letter-Initialen)
- Kleines Icon/Badge: Status (bestätigt · bezahlt · Angebot offen)
- Optional Notiz-Zeile (1 Zeile, abgeschnitten) für interne Hinweise

Pro Gruppe Summen-Zeile: „∑ 3 Aufträge · 64 Personen".

### Daten-Logik

- Quelle: `event_inquiries` (Lebend-Tabelle) gefiltert nach `event_date >= today` und `event_date <= range_end`.
- **In Haus** = `location_type = 'storia'` (oder leer + Venue Karlstr.)
- **Außer Haus** = `location_type != 'storia'`
- Sortierung: nach `event_date`, dann `time_slot`.
- Bestätigt = `offer_phase IN ('booked','paid')` bzw. `selected_option_id IS NOT NULL`.

### Technische Umsetzung

- Neue Komponente `src/components/admin/refine/print/UpcomingOrdersSheet.tsx` (rein Frontend, eigene Print-CSS, A4 Hochformat, monochrom, Inter, rounded-2xl im Bildschirm, nüchtern in Print).
- Dialog `UpcomingOrdersPrintDialog.tsx` mit den drei Togglen, lädt Daten via Supabase-Query (eine `select` über `event_inquiries`).
- Print-Button in der Toolbar von `UnifiedInquiriesList.tsx` einfügen (links neben den bestehenden Aktionen, gemäß „inline bottom-left / oben rechts in Listen-Toolbar").
- Wiederverwendung der vorhandenen `print/styles.ts` für `@media print`-Regeln.
- Keine Backend-/DB-Änderungen.

### Out of scope

- Kein PDF-Export-Endpoint (nur Browser-Druck → spart eine Edge Function; PDF entsteht via „Als PDF speichern" im Druckdialog).
- Keine Filter nach Mitarbeiter / Kategorie in v1.