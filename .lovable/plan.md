## Ziel
Den Orders-Kanban (`/admin/orders`, Tab „Kanban") auf das gleiche Bedien- und Designmodell wie den Inquiries-Kanban (`/admin/inquiries`) bringen — gleiche Bucket-Logik, gleiche Karte, gleiches Drag-and-Drop, gleiches Slate/Grid-Layout.

## Was vom Inquiries-Kanban übernommen wird

**Logik (`UnifiedKanbanView`-Pattern):**
- Lifecycle-Buckets statt 4 nebeneinander gestreckter Status-Spalten. Bucket-Switcher als Pillen-Tabs über dem Board (analog Inquiries) — `Eingang`, `Erledigt`, `Archiv`.
- Pro Bucket 1–2 Sub-Spalten als responsives Grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), nicht horizontal-scrollbar.
- Drag-and-Drop wechselt nur **innerhalb** des Buckets den Status (z. B. `pending → confirmed`). Bucket-übergreifende Bewegungen laufen weiter über das Dropdown-Menü auf der Karte (kein versehentliches Stornieren per Drag).
- Spalten-Header zeigen Titel, Anzahl und Brutto-Summe der Karten — identisch zur Inquiries-Variante.
- Empty-State: dashed Border + Text „Hierher ziehen" (droppable) bzw. „Leer".

**Bucket-Mapping für Orders:**
```text
Eingang (inbox)     pending     "Neu / offen"
                    confirmed   "Bestätigt"
Erledigt (done)     completed   "Erledigt"
Archiv (archive)    cancelled   "Storniert"
```
Eingang ist der Default. Counts werden aus der vollen `kanbanQuery` (alle Status) berechnet — nicht nur aus dem aktuell sichtbaren Bucket.

**Design (Slate/Premium-Light-Tokens):**
- Spalten: `rounded-2xl border border-slate-200 bg-slate-50/60`, Drag-Over-Ring in `foreground/40`.
- Karten: `rounded-xl border border-slate-200 border-l-[3px]`, linker Akzentstreifen je nach Dringlichkeit:
  - rot/`destructive` wenn Liefertermin in ≤ 2 Tagen und Status `pending`
  - neutral `foreground/20` sonst
- Karten-Header: kleines Payment-Badge (statt ServiceBadge) + Bestellnummer + Datum (rechts).
- Action-Zeile: farbiger Dot + Kurzlabel („Antwort wartet", „Unbezahlt", „Bereit") — wiederverwendet die Logik aus `last_customer_message_at` / `payment_status`, in einer kleinen Helper-Funktion analog zu `getRecordActionState`.
- Footer: Kunde links, Summe + Lieferung/Abholung rechts, `tabular-nums`.
- Hover: `hover:shadow-sm hover:border-foreground/30`, identisch zu Inquiries.

## Technische Schritte

1. **`OrdersKanbanView.tsx` neu aufsetzen** nach dem Vorbild von `UnifiedKanbanView.tsx`:
   - `BUCKET_COLUMNS`-Konstante mit den oben genannten Mappings + `dropStatus` pro Sub-Spalte.
   - `bucket`-Prop entgegennehmen.
   - DnD-Handler (`onDragStart/Over/Drop`) wie in der Vorlage; Update via `supabase.from('catering_orders').update({ status })`.
   - Bestehendes Dropdown („Status ändern") behalten — es bleibt der einzige Weg, in einen anderen Bucket (z. B. nach „Storniert") zu wechseln.
   - Karten-Render mit dem neuen Layout (Payment-Badge, Action-Dot, Akzentleiste).

2. **Helper `getOrderActionState(order)`** in derselben Datei oder unter `src/lib/orderActionState.ts`:
   - Eingaben: `payment_status`, `payment_method`, `is_pickup`, `last_customer_message_at`, `last_our_reply_at`, `desired_date`, `status`.
   - Ausgabe: `{ label, dotClass, textClass, borderClass }` — Klassen aus den semantischen Tokens (kein direktes `bg-rose-*`, sondern `text-destructive`, `bg-foreground` etc., konform mit Monochrome-Standard).

3. **`OrdersList.tsx`** anpassen:
   - Neuer State `kanbanBucket: 'inbox' | 'done' | 'archive'`, Default `'inbox'`, in `localStorage` gespiegelt.
   - Pillen-Tab-Leiste über dem `<OrdersKanbanView>` (gleicher Stil wie Inquiries: `p-1 rounded-2xl bg-muted/60` mit aktiver Pille in `bg-white shadow-sm`).
   - Tab-Counts werden aus `kanbanQuery.result?.data` aggregiert.
   - `<OrdersKanbanView>` bekommt `bucket={kanbanBucket}` zusätzlich zu `orders` und `onRefresh`.
   - Der Subtitel über dem Board zeigt analog zu Inquiries: „X Bestellungen im Bucket „…"".

4. **Keine Änderungen** an Tabellen-Ansicht, Filter-Pillen der Tabelle, Edge-Functions, Cron-Logik oder Stripe-Webhook — der Status-Flow `paid → confirmed → completed` (über Cron) bleibt erhalten.

## Abgrenzung / Risiken
- Karten bleiben **nicht** zwischen Buckets per Drag verschiebbar — bewusst, um versehentliches Stornieren zu verhindern (gleiche Sicherheit wie bei Inquiries).
- Falls eine Bestellung weder `pending/confirmed/completed/cancelled` ist (unwahrscheinlich), fällt sie als Fallback in die erste Sub-Spalte des aktiven Buckets — verhindert verlorene Karten.
- Counts sind über die separate `kanbanQuery` (pageSize 500) bereits vorhanden; keine zusätzliche DB-Abfrage nötig.

## Definition of Done
- `/admin/orders` → Kanban-Ansicht hat oben die Bucket-Pillen `Eingang · Erledigt · Archiv` mit Counts.
- Bucket `Eingang` zeigt zwei Sub-Spalten (Neu / Bestätigt) als responsives Grid mit Summen-Anzeige.
- Karten lassen sich per Drag zwischen Sub-Spalten desselben Buckets verschieben → Status wird in Supabase aktualisiert, Toast erscheint.
- Bucket-Wechsel-Dropdown auf jeder Karte bleibt funktional.
- Visueller Stil identisch zum Inquiries-Kanban (Slate-Spalten, weiße Karten, linker Akzentstreifen, Action-Dot, Premium-Light-Monochrom).
