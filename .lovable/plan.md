

# Dashboard UX/UI Audit — Findings & Fixes

## Audit (Stand des Screenshots `/admin`)

### 🔴 Funktionale Defekte
1. **Archivierte Datensätze tauchen weiter auf.** Nur `useDashboardData` filtert `event_inquiries.archived_at IS NULL`. **`useUpcomingReminders` filtert es nicht** → archivierte Anfragen produzieren weiterhin „Angebotserinnerungen". Auch stornierte Catering-Bestellungen (`status='cancelled'`) und declined Events laufen durch.
2. **Hero zeigt etwas in 7 Tagen als „Als nächstes".** „Mimmo · Do., 30. Apr · 17:00" — heute ist Mittwoch 23.4. Hero soll **nur 0–24h** zeigen, sonst ruhiger Empty-State.
3. **„Hallo, info."** — Name-Mapping greift nicht für `info@…`. Sollte den Vornamen aus `adminDisplayNames` ziehen oder neutral „Hallo." bleiben.
4. **Header sagt „0 Termine heute"** während Hero-Karte gleichzeitig groß einen Termin zeigt → Widerspruch.

### 🟠 Hierarchie & Informationsdichte
5. **8 fast identische „Angebotserinnerung an …"-Zeilen** in der Automatik-Spalte. Keine Gruppierung, keine Dedup, kein Empfänger-Avatar — visuelles Rauschen. Linear/Cron würden gleichartige Reminder zu einem ausklappbaren Stapel falten.
6. **Posteingang besteht aus 2 Bereichen** (Überfällige Zahlungen + Neue Eingänge) — der zweite ist leer und wirkt verlassen. Bei 0 Eingängen sollte er kollabieren und Energie auf den überfälligen Block lenken.
7. **„Heute"-Spalte = große leere Karte.** Verschwendet die wertvollste Spalte. Besser: Empty-State mit den nächsten 3 anstehenden Tagen als Mini-Vorschau + CTA „Woche planen".
8. **Spaltenbreiten gleich** trotz unterschiedlicher Wichtigkeit. Outbox ist gerade Hauptkonsument der Bildschirmbreite, gehört aber visuell zurückgenommen.

