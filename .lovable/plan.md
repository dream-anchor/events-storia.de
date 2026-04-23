

# Dashboard Audit — CX & Visual Design (2026 State-of-the-Art)

## Status Quo

Das Dashboard ist **funktional vollständig** (Triptychon, Wochen-Heatmap, Outbox), wirkt aber wie ein **klassisches B2B-Tool 2022**, nicht wie ein 2026-Cockpit. Drei strukturelle Brüche:

### CX-Befunde
1. **Kein "Jetzt-Moment"**: Beim Öffnen sieht der Betreiber drei gleichgewichtete Spalten — aber nicht **die nächste Aktion in den nächsten 2h** (z.B. „In 47 Min: Lieferung Müller, 25 P., Schwabing"). Das ist die wichtigste Information eines Operations-Cockpits.
2. **Keine Hierarchie der Dringlichkeit**: Überfällige Zahlungen, stale Anfragen, Outbox-Reminder konkurrieren visuell. Der Betreiber muss selbst priorisieren statt geleitet zu werden.
3. **Kein Kontext zum eigenen Bestand**: KPIs der Woche stehen unten, ohne Trend (Vor-Woche, Vor-Monat). Kein „Auslastung 78%, +12% vs. letzte Woche".
4. **Outbox ist passiv**: User sieht „3 Mails gehen heute 18:00 raus" — kann aber nicht mit einem Klick *eine einzelne abbrechen oder verschieben*.
5. **„Heute läuft" enthält +7 Tage** trotz des Namens. Verwirrend.
6. **Keine Realtime-Indikatoren**: Kein „aktualisiert vor 12 Sek", kein dezenter Live-Pulse, kein Toast bei neuem Eingang.
7. **Direktaktionen fehlen**: Anrufen ✓, Navigieren ✓ — aber kein „Erledigt" auf Karte (im Plan vorgesehen, nicht umgesetzt), kein „Snooze 2h", kein Bulk-Mark.

### Grafik-/Design-Befunde
1. **Monochrom-Verstoß** (Memory-Regel): Bunte Status-Dots (`bg-emerald-500`, `bg-amber-500`, `text-amber-600`, `text-emerald-600` in mehreren Komponenten). Erlaubt sind nur Neutral-Grays + Akzent-Rot für Überfälliges.
2. **Typografische Flachheit**: Alle H2 sind `text-sm uppercase tracking-wider` — kein typografischer Anker, kein Display-Weight. 2026-Standard (Linear, Vercel, Cron) nutzt **größere, ruhigere Headlines** mit klarer Hierarchie.
3. **Border-Inflation**: Jede Sektion hat `border border-border/60 rounded-2xl p-4` — ergibt **Card-on-Card-on-Card**. State-of-the-Art ist *eine* Container-Ebene + interne Trennung über Whitespace und 1-px-Lines.
4. **Status-Dots als Mini-Kreise** statt als typisierte Pills mit Klartext. Linear/Notion zeigen **Text-Status** („Confirmed", „Awaiting payment") statt Farbpunkten.
5. **Wochen-Heatmap = Mini-Bar-Chart** ohne klickbare Tageskarten. Kein Hover-Detail, keine Drill-Through, keine Vergleichslinie zum Schnitt.
6. **„Geht raus" Header zeigt** die `scheduledLabel` ohne Symbol-Anker (Tageszeit). Schwer überfliegbar.
7. **Kein dunkler Akzent für „Now"**: Heute-Tag in Heatmap nutzt nur subtiles `border-foreground` — verschwindet visuell.
8. **Loading = Spinner**, kein Skeleton (Inkonsistent zum bereits ausgerollten OfferBuilder-Skeleton).
9. **Tap-/Hover-Targets** in Inbox-Listen sind ~28 px hoch — unter dem Apple-/Material-Standard von 44 px für Touch.

---

## Vision: 2026 Operations Cockpit

Inspiriert von Linear Inbox, Cron, Vercel Observability, Apple Wallet-Stacks. **Eine Pinnwand, die in 5 Sekunden die nächste richtige Aktion zeigt.**

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Pinnwand · Mittwoch                                       Live · 0:12s  │
│  Guten Morgen, Antoine. 3 Termine heute · 1 Entscheidung wartet.        │
├──────────────────────────────────────────────────────────────────────────┤
│  ▌ JETZT  In 47 Min                                          [Hero-Card]│
│  ▌ 12:00 · Lieferung Müller GmbH · 25 P. · Schwabing                    │
│  ▌ Adresse  ·  Anrufen  ·  Erledigt  ·  Verschieben                     │
├─────────────┬────────────────────────────┬───────────────────────────────┤
│ HEUTE (3)   │ POSTEINGANG (5)            │ AUTOMATIK (4 in 24h)          │
│ Linear-Liste│ + 2 stale  · + 2 überf.   │ Inline pro Card abbrechbar    │
└─────────────┴────────────────────────────┴───────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ Diese Woche · 23.–29. April                              78% Auslastung │
│ ▆▃▂▅█▆▁  Mi Do Fr Sa So Mo Di     +12% vs. Vor-Woche · 11.300€ · 71% bz│
│ Nächste Woche →   3 Termine · 45 Gäste · ⚠ 1 Risiko (Menü offen)        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Konkrete Änderungen

### Welle 1 — Hierarchie & Klartext (½ Tag)

**1.1 „Jetzt"-Hero-Card oben (NEU)**
Über den drei Spalten: eine **breite Hero-Karte**, die *die nächste anstehende Operation* zeigt (nächste 0–4h). Mit großer Uhrzeit, „in 47 Min", Customer, Direktaktionen.
Wenn nichts ansteht: „Heute frei. Nächster Termin: morgen 12:00 …" als ruhige Variante.
Datei: `src/components/admin/refine/dashboard/NextUpHero.tsx` (neu) + `Dashboard.tsx`.

**1.2 Personalisierte Begrüßung + Live-Indikator**
Header-Strip wird: „Guten Morgen, {Antoine}. {n} Termine heute · {m} Entscheidungen warten." + dezenter Live-Pulse-Punkt mit „aktualisiert vor 0:12 s".
Datei: `Dashboard.tsx` (+ kleiner Hook für „seconds since last fetch").

**1.3 „Heute läuft" → echtes Heute (mit Tab „+7 Tage")**
Default zeigt nur heute. Subtiler Toggle „+7 Tage" oben rechts der Spalte.
Datei: `TodayOperationsColumn.tsx`.

**1.4 Monochrom-Cleanup**
Alle `emerald-*`, `amber-*` raus. Stattdessen:
- Status als typografische Pill mit Klartext (kein Farbpunkt): „Bezahlt" `bg-foreground text-background`, „Offen" `bg-muted text-foreground`, „Menü offen" `bg-foreground/10 text-foreground` mit Outline.
- Akzentrot (`text-destructive`) **nur** für Überfälliges.
Dateien: alle drei Spalten + Heatmap.

---

### Welle 2 — Direktaktionen & Predictive Power (½ Tag)

**2.1 Swipe-/Hover-Aktionen pro Operation-Card**
Desktop-Hover: drei Inline-Buttons rechts (Erledigt · Verschieben · Notiz).
Mobile: Swipe-left → Erledigt; Swipe-right → Snooze 2h.
Setzt `status='completed'` bzw. neuen Reminder. Datei: `TodayOperationsColumn.tsx` + neue `useOperationActions.ts`.

**2.2 Outbox: einzelne Reminder pausieren / sofort senden**
Pro Reminder-Zeile: kleines Menü „Heute überspringen · Sofort senden · Verschieben". Schreibt in `inquiry_tasks.snoozed_until` bzw. triggert Send-Funktion.
Datei: `OutboxColumn.tsx` + Edge-Function-Aufruf bestehender Routen (keine neue Function).

**2.3 Inbox: 1-Klick-Trennung „Heute beantworten / Später"**
Jede Inbox-Zeile bekommt ein „Heute"-Toggle, das die Anfrage zu einer „Heute-zu-erledigen"-Liste hinzufügt (gespeichert in `inquiry_tasks` als persönlicher Task).
Datei: `InboxColumn.tsx`.

---

### Welle 3 — Visual Polish & Datendichte (½ Tag)

**3.1 Wochen-Heatmap → Sparkline + klickbare Tageskarten**
- Tagestiles werden klickbar → springen zur gefilterten Tagesansicht.
- Trend-Linie: aktuelle Woche vs. 4-Wochen-Schnitt (graue Vergleichslinie).
- KPI-Strip: „78% Auslastung · +12% vs. Vor-Woche · 11.300€ · 71% bezahlt".
- „Heute"-Tag mit fetter Foreground-Bar statt nur Border.
Datei: `WeekHeatmap.tsx`.

**3.2 Skeleton statt Spinner**
Drei-Spalten-Skeleton beim ersten Laden. Datei: `Dashboard.tsx`.

**3.3 Border-Diät**
- Spalten-Container haben **keinen** Outer-Border mehr — nur Whitespace + interne 1-px-Trennlinien.
- Operation-Cards: kein Border, sondern nur `bg-card` + `hover:bg-muted/40` + 1-px Bottom-Divider.
Effekt: ruhigere, modernere Optik (Linear-Stil).

**3.4 Typografische Anker**
- Spalten-H2: `text-base font-semibold` (kein uppercase) + kleine Caption darunter.
- Datums-H1: `text-3xl font-bold tracking-tight` (statt 2xl).
- Tabular-Nums überall für Zeiten und Geldbeträge bereits ✓.

**3.5 Tap-Targets ≥ 44 px**
Inbox-Buttons, Outbox-Items, Tab-Buttons auf min. 44 px Höhe (Mobile-Standard, Memory-Regel).

**3.6 Realtime via Supabase Channel (optional, ½ Tag extra)**
Statt 60-s-Poll → `postgres_changes`-Channel auf `event_inquiries`, `catering_orders`. Toast „Neue Anfrage von Müller" + Badge-Bump in Echtzeit.
Datei: `useDashboardData.ts`.

---

## Geänderte Dateien

| Datei | Welle | Aufgabe |
|---|---|---|
| `src/components/admin/refine/dashboard/NextUpHero.tsx` | 1 | **Neu** — „Jetzt"-Hero-Card |
| `src/components/admin/refine/Dashboard.tsx` | 1, 3 | Header personalisiert, Hero einbinden, Skeleton, Typografie |
| `src/components/admin/refine/dashboard/TodayOperationsColumn.tsx` | 1, 2, 3 | Echtes „Heute" + Toggle, Hover-Actions, Border-Diät, Mono-Status |
| `src/components/admin/refine/dashboard/InboxColumn.tsx` | 1, 2, 3 | „Heute"-Toggle, Mono, Tap-Targets |
| `src/components/admin/refine/dashboard/OutboxColumn.tsx` | 1, 2, 3 | Pause/Sofort-Send pro Reminder, Mono, Tageszeit-Icons |
| `src/components/admin/refine/dashboard/WeekHeatmap.tsx` | 3 | Sparkline, Klickbarkeit, Vergleich, Mono, „Heute"-Hervorhebung |
| `src/hooks/useOperationActions.ts` | 2 | **Neu** — Erledigt/Snooze-Mutations |
| `src/hooks/useDashboardData.ts` | 3 (opt) | Optional: Realtime-Channel |

**Keine** DB-Änderung. **Keine** neuen Edge-Functions. **Keine** Cron-Änderungen.

---

## Erwartetes Ergebnis

Beim Öffnen von `/admin` sieht der Betreiber sofort:
1. **Was als nächstes passiert** (Hero-Card, große Uhrzeit, ein-Tap-Aktionen)
2. **Wer ihn heute braucht** (gefiltertes Heute, klare Status-Pills, keine Farbverwirrung)
3. **Was das System ohne ihn tut** — und kann es **mit einem Klick steuern**
4. **Wie die Woche läuft im Vergleich** (Trend statt absolute Zahl)

**Empfehlung:** Welle 1 zuerst (höchster Wahrnehmungs-ROI), Welle 2 als Operations-Power-Up, Welle 3 als Polish. Realtime-Channel optional als Schluss.

