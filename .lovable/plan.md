# Schlussrechnung: „Rechnung schicken · Vorschau" erzeugt immer frisch

## Regel

**Button „Rechnung schicken · Vorschau"** → erzeugt **immer eine neue** Schlussrechnung in LexOffice mit den aktuellen Maestro-Werten. Die vorherige bleibt unverändert in der Belege-Liste stehen und kann dort bei Bedarf über das **Ban/Storno-Symbol** storniert werden.

**Klick auf einen Belegeintrag** (z.B. „Schlussrechnung RE0029") → zeigt **nur** das existierende PDF an. Kein Regenerate (egal ob versendet oder nicht). Bestehende Buttons (Download, Großvorschau, Stornieren) bleiben wie sie sind.

## Verhalten im Detail

| Aktion | Wenn noch keine Rechnung | Wenn Rechnung existiert (egal ob versendet) |
|---|---|---|
| **„Rechnung schicken · Vorschau"** klicken | Erstmalig erzeugen, PDF laden | **Neue Rechnung erzeugen** (`force: true`), PDF laden. Alte bleibt in Liste |
| Belegeintrag klicken / Maximize | – | Vorhandenes PDF anzeigen, kein Regenerate |
| Storno-Symbol (Ban) auf altem Beleg | – | Storniert in LexOffice (existiert bereits) |

So entsteht bei jedem Aufruf eine frische Rechnung mit aktuellen Werten (Anzahlungs-%, Restzahlungs-Frist, Methode, Preise), und der Admin entscheidet selbst, welche alte Version er stornieren möchte.

## Umsetzung

**`SendInvoiceDialog.tsx`**
- Beim Dialog-Open: wenn schon eine `final_lexoffice_invoice_id` existiert → vor PDF-Load automatisch `create-lexoffice-final-invoice` mit `force: true` aufrufen → liefert neue `final_lexoffice_invoice_id` → diese als `activeInvoiceId` setzen → PDF von neuer ID laden
- Wenn noch keine existiert: bestehender Flow („Endrechnung erzeugen"-Tab) bleibt
- Spinner-Text während Regenerate: „Rechnung wird mit aktuellen Werten neu erzeugt…"
- Bei Fehler: Toast + Fallback auf alte ID + Hinweis
- Belege-Liste (`useOrderLexofficeDocuments`) wird nach Regenerate invalidiert, damit die alte Rechnung mit Storno-Symbol in `LexofficeDocumentsCard` sichtbar bleibt

**`LexofficeDocumentPreviewDialog.tsx` / `LexofficeDocumentsCard.tsx`**
- **Keine Änderung.** Klick auf Listeneintrag → nur Anzeige. Storno-Symbol existiert bereits für jede Invoice.

**`create-lexoffice-final-invoice`**
- Keine Änderung — `force: true` storniert nicht automatisch die alte, sondern überschreibt nur die `final_lexoffice_invoice_id` in `v2_events`. Die alte LexOffice-Rechnung bleibt erhalten und taucht in der Belege-Liste auf (über die LexOffice-Vouchers-API), wo sie über das Ban-Symbol manuell storniert werden kann. **Genau das vom User gewünschte Verhalten.**

## Edge Cases

- **Doppelklick** auf „Rechnung schicken": Button disabled während Regenerate läuft
- **Regenerate scheitert**: alte ID bleibt aktiv, Fehlermeldung anzeigen, Versand bleibt möglich
- **Listen-Refresh**: nach Regenerate `queryClient.invalidateQueries(['lexoffice-docs', orderId])` damit die neue Rechnung sofort in der Belege-Card erscheint
