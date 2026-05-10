## Befunde

Ich habe die vier Punkte im Code und in der DB überprüft:

### 1. Kanban-Ampel weg
`src/lib/inquiryActionState.ts` existiert noch (rote/gelbe/grüne Zustände + Border/Dot/Chip), wird aber von `UnifiedKanbanView.tsx` und `UnifiedInquiriesList.tsx` **nicht** mehr verwendet. Die alten Views (`KanbanView.tsx`, `EventsList.tsx`) nutzen sie noch — die wurden beim Umbau auf "Unified" einfach ausgelassen.

### 2. Archivierte Anfragen wieder sichtbar
`useUnifiedInquiries` lädt Events ohne Archiv-Filter. `mapEventToColumn(status)` ignoriert `archived_at`/`archived`, also landet ein archiviertes Event mit Status `confirmed` **gleichzeitig in „Gebucht" und im Archiv-Akkordeon**.

### 3. Anfragen in „Gebucht" fehlen — Hauptursache
Die Liste fragt die Refine-Resource `events` ab. Diese ist im Data-Provider auf die **Legacy-Tabelle `event_inquiries`** gemappt:

| Tabelle | Zeilen |
|---|---|
| `event_inquiries` (Legacy, von der Liste gelesen) | 66 |
| `v2_events` (aktuelle Daten, Posteingang/Drafts/Inquiry-Editor lesen daraus) | 128 |

Alle Statusverschiebungen der letzten Wochen passieren in `v2_events` (`status` ∈ `inquiry, offer_draft, offer_sent, offer_chosen, paid, completed, cancelled`). Die Anfragen-Übersicht sieht davon nichts → „Gebucht" wirkt leer/falsch.

### 4. Catering vs. Event sichtbar machen
`v2_events` hat eine Spalte `service_type` (`restaurant` | `catering`). Aktuell wird in der Liste nur unterschieden, ob ein Datensatz aus `event_inquiries` (→ "Event") oder `catering_orders` (→ "Catering") kommt — der „Außer-Haus / In-Haus"-Charakter eines v2-Events fehlt.

### Library-Frage
- **Tabelle:** Wir nutzen bereits `@tanstack/react-table` (über `DataTable`). Sortier-, Filter-, Pagination-fähig — kein Bibliothekswechsel nötig.
- **Kanban:** Aktuell handgerollte HTML5-Drag-API (~50 Zeilen). Empfohlene Option für mehr Komfort (Touch, Auto-Scroll, Keyboard-A11y): `@dnd-kit/core` + `@dnd-kit/sortable`. Wir bauen das **nur, wenn du es willst** — die HTML5-Variante reicht für reines Spalten-Drag. Ich schlage vor: erst die vier Bugs fixen, Library-Wechsel separat.

---

## Plan

### A. Datenquelle umstellen (kritisch)

`src/hooks/useUnifiedInquiries.ts` neu schreiben:

- `v2_events` direkt per Supabase-Client lesen (mit `v2_customers` Join für `contact_name, email, phone, company_name`).
- `catering_orders` weiter über Refine.
- Felder mappen: `date` ← `v2_events.date`, `time` ← `time_from`, `guestCount` ← `guest_count`, `totalAmount` ← `amount_total`, `archivedAt` ← `archived_at`, `serviceType` ← `service_type`.

`src/types/inquiryRecord.ts` anpassen:

- Neue Status-→-Column-Map für v2:
  - `inquiry` → `lead`
  - `offer_draft` → `proposal`
  - `offer_sent` → `pending`
  - `offer_chosen` → `pending`
  - `paid` → `won`
  - `completed` → `won`
  - `cancelled` → `closed`
- Wenn `archived = true` → Column **immer** auf `closed` mappen (kein Doppel-Anzeigen).
- Neues Feld `serviceType: "restaurant" | "catering" | "catering_order"`. `catering_order` = Datensätze aus `catering_orders`.

### B. Drag-&-Drop-Update auf v2

