## Ziel
Die Timeline (Aktivitäten) aus dem Details-Tab auslagern und als eigenen Top-Level-Tab "Aktivitäten" hinter "Details" platzieren.

## Aktueller Stand
- Tabs: `Angebot | Nachrichten | Aufgaben | Details`
- Innerhalb von **Details** wird die `<Timeline />` als letztes Element gerendert (Zeile 1356).

## Änderungen

### 1. SmartInquiryEditor.tsx
- Neuer Tab-Trigger **"Aktivitäten"** in `<TabsList>` einfügen, positioniert nach "Details".
- Neues `<TabsContent value="aktivitaeten">` anlegen, das ausschließlich `<Timeline entityType="event_inquiry" entityId={id!} />` enthält.
- `<Timeline ... />` aus dem `<TabsContent value="details">` entfernen.
- Keine weiteren Inhalte im neuen Tab.

### Ergebnis
- Tabs: `Angebot | Nachrichten | Aufgaben | Details | Aktivitäten`
- Details behält: EventDNA, ClientPreview, PaymentCard, LexofficeDocumentsCard
- Aktivitäten enthält: Timeline mit vorhandenen Filtern (Alle / Angebote / E-Mails / Bearbeitungen)