### 🟡 Grafik / Style
9. **Monochrom-Verstoß:** Orange/Gelb-Logo links oben, dezente farbige Pillen — Memory-Regel verlangt strikt monochrom (Akzent nur destructive-rot).
10. **Right-Cut:** „Domenico Sp" wird abgeschnitten. Ellipsis fehlt korrekt; Container braucht `min-w-0`.
11. **Overdue-Block ist ein roter Block.** Wirkt alarmistisch ohne Aktion. Sollte als kompakte Liste mit „Erinnern" / „Öffnen" pro Zeile rendern.
12. **„Live · vor 14s"** rechts oben isoliert vom Header → besser inline neben „Pinnwand · Donnerstag".
13. **„Neue Eingänge 0"** als Sektionsheader mit `0`-Counter ist visuell schwer wie ein voller Block. Bei 0 entweder kollabieren oder als 1-Zeilen-Hint.
14. **Section-Header ohne Aktion**: jede Spalte braucht eine sekundäre Aktion oben rechts (z. B. „Alle Termine", „Alle Anfragen", „Alle Reminder").

### 🔵 Interaktion & 2026-Standards
15. **Kein Keyboard-Shortcut-Hint** (`⌘K`, `j/k` Navigation in Listen) — Linear-Standard.
16. **Kein Empty-State-Wert.** „Keine geplanten Lieferungen oder Events" sagt nichts; zeige stattdessen die nächste anstehende Operation als „Übermorgen 17:00 · Mimmo · 107 P." Vorschau-Karte.
17. **Kein „Snooze"-Stack** im Outbox: Skip ist ein einsamer X-Button. Besser Dropdown: Überspringen / In 1h / Sofort senden.

---

## Plan: Korrekturen & Premium-Refresh

### Welle A — Datenintegrität (P0, sofort)

**A.1 Archivierte/Stornierte/Declined konsequent filtern**
- `useUpcomingReminders.ts`:
  - `offerQ`: `.is("archived_at", null)` ergänzen, Status `declined`/`confirmed` ausschließen.
  - `taskQ`: Inquiry-Join, archivierte Inquiry-Tasks ausschließen.
  - `catQ`: `status` darf nicht `cancelled` sein.
  - `payQ`: nicht-archivierte Inquiry erforderlich (Filter via `inquiry_id IN (…)` aus geladenen Inquiries).
- `useDashboardData.ts`:
  - Catering-Operations + Catering-Inbox: `.neq("status", "cancelled")`.
  - Event-Bookings: `.not("status", "in", "(cancelled,refunded)")`.
  - Group-Inquiries: `.not("status", "in", "(declined,archived)")` falls Spalte vorhanden.

**A.2 Hero auf echtes „Jetzt-Fenster" begrenzen**
- `NextUpHero.tsx`: nur Operationen anzeigen, deren Datum **heute oder morgen** und Zeit innerhalb der nächsten 24h ist. Andernfalls Empty-Hero („Heute frei. Nächster Termin am 30. Apr.") in zurückhaltender Variante.

**A.3 Header-/Hero-Konsistenz**
- Wenn Hero einen Termin zeigt, darf Header nicht „0 Termine heute" sagen. Header zählt: `todayOps.length` für „Termine heute" + getrennte Zeile „Diese Woche: N Termine, davon nächster in X" wenn heute leer.

**A.4 Begrüßung repariert**
- `getAdminFirstName('info@events-storia.de')` → fällt zurück auf neutralen Begriff (z. B. „Hallo." ohne Name) statt „Hallo, info.".
- Ergänzung in `adminDisplayNames.ts`: Mapping für `info@events-storia.de` → kein Vorname (Service-Account), Header zeigt nur Begrüßung.

---

### Welle B — Hierarchie & Klartext (P1)

**B.1 Outbox: Reminder-Stack pro Empfänger/Kind**
- Identische Reminder-Typen mit gleichem Crontag werden gestapelt: „Angebotserinnerungen · 8 Empfänger · Fr 10:00" mit Aufklappen.
- Empfänger-Initialen-Avatar (Mono) statt Mail-Icon pro Zeile.
- Skip-Button → Dropdown (Überspringen heute · Verschieben 24h · Sofort senden).

**B.2 Posteingang verschlanken**
- Wenn `inbox.length === 0`: Sektion „Neue Eingänge" wird zu 1-Zeilen-Hint („Keine neuen Anfragen seit 48h").
- Überfällige Zahlungen werden zur Liste mit pro Zeile: Avatar · Name · Betrag · Tage · `Erinnern` / `Öffnen`.

**B.3 Heute-Spalte: produktiver Empty-State**
- Bei `todayOps.length === 0`: zeige Mini-Vorschau der nächsten 3 Operationen (mit Datum) + Link „Woche öffnen".

**B.4 Spaltengewichtung Desktop**
- Grid: `grid-cols-12` mit Heute=4, Posteingang=4, Automatik=4 (gleich) → bei Outbox-Stack-Reduktion bleibt visuelle Gleichgewichtung.

---

### Welle C — Visuelles Premium-Polish (P2)

**C.1 Monochrom-Cleanup im Layout**
- Sidebar-Logo: Mono-Variante (kein Orange-Tile) bzw. neutralisierte Hintergrund-Pille.
- Aktiver Sidebar-Tab: `bg-foreground text-background`, kein Orange.

**C.2 Truncation & Min-Width**
- Outbox-Items: Container bekommt `min-w-0`, Titel `truncate`, Empfänger-Caption `truncate`.

**C.3 Header-Komposition**
- „Pinnwand · {Tag, Datum} · Live · vor 0:14s" als ein typografischer Strip → keine schwebende Live-Pille rechts mehr.

**C.4 Section-Header mit sekundärer Action**
- Jede Spalte: H2 + kleine Caption + ghost-Link rechts (`Alle anzeigen →`) für Tiefe.

**C.5 Status-Pills typografisch**
- Hero-Pille „LIEFERUNG" wird zu `bg-foreground text-background uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full`. Personenanzahl bekommt `tabular-nums`.

**C.6 Skeleton-Konsistenz**
- Hero-Skeleton matched die finale Form (96px Höhe, gleiche Padding) — verhindert Layout-Shift.

---

## Geänderte Dateien

| Datei | Welle | Änderung |
|---|---|---|
| `src/hooks/useUpcomingReminders.ts` | A.1 | Archived/Cancelled/Declined Filter |
| `src/hooks/useDashboardData.ts` | A.1 | Cancelled/Refunded ausschließen |
| `src/components/admin/refine/dashboard/NextUpHero.tsx` | A.2 | 0–24h-Fenster, ruhiger Empty-State |
| `src/components/admin/refine/Dashboard.tsx` | A.3, A.4, C.3 | Header-Konsistenz, Begrüßungs-Fallback, Strip-Layout |
| `src/lib/adminDisplayNames.ts` | A.4 | `info@events-storia.de` → neutral |
| `src/components/admin/refine/dashboard/OutboxColumn.tsx` | B.1, C.2 | Stack-Gruppierung, Skip-Dropdown, Truncation |
| `src/components/admin/refine/dashboard/InboxColumn.tsx` | B.2 | Empty-State, Overdue-Liste mit Aktionen |
| `src/components/admin/refine/dashboard/TodayOperationsColumn.tsx` | B.3 | Empty-State Mini-Vorschau |
| `src/components/admin/refine/AdminLayout.tsx` (falls Sidebar) | C.1 | Mono-Logo, Mono-Active-Tab |
| `src/hooks/useOperationActions.ts` | B.1 | Erweiterung: snoozeReminder (24h) |

**Keine** DB-Änderungen. **Keine** Edge-Function-Änderungen.

---

## Erwartetes Ergebnis

- Archivierte Anfragen verschwinden vollständig aus Hero, Inbox, Outbox.
- Hero zeigt nur noch echte „Jetzt"-Termine (0–24h); ansonsten ruhiger, ehrlicher Empty-State.
- Outbox kollabiert 8 redundante Reminder-Zeilen zu einem Stack — Bildschirm wirkt aufgeräumt.
- Begrüßung passt; Header und Hero widersprechen sich nicht mehr.
- Sidebar + Tabs sind monochrom, konsistent mit Memory-Regel.
- Spaltenformate, Truncation und Section-Aktionen entsprechen Linear-/Vercel-Standard 2026.

**Reihenfolge:** Welle A (P0) zuerst — kritische Datenfehler. Dann B (Hierarchie) und C (Polish).