`UnifiedKanbanView.handleDrop`:

- Schreibt jetzt in `v2_events.status` mit Map: `lead→inquiry, proposal→offer_draft, pending→offer_sent, won→paid, lost→cancelled+archived=true, closed→cancelled`.
- Für `won → completed` würde ein gebuchtes Event als „erledigt" markiert; wir nutzen `paid` als Default für „Gebucht". Das halten wir bewusst minimal.

### C. Ampel-System zurückbringen

`src/lib/inquiryActionState.ts` erweitern auf v2-Felder (`status`, `offer_phase`, `archived`):

- `respond` (rot): `status='inquiry'` und älter als 24 h **ohne Erstreaktion**, oder `offer_phase='customer_responded'`.
- `won` (grün): `status ∈ {paid, completed}`.
- `done` (grau): `archived=true` oder `status='cancelled'`.
- `in_progress` (amber): alles andere.

In **Kanban-Karte** (`UnifiedKanbanCard`):
- Links farbiger 3px-Border (`borderClass`).
- 8-px-Dot vor dem Titel.

In **Tabelle** (`UnifiedInquiriesList.columns`):
- Neue Spalte „Status" ganz vorne mit `chipClass`-Pill (Label + Farbe).
- Zeile bekommt zusätzlich einen 3-px-Linksrand-Akzent (über `cellClassName` oder `rowClassName`).

Catering-Records (kein `offer_phase`) bekommen eine vereinfachte Variante: `pending → respond/in_progress`, `confirmed → in_progress`, `completed → won`, `cancelled → done`.

### D. Catering/Event auf den ersten Blick sichtbar

`KindBadge` ersetzen durch eine semantischere Pill `ServiceBadge`, drei Varianten:

| serviceType | Label | Icon | Tooltip |
|---|---|---|---|
| `restaurant` | „Im Haus" | `UtensilsCrossed` | Event im Restaurant |
| `catering` | „Außer Haus" | `Truck` | Event-Catering an externen Ort |
| `catering_order` | „Catering-Shop" | `ShoppingBag` | Bestellung über den Catering-Online-Shop |

Anzeige:
- **Tabelle:** Eigene Spalte „Art" ganz links nach Status, mit Pill (oder als Icon + Label zusammen).
- **Kanban-Karte:** Pill oben links, deutlich (Hintergrund + Icon), statt unauffällig grau wie heute.
- **Mobile-Card:** Bereits in `mobileCardRender` — nur Komponente austauschen.

Filter-Toggle „Alle / Events / Catering" wird zu **„Alle / Im Haus / Außer Haus / Catering-Shop"** (oder zwei Pills: „Im Haus" und „Außer Haus", letzteres umfasst beide Catering-Typen) — du entscheidest, ich schlage 3 separate Pills vor, weil sie unterschiedlich gehandhabt werden.

### E. Archiv-Logik vereinheitlichen

In `UnifiedInquiriesList.statusMatches`:
- `inbox`: `column ∈ {lead, proposal, pending}` **und** `!archivedAt`.
- `won`: `column = won` **und** `!archivedAt`.
- `archive`: `column ∈ {lost, closed}` **oder** `archivedAt`.

Da Punkt A bereits archivierte Events auf `closed` mappt, ist das automatisch konsistent.

---

## Out of scope für diesen Schritt

- Kanban-Library-Wechsel (`@dnd-kit`) — separater Task.
- Tabellen-Library-Wechsel (bleibt `@tanstack/react-table`).
- Migration der 66 Legacy-`event_inquiries`-Zeilen — falls darin noch echte Daten liegen, bitte separat klären.

## Frage an dich, bevor ich umsetze

Sind die 66 Zeilen in `event_inquiries` vollständig in `v2_events` migriert, oder sollen wir beide Tabellen mergen, bis du sie selbst archivierst? Ich empfehle: **nur `v2_events`** lesen und `event_inquiries` ignorieren; falls du die alten doch sehen willst, ergänze ich einen Legacy-Toggle.
