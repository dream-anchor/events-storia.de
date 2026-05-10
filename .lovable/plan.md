## Problem

Der bisherige Tab "Mails" (IMAP-Posteingang mit Filter-Mapping) wurde beim Umbau auf das mailprogramm-artige `MailClient` komplett ersetzt. Die Funktion zum **Zuordnen ungelinkter IMAP-Mails per Filter (Absender / Betreff / Thread)** sowie die Verwaltung dieser Zuordnungen (Filter aktiv/inaktiv, ausblenden, ausschließen) ist dadurch nicht mehr erreichbar.

## Ziel

Im Tab "Nachrichten" beide Sichten verfügbar machen:
1. **Posteingang** (`MailClient`) – mailprogramm-artige Lese-/Antwort-Ansicht (Default)
2. **Mails zuordnen** (`EventMailsTab`) – IMAP-Mapping & Verwaltung

## Umsetzung

In `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` innerhalb von `<TabsContent value="mails">` einen sekundären Tab-Switch einbauen:

```text
[Tab "Nachrichten" aktiv]
┌────────────────────────────────────────────┐
│ ( Posteingang ) ( Zuordnen )      [Sub]    │
├────────────────────────────────────────────┤
│  <MailClient ... />   ODER   <EventMailsTab/>│
└────────────────────────────────────────────┘
```

Konkret:
- Lokaler State `mailsSubView: "inbox" | "mapping"` (Default `"inbox"`).
- Kleine Segmented-Control / `Tabs` (sekundär, dezent gestylt) oberhalb des Inhalts.
- `MailClient` bleibt unverändert mit allen aktuellen Props.
- `EventMailsTab` wird mit `eventId={inquiryId}` (bzw. den bisher genutzten Props) gerendert – also exakt so wie vor dem Umbau.

Keine weiteren Dateien werden geändert, keine Business-Logik angepasst. `EventMailsTab.tsx` und `useEventEmails.ts` existieren bereits unverändert im Projekt.

## Nicht Teil dieses Plans

- Keine Änderung am `MailClient` selbst
- Keine Änderung an Filtern/RPCs/DB
- Keine Umbenennung des Haupttabs ("Nachrichten" bleibt)