## Diagnose: Warum der Posteingang heute verwirrt

Der Posteingang ist ein **Triage-Werkzeug**: Mails, die **nicht automatisch einer Anfrage zugeordnet** werden konnten (weil Absender/Subject nicht matchen), landen hier und müssen manuell oder per KI einer Anfrage zugewiesen werden. Heute scheitert er an drei Dingen:

1. **4 Tabs auf einer Ebene** (Offen / Ignoriert / Geblockte Absender / Entwürfe) — drei davon sind Sonderfälle, nur „Offen" ist die eigentliche Arbeit.
2. **Aktions-Overload**: KI-Vorschlag annehmen · Zuordnen · Neu anlegen · Ignorieren · Filter mit Vorschlag · KI-Vorschläge erstellen — sechs Knöpfe, ohne klare Hierarchie.
3. **Counter ≠ Liste-Bug**: `useUnassignedInboxCount` zählt mit `count: exact, head: true` direkt auf dem View `unassigned_inbox_emails` und liefert z. B. 476 — die Liste zieht aber dieselbe Quelle mit `select(...).limit(500)` und zeigt 0. Wenn Counter und Liste auseinanderlaufen, verliert man jegliches Vertrauen.

**Library-Frage ehrlich beantwortet**: Es gibt keine fertige React-Library, die genau diesen Triage-Use-Case abbildet (Mail → CRM-Anfrage). Die saubere Lösung ist ein 3-Spalten-Layout aus Komponenten, die wir bereits haben:

- `@/components/ui/resizable` (shadcn / react-resizable-panels) — fürs Mail-App-Gefühl
- `cmdk` (bereits installiert via shadcn `Command`) — für blitzschnelle Anfrage-Suche
- `@chatscope/chat-ui-kit-react` (bereits in `MailClient` benutzt) — falls wir den Reading-Pane-Stil aus der Anfrage-Detailansicht spiegeln wollen

Kein neues npm-Paket nötig.

## Ziel-UX (Gmail-artig, 3 Spalten)

```text
 ┌──────────────┬────────────────────┬─────────────────────────────┐
 │  FOLDERS     │  MAIL-LISTE        │  MAIL-DETAIL                │
 │              │                    │                             │
 │  📥 Offen 12 │  ┌──────────────┐  │  Anna Müller                │
 │  ⏸  Ignor.   │  │ ● Anna M.    │  │  anna@…                     │
 │  🚫 Blockiert│  │   Hochzeit … │  │  Betreff: Hochzeit Anfrage  │
 │  ✏️ Entwürfe │  │   vor 2 Std. │  │  ─────────────────────────  │
 │              │  │ 🪄 → ANF-238 │  │  [ Mail-HTML ]              │
 │  ─────────   │  └──────────────┘  │                             │
 │  KI-Status   │  ┌──────────────┐  │  ─────────────────────────  │
 │  🪄 Neue     │  │   Lukas K.   │  │  💡 Vorschlag (KI)          │
 │     Vorschl. │  │   Re: Menü…  │  │  → Anfrage ANF-238          │
 │     erzeugen │  │   gestern    │  │     Anna Müller · 14.06.    │
 │              │  └──────────────┘  │  [ ✓ Zuordnen ] [ Anders ]  │
 └──────────────┴────────────────────┴─────────────────────────────┘
```

### Linke Spalte: Folder-Liste (statt Tab-Reihe)
- **Offen** (Default, mit Counter)
- **Ignoriert**
- **Geblockte Absender**
- **Entwürfe**
- darunter dezente **KI-Aktion** „Vorschläge für offene Mails erzeugen" mit Status (X analysiert / Y offen)

→ Macht sofort klar: nur „Offen" ist tägliche Arbeit, der Rest sind Archive.

### Mitte: Mail-Liste
- Pro Mail: Avatar/Initialen · Absender · Betreff · Zeit · **eine** klare Vorschlags-Zeile, falls vorhanden:
  - 🪄 `→ ANF-238 · Anna Müller · 14.06.` (grün/neutral je nach Confidence — laut Memory aber **monochrom**, also nur Hover-Hint statt Farbe)
- Kein „Filter mit Vorschlag"-Toggle mehr — stattdessen sind Mails mit Vorschlag automatisch oben sortiert (ist heute schon so) und visuell durch das 🪄-Chip kenntlich.

### Rechts: Detail mit **einer** Primäraktion
Der zentrale Konzept-Wechsel: Statt 4 gleichberechtigter Buttons gibt es **immer genau einen empfohlenen nächsten Schritt**, abgeleitet aus dem KI-Vorschlag:

