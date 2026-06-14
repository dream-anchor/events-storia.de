# Aktivitäten-Timeline konsolidieren

Eine einzige Ansicht in **Details → Aktivitäten**. Die separate Karte „Versendete Angebote" (Kalkulation-Tab) verschwindet vollständig. Die Timeline bekommt Filter-Chips.

## 1. `OfferHistoryList` entfernen

`src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`
- Zeile 1247–1248: Block „Versionsverlauf der versendeten Angebote" inkl. `<OfferHistoryList>` löschen.
- Import in Zeile 18 entfernen.
- Die Datei `OfferHistoryList.tsx` bleibt vorerst bestehen (kein toter Code-Cleanup im selben PR), wird aber nirgends mehr referenziert. Optional: Datei löschen, wenn keine andere Stelle sie nutzt (Grep ergab nur SmartInquiryEditor).

## 2. `OfferVersionEntry` erweitern (Timeline.tsx)

Damit die Timeline-Karte das alte `OfferHistoryList`-Feature ersetzt:
- **Empfänger-Zeilen** ergänzen (An / CC / BCC), gleicher Stil wie heute in `OfferHistoryList` (Mail-Icon + Mono-Text), aber kompakt in der bestehenden amber Karte.
- **Aktionen** unten rechts:
  - `Ansehen` → `navigate(\`/admin/inquiries/${inquiryId}/archive/${entry.version}\`)`
  - `Als neues kopieren` → öffnet denselben `AlertDialog` wie bisher, ruft `useCloneOfferVersion(inquiryId).mutateAsync(version)`.
- `inquiryId` als Prop bis zu `OfferVersionEntry` durchreichen (Timeline kennt `entityId`).
- „Aktuelle Version"-Badge (`AKTUELL`) zusätzlich zum vorhandenen `V{n}`.
- Die bestehende „Menü-Details anzeigen"-Collapsible bleibt.

Das deckt **Expandable Card** ab — Klick erweitert Empfänger + Menü, Actions inline.

## 3. Filter-Leiste in `Timeline.tsx`

Im `CardHeader` neben den Zähl-Badges eine `Tabs`/`ToggleGroup`-Leiste mit 4 Optionen:

| Filter | Inhalt |
|---|---|
| **Alle** *(default)* | Alles (heutiges Verhalten) |
| **Angebote** | `type === 'offer_version'` + Activity-Actions `offer_email_sent`, `offer_version_created` |
| **E-Mails** | `type === 'email'` + Activity-Actions `offer_email_sent`, `email_sent`, `email_received` |
| **Bearbeitungen** | Alle übrigen Activity-Actions (Status-, Preis-, Gäste-, Daten-Änderungen, Notes, Tasks, Assignments) |

Implementierung:
- Lokaler State `filter: 'all' | 'offers' | 'emails' | 'edits'`, kein Persist (User wünscht Default „Alle").
- `useMemo`-Filter über `combinedItems` nach o.g. Logik (Mapping-Tabelle der Action-Strings als Konstante oben in der Datei).
- Empty-State pro Filter: „Keine Einträge in dieser Kategorie".
- Eintrag-Zähler in der Badge zeigt gefilterte Anzahl.

UI: monochrome ToggleGroup (border, rounded-lg, neutral). Keine farbigen Akzente außer aktivem State.

## 4. Verifikation
- Inquiry öffnen → Kalkulation-Tab zeigt keine „Versendete Angebote"-Karte mehr.
- Details-Tab → Aktivitäten zeigt Angebots-Versionen inkl. An/BCC + Ansehen/Kopieren.
- Filter „Angebote" zeigt nur Versions-Karten + Send-Activity.
- Filter „E-Mails" zeigt Delivery-Logs.
- Filter „Bearbeitungen" zeigt nur Änderungs-Logs.

## Technische Details
- Action-Strings: aus `activity_logs.action` ableiten — bekannte: `offer_email_sent`, `offer_version_created`, `status_changed`, `assigned_to_changed`, `priority_changed`, `note_added`, `task_created`, plus generische Feldänderungen via `field_changed`. Liste in `EMAIL_ACTIONS` / `OFFER_ACTIONS` / Rest = Edits.
- `useCloneOfferVersion` ist bereits vorhanden und wird nur in die Timeline-Entry-Komponente verlagert.
- Keine DB-Änderungen.
