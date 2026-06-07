# Fix: Button „Rechnung schicken (Vorschau)" bei „Restzahlung vor Ort" sperren

## Problem
Die Logik im `SendInvoiceDialog` blockiert zwar das Erzeugen/Senden einer Schluss­rechnung, wenn `balance_method` = `on_site` (oder `onsite`, `cash`, `card_onsite`) ist. Der **Trigger-Button** im Inquiry-Header (`SmartInquiryEditor.tsx`, Zeilen 1050–1072) prüft das aber gar nicht — er ist immer klickbar, sobald `inquiry.email` existiert. Der Nutzer kann den Dialog also öffnen und sieht erst dort den Hinweis.

## Änderung (rein UI, eine Datei)

`src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` — Block ab Zeile 1050:

1. `balance_method` aus `inquiry` lesen und prüfen:
   ```ts
   const balanceOnSite = ['on_site','onsite','cash','card_onsite']
     .includes(String((inquiry as any)?.balance_method || ''));
   ```
2. Button-Verhalten anpassen:
   - Wenn `balanceOnSite` **und** noch keine Schlussrechnung existiert (`!hasInvoice`) → Button **nicht rendern** (oder `disabled` mit Tooltip — siehe unten).
   - Wenn `balanceOnSite` **und** bereits eine Schlussrechnung existiert (Altbestand, sollte praktisch nicht vorkommen) → Button rendern, damit eine Storno/Re-Sende-Aktion möglich bleibt.
3. Tooltip-Text bei `balanceOnSite`:
   „Restzahlung erfolgt vor Ort über das Kassensystem — keine LexOffice-Schlussrechnung erlaubt."

## Empfehlung
Variante **„disabled mit Tooltip"** statt komplett ausblenden — der Nutzer sieht so explizit, warum der Button gesperrt ist (statt zu denken, das Feature fehle). Konsistent mit dem bereits sichtbaren Hinweisbanner im Dialog.

## Nicht betroffen
- `SendInvoiceDialog.tsx`, beide Edge Functions, DB — bereits korrekt aus dem letzten Schritt.
- Andere Trigger (z. B. automatische Cron-Erzeugung) — werden serverseitig durch den `on_site`-Guard in `create-lexoffice-final-invoice` ohnehin abgewiesen.
