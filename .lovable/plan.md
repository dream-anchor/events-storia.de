

# Operatives Maestro-Dashboard — die digitale Pinnwand

## Diagnose des heutigen Stands

Das aktuelle Dashboard (`Dashboard.tsx`) ist eine **schöne Event-Timeline**, aber kein Operations-Cockpit:

- Zeigt nur `event_inquiries` — **keine Catering-Lieferungen**, **keine Event-Bookings**, **keine Group-Inquiries**
- Zeigt **Vergangenheit nicht** (Events werden bei `isBefore(today)` ausgeblendet) → Betreiber sieht nicht, was *gerade läuft*
- **Kein Reminder-Ausblick**: Es laufen 4 Cronjobs (`process-order-reminders` stündlich, `process-follow-up-tasks` 8 Uhr, `mark-overdue-event-payments` 9 Uhr, `cleanup-orphan-drafts` 4 Uhr) — der Betreiber sieht aber nirgends, **was als nächstes rausgeht**
- **Keine "Was steht an"-Sicht**: Keine Lieferzeit-Liste, keine Gäste-Summe pro Tag, keine Küchen-Vorbereitungs-Sicht
- **Keine Wochen-Übersicht** mit Anzahl/Volumen — nur einzelne Tage

---

## Vision: Die Pinnwand

Ein **dreispaltiges Hero-Layout** (Desktop) bzw. tab-basiert (Mobile), das beim Öffnen sofort sagt:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  HEUTE · Mittwoch, 23. April                          [Test-Modus] │
├──────────────────────┬──────────────────────┬───────────────────────┤
│  HEUTE LÄUFT         │  KOMMT REIN          │  GEHT RAUS            │
│  (Operations)        │  (Inbox)             │  (Outbox/Reminder)    │
│                      │                      │                       │
│  • 12:00 Müller GmbH │  • 2 neue Anfragen   │  Heute 18:00 → 3 Mails│
│    Catering, 25 P.   │    seit gestern      │  • Reminder Müller    │
│    📍 Schwabing      │  • 1 ohne Angebot    │  • Anzahlung Klein    │
│                      │    seit 5 Tagen      │  • Menü-Erinnerung Y. │
│  • 19:30 Eventmiete  │                      │                       │
│    Storia, 60 P.     │  ⚠ 2 überfällige    │  Morgen 08:00 → 1 Cron│
│    Bezahlt ✓         │    Zahlungen 1.240€  │  • Follow-up Task X   │
│                      │                      │                       │
├──────────────────────┴──────────────────────┴───────────────────────┤
│  WOCHE · 23.–29. April  ▸ 8 Events · 142 Gäste · 11.300€ · 71% bez. │
│  ────────────────────────────────────────────────────────────────── │
│  Mi  Do  Fr  Sa  So  Mo  Di    [Mini-Bars je Tag mit Auslastung]   │
│                                                                     │
│  AUSBLICK · 30. April – 6. Mai                                      │
│  ────────────────────────────────────────────────────────────────── │
│  3 Events · 45 Gäste · davon 1 Hochzeit ohne Menüfreigabe          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Konkrete Bausteine

### 1. **„Heute läuft" — Operations-Spalte**
Zeigt **Catering-Lieferungen + Event-Bookings + Event-Inquiries** des heutigen Tages, sortiert nach Uhrzeit. Pro Karte:
- Uhrzeit groß, Kunde, Personenanzahl
- Typ-Chip (`Catering` / `Event` / `Lieferung` / `Abholung`)
- Adresse mit Maps-Deeplink (1 Tap → Navigation)
- Telefon-Deeplink (1 Tap → Anruf)
- Status-Ampel: bezahlt / Anzahlung offen / Menü unbestätigt
- **„Erledigt"-Swipe** → setzt `status = completed`

### 2. **„Kommt rein" — Inbox-Spalte**
Aggregiert **alle neuen Eingänge der letzten 48h**: Event-Anfragen + Catering-Bestellungen + Group-Inquiries. Plus:
- Stale-Liste (Anfrage > 5 Tage ohne Angebot)
- Überfällige Zahlungen (aus `event_payments_enriched`)
- Konvertierungsrate-Mini ("3 von 5 Anfragen → Buchung")

