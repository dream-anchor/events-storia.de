# Dashboard → Team-Pinnwand "Was kommt als nächstes"

Aktuelles Dashboard ist eine Eigenbau-Triptych (Heute/Inbox/Outbox + Heatmap + NextUpHero). Die Daten sind gut, die Darstellung beantwortet aber nicht klar die Frage: *"Was muss als Nächstes erledigt werden — und von wem?"*

Wir ersetzen es durch eine **priorisierte Team-Worklist** als Hauptbereich, flankiert von einer **kompakten Tag-Timeline**. Dafür nutzen wir bewährte Libraries — keine eigenen Komponenten von Null.

## Library-Wahl

| Zweck | Library | Lizenz | Begründung |
|---|---|---|---|
| Worklist (sortierbar, filterbar, gruppiert) | **@tanstack/react-table v8** | MIT | Bereits im Projekt. Headless, voll Tailwind-/shadcn-kompatibel, monochrom stylebar. |
| Mini-Tag-Timeline (rechts) | **@schedule-x/react** + `@schedule-x/calendar` | MIT | Modern, headless, leichtgewichtig (~30kb), Light-Mode-tauglich, Inter-Font, monochrom theme-bar. Aktiv gewartet. |
| Drag-Reorder (Pinnen/Snooze) | **@dnd-kit/core** (bereits im Projekt) | MIT | Konsistent mit Kanban. |

Verworfen: FullCalendar (Lizenz/AGPL für Premium-Views), react-big-calendar (veraltete Optik), react-trello/react-kanban (falsches Paradigma — wir wollen Liste, keine Spalten).

