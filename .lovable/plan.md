## Problem

Die neue **Belege-Card** (LexofficeDocumentsCard) ist aktuell nur im Tab **„Details"** eingebunden (`SmartInquiryEditor.tsx:1305`, innerhalb `<TabsContent value="details">`).

Du arbeitest aber im Tab **„Angebot"** — dort wird die Karte nicht gerendert, deshalb siehst du die Änderungen nicht.

## Lösung

Die `LexofficeDocumentsCard` zusätzlich im **Angebot**-Tab direkt unter den bestehenden Zahlungs-/Angebotsblock einfügen, damit Belege immer im Hauptarbeitsbereich sichtbar sind.

### Konkret
- In `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`, im Block `<TabsContent value="angebot">` (Zeilen 1165–1198), unterhalb der bestehenden Zahlungssektion folgendes ergänzen:
  ```tsx
  <LexofficeDocumentsCard orderId={id!} />
  ```
- Im **Details**-Tab bleibt die Karte ebenfalls erhalten (kein Duplikat-Problem, da identische Query gecached wird via React Query Key `['order-lex-docs', orderId]`).

### Optional (falls gewünscht)
- Stattdessen aus „Details" entfernen, wenn du sie ausschließlich im Angebot-Tab haben willst — sag kurz Bescheid.

## Hinweis zum Screenshot
Im Screenshot ist zusätzlich der „Rechnung senden"-Dialog offen, der den Tab überlagert. Nach Schließen wäre die Karte (nach dem Patch) direkt unter dem Zahlungsblock sichtbar.

Keine Backend-/Edge-Function-Änderungen nötig.