### 3. **„Geht raus" — Reminder-Ausblick (NEU)**
Zeigt eine **Vorschau** dessen, was die Cronjobs in den nächsten 24h verschicken werden. Wir lesen:
- `inquiry_tasks` mit `due_date <= today + 1d` und `reminder_sent = false` → "Heute 08:00: Follow-up X"
- `catering_orders` mit `desired_date = today + 2` → "Heute 00:30: Lieferungserinnerung an Küche"
- `event_payments` mit `status='sent'` und `due_date <= today` → "Heute 09:00: 2 Zahlungen werden auf 'überfällig' gesetzt"
- Letzte 7 Tage **versendete** Reminder aus `email_delivery_logs` (Klappauf "Bereits raus")

→ Dies ist der **Mehrwert**: Betreiber sieht erstmals proaktiv, **welche automatisierten E-Mails an wen rausgehen** und kann bei Bedarf vorher eingreifen oder Tasks verschieben.

### 4. **„Diese Woche" — Heatmap-Streifen**
Sieben kompakte Tages-Tiles (Heute → +6) mit:
- Datum / Wochentag
- Anzahl Events + Catering + Group-Bookings (gestapelt als kleiner Bar)
- Gäste-Summe
- Volumen in €
- Klick → springt zum Tag in der Detail-Timeline

### 5. **„Ausblick nächste Woche"**
Kollabiert. Klein. Eine Zeile mit Summary + Risiken (z.B. "1 Hochzeit ohne Menübestätigung").

### 6. **Mobile**
- Statt 3 Spalten: **Tab-Bar** unten mit den drei Modi (`Heute · Inbox · Outbox`) + 4. Tab `Woche`
- Pull-to-refresh
- Heutige Lieferungen als swipebare Karten (Erledigt/Verschieben)

---

## Technik-Plan (knapp)

| Datei | Änderung |
|---|---|
| `src/components/admin/refine/Dashboard.tsx` | Komplettes Redesign in dreispaltiges Cockpit-Layout |
| `src/components/admin/refine/dashboard/TodayOperationsColumn.tsx` | **Neu** — vereint Catering + Bookings + Inquiries des Tages |
| `src/components/admin/refine/dashboard/InboxColumn.tsx` | **Neu** — neue Anfragen + stale + überfällig |
| `src/components/admin/refine/dashboard/OutboxColumn.tsx` | **Neu** — Reminder-Ausblick (das eigentliche Highlight) |
| `src/components/admin/refine/dashboard/WeekHeatmap.tsx` | **Neu** — 7-Tage-Streifen + Klick-Navigation |
| `src/components/admin/refine/dashboard/NextWeekOutlook.tsx` | **Neu** — kollabierte Vorschau Woche +2 |
| `src/hooks/useDashboardData.ts` | **Neu** — ein zentraler Hook, der alle Quellen parallel lädt + alle 60s revalidiert (`refetchInterval`) |
| `src/hooks/useUpcomingReminders.ts` | **Neu** — liest `inquiry_tasks`, `event_payments`, `catering_orders` und ermittelt geplante Cron-Aktionen |

**Keine** DB-Änderung nötig. **Keine** neuen Edge-Functions. **Keine** Cron-Änderungen — wir lesen nur, was die Cronjobs sowieso tun werden.

---

## Was 2026-State-of-the-Art ausmacht (UX-Prinzipien)

- **Glanceable**: Beim Öffnen sofort die drei Fragen beantworten: *Was läuft heute? Was muss ich entscheiden? Was passiert ohne mich?*
- **Realtime-Refresh** alle 60s ohne Page-Reload (`refetchInterval`)
- **Direktaktionen** (Anrufen, Navigieren, Erledigt) ohne Detail-Drill
- **Predictive UI**: Reminder-Vorschau zeigt *bevor* die Mail rausgeht, nicht erst nach (Notion/Linear-Pattern)
- **Monochrom + Akzentrot** nur bei Überfälligem (gemäß Memory)
- **Keine Floating Buttons** — primäre Aktion bleibt im AdminLayout-Header (`Neue Anfrage`)
- **Mobile-Tabbed**, Desktop-Triptychon — gleiche Daten, unterschiedlicher Lese-Flow

---

## Erwartetes Ergebnis

Beim Öffnen von `/admin` weiß der Betreiber binnen 3 Sekunden:
1. **Was er heute koordinieren muss** (Lieferungen, Anrufe, Vorbereitung)
2. **Was sich seit gestern an Eingängen angesammelt hat**
3. **Was das System heute automatisch verschicken wird** — und kann eingreifen
4. **Wie die Woche aussieht** (Volumen, Auslastung, Risiken)

Aufwand: ~1 Tag Implementation, monolithisch in einem Sprint.