| KI-Kategorie    | Primäraktion (1 Klick)                     | Sekundäraktion              |
|-----------------|--------------------------------------------|-----------------------------|
| `match`         | **„Zu ANF-238 zuordnen"**                  | „Anders zuordnen…"          |
| `new_inquiry`   | **„Neue Anfrage anlegen"**                 | „Doch zu existierender…"    |
| `irrelevant`    | **„Ignorieren"**                           | „Doch zu Anfrage zuordnen…" |
| `unclear` / kein Vorschlag | **„Anfrage suchen…"** (öffnet cmdk-Palette) | „Neu anlegen", „Ignorieren" |

→ „Sehr direkt: 1 Klick" wie gewünscht. Confidence-Badges (high/medium/low) werden entfernt; Begründung steht nur als kleiner Tooltip unter dem Vorschlag (nicht im Hauptflow).

### „Anders zuordnen" / „Anfrage suchen" — cmdk-Palette
Statt des heutigen schweren Dialogs mit Radio-Buttons (with_filter / single):
- `Cmd/Strg+K` oder Klick öffnet eine `Command`-Palette
- Tippst du, durchsuchst du Anfragen (Nummer, Kunde, E-Mail, Datum, Anlass)
- Auto-Vorschlag oben (heutige `loadSuggestion`-Logik)
- Enter = zuordnen. Filter-Modus „with_filter vs. single" wandert in einen kleinen Toggle **unter** dem Suchfeld mit Klartext-Erklärung („Auch zukünftige Mails dieses Absenders an diese Anfrage anhängen") — Default `with_filter`, bei `multiple_open_events`-Konflikt fragen wir wie heute nach.

### Tastatur (sichtbar im Footer der linken Spalte)
- `j` / `k` Mail wechseln
- `Enter` Primäraktion ausführen
- `Cmd+K` Anfrage suchen
- `e` Ignorieren

## Bugs, die im Zuge gefixt werden

1. **Counter-vs-Liste-Mismatch**: `useUnassignedInboxCount` durch `select("id", { count: "exact" }).limit(1)` ersetzen (kein `head: true` auf View — das umgeht Filter/RLS unzuverlässig). Alternativ: Counter aus `useUnassignedInbox().data?.length` ableiten — eine Quelle, eine Zahl.
2. **Auto-Selection bricht beim Filter-Wechsel**: Wenn die selektierte Mail aus dem View fällt, springt heute der Detail-Bereich auf „leer". Logik so anpassen, dass automatisch die nächste Mail in der Liste selektiert wird.
3. **`runBulkSuggest` Toast** ist sehr technisch — entschärfen auf „12 Mails analysiert · 8 Vorschläge bereit".

## Was unangetastet bleibt

- DB-Schema, Edge Functions (`assign-inbox-email-to-event`, `bulk-suggest-mappings`, `ignore-inbox-email`, `unarchive-email-globally`).
- KI-Logik & Kategorien — nur die Darstellung wird vereinfacht.
- Realtime-Subscriptions auf `inbox_emails` / `event_email_links`.
- Drafts-View und Blocklist-View — übernehmen wir 1:1, nur als Folder statt Tab.

## Technische Umsetzung

- **Refactor `src/pages/admin/Posteingang.tsx`** in einen Container + drei Subkomponenten:
  - `PosteingangFolders.tsx` (linke Spalte)
  - `PosteingangList.tsx` (mittlere Spalte)
  - `PosteingangDetail.tsx` (rechte Spalte) — übernimmt heutige `MailDetail`-Logik, aber mit der neuen Primary/Secondary-Action-Struktur
- 3-Spalten-Layout via `<ResizablePanelGroup direction="horizontal">` mit Default-Sizes 18/32/50.
- Neue `AssignCommandPalette.tsx` auf Basis von `@/components/ui/command` ersetzt den bisherigen `AssignDialog` (dieser bleibt als Fallback erhalten oder wird gelöscht).
- `IgnoreDialog`, `CreateInquiryDialog`, Conflict-Dialog `multiple_open_events` bleiben als kleine Modals erhalten — sie sind selten genug, dass ein Modal okay ist.
- Counter-Hook `useUnassignedInboxCount` umstellen.
- Mobile-Fallback: unterhalb `md:` zeigen wir nur Liste oder Detail (Routing per State), Folder-Liste als `Sheet` aus dem Header.

## Was ich von dir noch brauche

Falls du absegnest, baue ich das in einem Schritt um. Ein Punkt, den ich explizit fragen muss, weil er Datenfluss berührt:

- **Soll der „with_filter"-Toggle (Auto-Anhängen zukünftiger Mails an dieselbe Anfrage) Default an oder aus sein?** Heute: an. Ich würde ihn an lassen — er ist der Hauptgrund, warum wir das Tool überhaupt brauchen.
