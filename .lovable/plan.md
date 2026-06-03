## Plan

1. **Ursache beheben**
   - Die E-Mail-Vorschau startet aktuell erst, wenn `invoiceExists` bereits `true` ist.
   - Nach dem Live-Check der Rechnung wird aber nur `invoiceExists` aktualisiert; dadurch kann die Vorschau in einem leeren Zustand bleiben.
   - Ich kopple die E-Mail-Vorschau direkt an die aktive Rechnungs-ID (`activeInvoiceId`) statt an den alten/statischen Rechnungsstatus.

2. **Ladezustand sichtbar machen**
   - Während die Vorschau erzeugt wird, bleibt der Spinner sichtbar.
   - Wenn keine Rechnung verknüpft ist, zeigt der E-Mail-Tab statt einer leeren weißen Fläche einen klaren Hinweis.
   - Wenn die Vorschau fehlschlägt, wird die Fehlermeldung sichtbar statt still leer zu bleiben.

3. **Senden erst nach echter Vorschau erlauben**
   - Der Senden-Button bleibt deaktiviert, bis eine aktive Rechnung und eine generierte Mail-Vorschau vorhanden sind.
   - Nach dem Erzeugen einer neuen Rechnung wird die Vorschau automatisch neu geladen.

## Betroffene Datei

- `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx`

## Ergebnis

Der Rechnungsdialog zeigt im Tab **E-Mail** wieder die generierte Mail-Vorschau an oder erklärt konkret, warum sie noch nicht verfügbar ist.