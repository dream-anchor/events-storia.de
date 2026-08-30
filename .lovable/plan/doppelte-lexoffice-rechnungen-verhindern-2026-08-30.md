# Doppelte LexOffice-Rechnungen verhindern

## Ziel
Für einen Auftrag wird eine bereits verknüpfte aktive Rechnung wiederverwendet und sichtbar angezeigt. Eine weitere Rechnung entsteht nur nach einer ausdrücklichen Bestätigung.

## Umsetzung
1. **Zentraler Schutz im Rechnungserzeuger**
   - In `create-event-quotation` vor dem POST an LexOffice im Rechnungsmodus die gespeicherten Rechnungs-IDs des Auftrags prüfen.
   - Existiert bereits eine Rechnung und wurde kein ausdrücklich bestätigtes `force` übergeben, keine neue Rechnung erzeugen, sondern die vorhandene ID/Nummer als `already_exists` zurückgeben.
   - Damit gilt der Schutz auch für Klicks, Sprachbefehle und automatische interne Aufrufer.

2. **Schlussrechnungs-Wrapper konsistent machen**
   - In `create-lexoffice-final-invoice` vorhandene Rechnungen weiterhin idempotent zurückgeben und den bestätigten `force`-Wert nur beim bewussten Zweitfall an den zentralen Erzeuger weiterreichen.
   - Rückgaben für „vorhanden“ und „neu erstellt“ vereinheitlichen, damit die UI beides korrekt behandeln kann.

3. **Rechnungsdialog korrigieren**
   - In `SendInvoiceDialog` die derzeitige automatische Neuerzeugung beim Öffnen vollständig entfernen.
   - Stattdessen die vorhandene Rechnung laden und deren PDF/E-Mail-Vorschau anzeigen.
   - „Weitere Rechnung erstellen“ nur als bewusste Aktion anbieten; davor Sicherheitsabfrage mit vorhandener Rechnungsnummer.
   - Nach Erzeugung oder Wiederverwendung die Beleg- und Auftragsdaten aktualisieren.

4. **Vorhandene Rechnung sichtbar halten**
   - Die bestehende Belege-Anzeige nutzt Nummer, Betrag, Datum, Status sowie PDF-Vorschau/Download und bleibt die zentrale sichtbare Dokumentenliste im Auftrag.
   - Im Rechnungsdialog wird zusätzlich klar angezeigt, dass die vorhandene Rechnung verwendet wird.

## Geänderte Dateien
- `supabase/functions/create-event-quotation/index.ts`
- `supabase/functions/create-lexoffice-final-invoice/index.ts`
- `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx`

## Prüfung
- Auftrag mit vorhandener Rechnung: Dialog öffnen und mehrfach senden, ohne neue LexOffice-Rechnung.
- Direkter Funktionsaufruf ohne `force`: bestehende ID/Nummer wird zurückgegeben.
- Bewusster Zweitfall: Warnung bestätigen, genau eine weitere Rechnung wird erzeugt und anschließend angezeigt.
- Auftrag ohne Rechnung: normale Erzeugung, danach PDF und Belegmetadaten sichtbar.
