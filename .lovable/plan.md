## Kanban-Redesign + Ampel-System (Tabelle + Kanban)

### Diagnose

**Bug:** `EventsList.tsx:652` übergibt `allEvents` (inkl. archivierter) ans Kanban. Tabelle filtert über `activeEvents`. Deshalb wirkt das Lead-Board mit 25+ „Dringend"-Karten überladen — viele davon sind alte Archiv-Anfragen.

**UX-Probleme im aktuellen Kanban:**
- Karten zu hoch (4 Zeilen + Footer + Border-Akzent), Lead-Spalte explodiert auf 25 Karten
- Inflationäre rote „Dringend"-Badges (jede `new`-Anfrage > 48h wird rot) → Signal verbrennt
- Status-Logik vermischt Pipeline-Phase (Lead/Proposal/Pending) und Handlungsbedarf (Dringend / Kunde antwortete / Inaktiv) → Nutzer sieht nicht auf einen Blick, was JETZT zu tun ist
- 6 Spalten (inkl. Lost/Closed) für Tagesarbeit zu viel
- Tabelle hat kein einheitliches Ampelsignal — Status-Badges sind farblich uneinheitlich (grün für „Angebot gesendet", was eigentlich „warten auf Kunde" heißt)

---

### Lösung: Einheitliches 3-stufiges Ampel-System

Neue **Action-State-Ableitung** (nicht Status, sondern „was muss ich tun?"). Wird in einem neuen Helper `getInquiryActionState(event)` gekapselt und in Tabelle UND Kanban verwendet:

| Action State | Trigger (in dieser Reihenfolge geprüft) | Farbe | Label |
|---|---|---|---|
| 🔴 **Antworten** (höchste Prio) | `offer_phase = 'customer_responded'` ODER `status = 'new'` und älter als 24 h ohne Reaktion | rot | „Antworten" / „Kunde wartet" |
| 🟡 **In Arbeit** | `status = 'contacted'` (Bearbeitung), oder Angebot versendet < 7 Tage, oder neu < 24 h | amber | „Neu" / „In Bearbeitung" / „Angebot offen" |
| 🟢 **Gebucht** | `status = 'confirmed'` | grün | „Gebucht" |
| ⚪ **Erledigt** | `declined` / `cancelled` / archiviert | grau | „Abgelehnt" / „Abgesagt" |

Rot ist exklusiv für „erfordert sofort eine Reaktion". Damit verschwinden die 25 roten Karten und es bleiben die echten 3–5 Vorgänge übrig, die heute beantwortet werden müssen.

---

### Kanban-Redesign

**1. Archivierte ausschließen**
`EventsList.tsx:652`: `events={allEvents}` → `events={activeEvents}`. Sofortige optische Entlastung.

**2. Spalten reduzieren auf 4 Pipeline-Phasen** (statt 6)

```text
┌──────────┬──────────────┬─────────────┬──────────┐
│ NEU      │ IN BEARBEIT. │ ANGEBOT RAUS│ GEBUCHT  │
│ (Lead)   │ (Proposal)   │ (Pending)   │ (Won)    │
└──────────┴──────────────┴─────────────┴──────────┘
```

Lost/Closed wandern in einen einklappbaren „Archiv"-Footer am Ende (default collapsed). Wer abgelehnte/abgesagte sehen will, klappt auf — sie verstopfen aber nicht das Tagesgeschäft.

**3. Layout: echtes Kanban statt gestapelter Sections**

Aktuell: vertikal gestapelte volle-Breite-Sections mit 4-Spalten-Grid pro Section → wirkt wie eine Liste mit Überschriften, nicht wie Kanban.

Neu: 4 horizontal nebeneinander stehende Spalten (Desktop ≥ lg), jede Spalte vertikal scrollbar mit kompakten Karten untereinander. Mobile: Tabs oder horizontaler Scroll. Das ist das Standard-Kanban-Pattern (Trello/Linear) und macht den Vergleich zwischen Spalten möglich.

**4. Kompaktere Karten** (von ~140 px auf ~80 px Höhe)

```text
┌─────────────────────────────────────┐
│ 🔴 Martin Uhlig            13.05.26 │  ← Action-Dot + Name + Datum
│    20 Gäste • 2.400 €      AM · 2d  │  ← Meta + Bearbeiter + Inaktivität
└─────────────────────────────────────┘
```

- Action-State als 8 px Dot links (rot/amber/grün/grau) — kein voller Badge mehr
- Name fett, Datum rechts
- Eine Meta-Zeile: Gäste · Betrag · Bearbeiter-Initialen · Inaktivitäts-Hinweis
- Linker Border-Akzent in Action-State-Farbe (3 px) für Scanbarkeit
- Hover: leichte Hebung, Drag-Handle erscheint

**5. Spalten-Header mit echtem Mehrwert**

Nicht nur Anzahl + Summe, sondern auch Anzahl in jedem Action-State:
`NEU · 14 · 🔴 3  🟡 11`

So sieht man pro Spalte: „in Lead liegen 3 die heute beantwortet werden müssen".

---

### Tabelle: Ampel-Spalte ergänzen

Status-Spalte wird zu einer einheitlichen Ampel (8-px-Dot + Label) mit derselben `getInquiryActionState`-Logik. Bestehende Tab-Filter (Eingang/Bestätigt/Archiv/Alle) bleiben unverändert. Optional: neue Sortier-/Filter-Option „Nur Antworten nötig" (rot) oben in den Tabs.

---

### Technische Details

**Neue Datei** `src/lib/inquiryActionState.ts`:
```ts
export type ActionState = 'respond' | 'in_progress' | 'won' | 'done';
export function getInquiryActionState(event: EventInquiry): {
  state: ActionState;
  label: string;
  dotClass: string;       // bg-red-500 / bg-amber-500 / bg-emerald-500 / bg-slate-300
  borderClass: string;    // border-l-red-500 etc.
  textClass: string;
} { /* zentrale Logik */ }
```

**Geänderte Dateien:**
- `src/components/admin/refine/EventsList.tsx` — `events={activeEvents}` an Kanban; Status-Zelle der Tabelle nutzt neuen Helper
- `src/components/admin/refine/KanbanView.tsx` — neues 4-Spalten-Layout, Archiv-Footer, kompakte Karten, neuer Helper statt eigener Logik
- `src/lib/inquiryActionState.ts` — neu

**Out of Scope:**
- DnD-Bibliothek-Wechsel (HTML5-DnD bleibt)
- Status-Wert-Änderungen in der DB
- Mobile-spezifische Kanban-Interaktion (Swipe etc.) — separate Iteration

### Smoke-Test
1. Kanban: archivierte Anfragen verschwinden komplett aus den 4 aktiven Spalten
2. „Antoine Monot" und „Test io" (Kunde antwortete) erscheinen mit rotem Dot in „Angebot raus"
3. Lead-Spalte zeigt nur Anfragen ≤ 24 h alt rot, ältere amber → drastisch weniger Rot
4. Tabelle: Status-Zelle nutzt identische Farben/Labels wie Kanban — visueller Bruch zwischen den Ansichten verschwindet