## Layout (Desktop ≥1280px)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Pinnwand · Sonntag, 10. Mai · Live · vor 3s                         │
│ Guten Morgen, Antoine.                                              │
│ 4 Aufgaben jetzt · 2 SLA-kritisch · 9 heute                         │
├──────────────────────────────────────────────┬──────────────────────┤
│ FILTER: [Alle][Jetzt][Heute][Diese Woche]    │  HEUTE · TIMELINE    │
│ TYPE:   [Anfrage][Event][Catering][Zahlung]  │  ┌────────────────┐  │
│                                              │  │ 09:00          │  │
│ ┌──────────────────────────────────────────┐ │  │ ▌ Pickup Müller│  │
│ │ ● JETZT · 11:30                          │ │  │ 12:30          │  │
│ │   Catering-Lieferung Schmidt · 30 PAX    │ │  │ ▌ Liefer. K.   │  │
│ │   📍 Lehel · ⚠ Menü unbestätigt          │ │  │ 18:00          │  │
│ │   [Details] [Anrufen]                    │ │  │ ▌ Event AOK    │  │
│ ├──────────────────────────────────────────┤ │  └────────────────┘  │
│ │ ● SLA · seit 51h ohne Antwort            │ │                      │
│ │   Anfrage Becker · Hochzeit 80 PAX       │ │  WOCHE               │
│ │   [Antworten] [Snooze]                   │ │  Mo Di Mi Do Fr      │
│ ├──────────────────────────────────────────┤ │  ▂ ▅ █ ▃ ▁           │
│ │ ○ HEUTE · 14:00 · Anzahlung fällig       │ │  3  5  9  4  1       │
│ │   Event Weber · 1.200 € offen            │ │                      │
│ │   [Mahnen] [Stripe öffnen]               │ │                      │
│ └──────────────────────────────────────────┘ │                      │
└──────────────────────────────────────────────┴──────────────────────┘
```

Mobile: Timeline klappt unter Worklist; bestehende Tab-Bar entfällt.

## Priority-Engine (Kern)

Neue Datei `src/lib/dashboardPriority.ts` mit reiner Funktion `scoreTask(task) → { score, bucket, reasons[] }`. Buckets in dieser Reihenfolge:

1. **JETZT** (`score 1000+`): Operation in den nächsten 2h, oder Operation laufend.
2. **SLA-kritisch** (`score 800+`): Anfrage > 24h ohne Antwort, Zahlung überfällig, Menü < 48h vor Termin unbestätigt.
3. **HEUTE** (`score 500+`): Operation heute, Reminder heute fällig.
4. **DIESE WOCHE** (`score 200+`): Operation in 1–7 Tagen, Anfragen mit `awaiting_customer`.
5. **OFFEN** (`score 0+`): alles andere im 14-Tage-Fenster.

Zusatz-Modifier: `+ageDays * 5`, `+missingMenu * 50`, `+overduePayment * 80`. Reasons werden als kleine Chips in der Zeile gerendert ("Menü unbestätigt", "51h ohne Antwort", "Anzahlung überfällig").

## Datenfluss

`useDashboardData` liefert bereits `operations`, `inbox`, `staleInquiries`, `overduePayments`. Neuer Hook `useDashboardTasks()`:

1. Ruft `useDashboardData()` auf.
2. Mappt jede Quelle auf eine einheitliche `DashTask`-Struktur:
   ```ts
   type DashTask = {
     id; sourceKind: "operation"|"inquiry"|"payment"|"reminder";
     title; subtitle; customerName; serviceType: "restaurant"|"catering"|"payment"|"inquiry";
     dueAt: Date | null; reasons: string[]; navigateTo: string;
     primaryAction?: { label; href|onClick };
     score: number; bucket: "now"|"sla"|"today"|"week"|"open";
   }
   ```
3. Wendet `scoreTask` an, sortiert, deduppliziert (eine Operation kann gleichzeitig "Menü unbestätigt" + "Heute" sein → eine Zeile, mehrere Reasons).

## Komponenten

Neu unter `src/components/admin/refine/dashboard/`:

- `Pinnwand.tsx` — neuer Container, ersetzt den Inhalt von `Dashboard.tsx`.
- `WorklistTable.tsx` — TanStack-Table mit Spalten *Status (Bucket-Dot), Fällig, Kunde, Aufgabe, Reasons, Aktion*. Gruppiert per `bucket`. Row-click → `navigateTo`.
- `WorklistFilters.tsx` — Bucket-Pills + Type-Toggles + Suche (Headless, kein neues Lib).
- `DayTimelineSidebar.tsx` — `@schedule-x/react` `createCalendar` mit `viewDay`. Events = Operations heute. Monochromes Theme via CSS-Variables-Override.
- `WeekSparkline.tsx` — bestehender `byDay` als kleines 7-Bar-Sparkline (ersetzt Heatmap, behält Info, weniger visuelles Gewicht).

`Dashboard.tsx` wird zu einem dünnen Wrapper, der `<Pinnwand />` rendert. NextUpHero, TodayOperationsColumn, InboxColumn, OutboxColumn, WeekHeatmap werden gelöscht (Funktionalität wandert in WorklistTable + DayTimelineSidebar).

## Aktionen pro Zeile

Inline-Buttons (kein Floating, links-bündig nach Memory):
- Anfrage stale → **Antworten** (öffnet Inquiry-Editor) + **Snooze 24h** (lokaler Localstorage-Snooze, später DB).
- Operation heute → **Details** + **Anrufen** (`tel:`).
- Zahlung überfällig → **Mahnen** (sendet Reminder via bestehender Funktion) + **Stripe öffnen**.
- Menü unbestätigt → **Erinnerung senden** (bestehende Reminder-Logik).

## Snooze (V1, optional)

Pro Task: lokaler Snooze in `localStorage` Key `pinnwand:snooze:{taskId}` mit Ablauf-Timestamp. Snoozed Tasks rutschen aus JETZT/SLA in OFFEN bis Ablauf. V2 könnten wir das auf eine `dashboard_snoozes`-Tabelle migrieren, ist aber nicht Scope dieses Plans.

## Styling

- Strict Light-Mode, Inter, `rounded-2xl`, neutrale Grautöne.
- Bucket-Dots: `bg-foreground` (JETZT), `bg-foreground/70` (SLA), `bg-foreground/40` (HEUTE), `bg-foreground/20` (Woche/Offen). Kein Rot/Grün/Gelb — Hierarchie über Sättigung.
- Schedule-X Theme: CSS-Variablen-Override in einer kleinen `schedule-x-theme.css` (Hintergrund `--background`, Border `--border`, Event-Bg `--muted`).

## Migration / Cleanup

Nach Umsetzung lösche:
- `src/components/admin/refine/dashboard/NextUpHero.tsx`
- `…/TodayOperationsColumn.tsx`, `InboxColumn.tsx`, `OutboxColumn.tsx`, `WeekHeatmap.tsx`

`useDashboardData` bleibt unverändert (Datenquelle), nur Konsumenten ändern sich.

## Technische Risiken

- **Schedule-X Bundle-Size**: ~30 kb gz, akzeptabel.
- **Typenkonflikt** mit `setTimeout` → konsequent `ReturnType<typeof setTimeout>` (Memory-Regel).
- **Realtime-Refresh**: bestehender 60s-Polling reicht; optional Supabase-Realtime auf `event_inquiries`/`catering_orders` für Live-Updates (V2).

## Schritte

1. Install: `@schedule-x/react @schedule-x/calendar @schedule-x/theme-shadcn`.
2. `src/lib/dashboardPriority.ts` + `useDashboardTasks` Hook.
3. `WorklistTable`, `WorklistFilters`, `DayTimelineSidebar`, `WeekSparkline`, `Pinnwand`.
4. `Dashboard.tsx` auf Pinnwand umstellen, Alt-Komponenten löschen.
5. Visuelle QA bei 1464px + Mobile, Live-Polling-Check.
