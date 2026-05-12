## Problem (verifiziert in der DB)

In `v2_events` sind `archived` (Boolean) und `archived_at` (Timestamp) inkonsistent:

- 34 von 34 Anfragen mit Status `inquiry` haben `archived_at IS NOT NULL`, aber `archived = false`
- 14 von 23 `offer_sent`, 5 von 6 `offer_draft` ebenso
- Resultat: Karten bleiben in "Neu/Bearbeitung/Angebot raus" sichtbar (Filter prüft nur `archived`), tragen aber das Label "ARCHIVIERT" (Label prüft `archived_at OR archived`)

Zusätzlich gibt es kein automatisches Verschwinden gebuchter Events nach dem Veranstaltungstermin und keinen klar getrennten Archiv-Bereich — das Archiv ist heute nur ein einklappbares Footer-Panel.

## Ziel

1. **Eine Wahrheit für Archiv**: `archived = true` ist die einzige Quelle. `archived_at` ist nur Zeitstempel.
2. **Eigener Archiv-Bereich**: Archivierte Anfragen tauchen nirgendwo in der regulären Liste/Kanban auf — nur unter dem Filter "Archiv".
3. **Auto-Erledigt nach Event**: Gebuchte/bezahlte Events werden ab dem Tag NACH dem Veranstaltungstermin automatisch in den Bereich "Erledigt" verschoben (eigener Tab, raus aus "Gebucht").

## Plan

### 1. Daten bereinigen (Migration)
- `UPDATE v2_events SET archived_at = NULL WHERE archived = false` — entfernt verwaiste Timestamps, die keine echte Archivierung sind
- Trigger/Insert-Pfad prüfen, der `archived_at` setzt ohne `archived = true` (vermutl. event_inquiries-Insert oder Email-Inbound). Quelle korrigieren, sodass künftig nur beides gemeinsam gesetzt wird.

### 2. Code: Single-Source-of-Truth `archived`
- `src/lib/inquiryActionState.ts`: Label "Archiviert" nur noch wenn `archived === true` (kein `|| archivedAt`).
- `mapV2Event` & Filter: konsequent nur `archived` nutzen.

### 3. Eigener Archiv-Bereich (UI)
- **Tabs/Filter** in `UnifiedInquiriesList.tsx` neu sortieren:
  - `Eingang` (lead/proposal/pending, nicht archiviert, Event in Zukunft oder ohne Datum)
  - `Gebucht` (won, Event ≥ heute)
  - `Erledigt` (won + Event < heute, oder Status `completed`) — NEU
  - `Archiv` (archived = true, oder declined/cancelled)
  - "Alle aktiven" → entfernen oder klar als "ohne Archiv & Erledigt" beschriften
- Im Kanban-Modus: Archiv-Footer-Panel entfällt. Stattdessen:
  - Pipeline (4 Spalten) zeigt nur Aktive (kein archiv, kein vergangenes Event)
  - Klick auf Tab "Archiv" / "Erledigt" → Kanban zeigt eigene Spalten-Aufteilung dieser Kategorie

### 4. Auto-Übergang nach Veranstaltungstermin
Frontend-derived (keine Cron nötig):
- Helper `isPastEvent(record)`: `record.date < heute` UND Status ∈ {paid, completed, offer_chosen}
- "Gebucht"-Filter: schließt `isPastEvent` aus
- "Erledigt"-Filter: schließt `isPastEvent` ein
- (Optional, separate Migration) nightly Cron, das `status = 'completed'` setzt, wenn `date < now() - 1 day`. Nicht im ersten Schritt nötig — Frontend-Derivation reicht visuell.

### 5. Archivieren-Aktion sauber
- Beim manuellen Archivieren immer `archived = true` UND `archived_at = now()` zusammen setzen (ist im Code bereits so — bleibt).
- Beim "Drag in lost"-Spalte: aktuell wird `archived = true` gesetzt — bleibt.

## Technische Details

Betroffene Dateien:
- `supabase/migrations/<neu>.sql` — `UPDATE v2_events SET archived_at = NULL WHERE archived = false`
- Insert-Trigger `event_inquiries_insert_trigger` / Email-Inbound-Funktion prüfen (wer setzt archived_at fälschlich?)
- `src/lib/inquiryActionState.ts`
- `src/components/admin/refine/UnifiedInquiriesList.tsx`
- `src/components/admin/refine/UnifiedKanbanView.tsx`
- `src/types/inquiryRecord.ts` (evtl. Helper `isPastEvent`)

## Offene Fragen

1. Sollen vergangene Gebuchte automatisch auf `status = 'completed'` gesetzt werden (nightly Cron), oder reicht die rein visuelle Umsortierung im Frontend?
2. "Alle aktiven"-Tab komplett entfernen oder behalten (ohne Archiv & Erledigt)?
