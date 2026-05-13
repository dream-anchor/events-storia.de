## Ziel

Reisegruppen-Anfragen öffnen sich künftig im **gleichen** SmartInquiryEditor wie In-Haus- und Lieferungs-Anfragen — mit Angebots-/Menü-Builder, Mails, Tasks, Timeline, Zahlungen, LexOffice usw. Keine separate Detailmaske mehr.

## Hintergrund

- In-Haus / Lieferung / Catering liegen in `v2_events` (+ `event_inquiries` View) und nutzen `SmartInquiryEditor` unter `/admin/inquiries/:id/edit`.
- Reisegruppen liegen in einer **eigenen** Tabelle `group_inquiries` mit komplett anderem Schema (kein `menu_selection`, kein `quote_items`, kein `offer_phase`, kein Contact-Bezug etc.).
- Deshalb existiert aktuell die separate Maske (`GroupInquiryEdit` / alter `/admin/reisegruppen`-Sheet).

Damit Reisegruppen denselben Editor bekommen, müssen sie als „normales" Event geführt werden.

## Lösungsweg: Reisegruppen in `v2_events` integrieren

### 1. Datenbank-Migration

- Neuen Wert `group` zur Enum `v2_event_service` hinzufügen.
- Neuen Wert für `v2_event_source` ergänzen, falls noch nicht vorhanden (z. B. `reisegruppen`).
- `v2_events` um spezifische Reisegruppen-Felder erweitern (nullable):
  - `language` (text, default `'de'`)
  - `arrival_time` (text)
  - `preferred_menu` (text)
  - `travel_plan_url`, `travel_plan_filename` (text)
  - `preferred_date_flexible` (bool, default false)
  - UTM-Felder bereits vorhanden → prüfen, sonst ergänzen.
- One-off Backfill: bestehende `group_inquiries` → `v2_events` migrieren.
  - Pro Zeile: Contact in `v2_contacts` anlegen/finden (per E-Mail), dann `v2_events`-Zeile mit `service_type='group'`, `source='reisegruppen'`, Status-Mapping (`new→inquiry`, `in_progress→offer_draft`, `offer_sent→offer_sent`, `confirmed→paid`, `rejected→archived`, `archived→archived`).
  - `group_size → guest_count`, `message → customer_notes`, `internal_notes`, `preferred_date`, neue Felder 1:1.
  - `id` der group_inquiry wird in `v2_events` als gleicher Primärschlüssel übernommen → keine kaputten Links.
- Neue Webhook-/Insert-Pfade: Reisegruppen-Formular schreibt künftig direkt nach `v2_events` (statt `group_inquiries`).
  - Edge Function `submit-group-inquiry` (oder entsprechende) entsprechend anpassen.
- `group_inquiries` bleibt zunächst als Read-Only-Schattenkopie bestehen (wird in einer Folge-PR nach erfolgreicher Migration entfernt).

### 2. Routing & Listen

- `UnifiedKanbanView` und `UnifiedInquiriesList`: bei `serviceType === "group"` ebenfalls auf `/admin/inquiries/${id}/edit` navigieren (statt `/admin/reisegruppen/...`).
- Route `/admin/reisegruppen/:id/edit` und `GroupInquiryEdit.tsx` werden entfernt.
- Alte `/admin/reisegruppen`-Übersicht: optional behalten als Filter (Quelle = `reisegruppen`) oder ebenfalls entfernen.

### 3. SmartInquiryEditor anpassen

Der Editor bleibt das gleiche Bauwerk; er erhält nur kleine Group-spezifische Anpassungen:
- Neuer Header-Badge „Reisegruppe" wenn `service_type === 'group'`.
- Neue Sektion „Reisegruppe-Details" (in Tab „Übersicht"/„Event"):
  - Sprache, Anreisezeit, Wunschmenü (Text), Reiseplan-Link (signed URL für `travel_plan_url`), Flex-Datum-Flag.
- LocationBlock / Lieferadresse für Group ausblenden (nicht relevant).
- Menü-/Angebots-Builder funktionieren unverändert (gleiches `menu_selection`/`quote_items`-Schema).

### 4. Aufräumen

- `GroupInquiryEdit.tsx`, `GroupInquiriesList.tsx`, `GroupInquiryDetail`-Sheet, ehemalige Reisegruppen-Routen entfernen, sobald die Migration grün ist.
- `useList`/Resources auf `group_inquiries` aus dem Refine-Setup entfernen.

## Offene Punkte vor Umsetzung

1. **Bestehende Daten migrieren?** Ja → Backfill in derselben Migration, oder lieber ein separater Schritt nach Code-Deploy?
2. **Alte Tabelle `group_inquiries`** sofort löschen oder vorerst als `_legacy_group_inquiries` archivieren?
3. **Reisegruppen-Übersichtsseite** `/admin/reisegruppen` ebenfalls abschalten (alles läuft dann über die Anfragen-Liste mit Filter „Reisegruppe")?

Sobald diese drei Punkte beantwortet sind, setze ich Migration + Editor-Anpassung + Routing in einem Rutsch um.
