## Ziel
Wenn eine Rechnung in Maestro storniert wurde, darf der Rechnungsversand/Dialog nicht mehr auf die alte stornierte LexOffice-Rechnung oder ein Angebot-PDF zurückfallen.

## Plan
1. **Dokument-Auswahl korrigieren**
   - Die zentrale Dokument-Auflösung so anpassen, dass für Rechnungs-PDFs nur aktive Rechnungen verwendet werden.
   - Wenn keine aktive Rechnung existiert, wird kein Angebot als Ersatz für den Rechnungsversand/PDF geladen.

2. **Rechnungsdialog absichern**
   - `SendInvoiceDialog` lädt die PDF-Vorschau künftig direkt über die aktuell aktive Rechnung-ID statt über den allgemeinen “latest document”-Fallback.
   - Wenn nach Storno keine Rechnung mehr verknüpft ist, zeigt der Dialog wieder “Noch keine Rechnung vorhanden” und bietet Neuerzeugung an.

3. **Backend-Fallback korrigieren**
   - `get-lexoffice-document` bekommt einen Rechnungsmodus, der bei `voucherType: invoice` nicht mehr auf `lexoffice_quotation_id` zurückfällt.
   - Dadurch kann im Rechnung-PDF-Tab kein Angebot mehr erscheinen.

4. **UI nach Storno aktualisieren**
   - Nach erfolgreichem Storno die relevanten Inquiry/Event-Daten neu laden bzw. den Dialog-State aktualisieren, damit der alte Button/alte Vorschau nicht aus gecachten Daten weiter benutzt wird.

## Ergebnis
Nach dem Stornieren verschwindet die alte Rechnung aus den aktiven Rechnungsaktionen; erst nach Neuerstellung wird die neue Rechnung geladen und gesendet.