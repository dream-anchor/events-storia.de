## Problem

Im Posteingang stehen oben rechts zwei Buttons direkt nebeneinander:

- **Nur Vorschläge** (Toggle, filtert die Liste auf Mails mit AI-Vorschlag)
- **Vorschläge generieren** (Aktion, ruft `bulk-suggest-mappings` für alle offenen Mails ohne Vorschlag auf)

Die Begriffe klingen fast identisch, der Unterschied (Filter vs. Aktion) ist nicht sichtbar. Es gibt keine Tooltips, keine Erklärung, keine visuelle Trennung.

## Ziel

Auf den ersten Blick erkennbar machen, was jeder Button tut — ohne neue Funktionalität.

## Änderungen (nur `src/pages/admin/Posteingang.tsx`, UI-only)

### 1. Klarere Labels + Icons

| Alt | Neu | Rolle |
|---|---|---|
| `✨ Nur Vorschläge` | `✨ Filter: mit Vorschlag` (Toggle, mit aktivem/inaktivem State sichtbar) | Filter |
| `↻ Vorschläge generieren` | `✨ KI-Vorschläge erstellen` mit Sublabel-Counter `(N offen)` | Aktion |

Der Counter zeigt, wie viele Mails ohne Vorschlag aktuell offen sind — macht die Aktion greifbar ("ich starte etwas für N Mails").

### 2. Visuelle Trennung

- Filter-Button bleibt links, in einer eigenen Gruppe.
- Aktions-Button rechts, mit `variant="default"` (oder `secondary`) statt `outline`, separiert durch einen vertikalen Divider (`<div className="h-6 w-px bg-border" />`).
- Filter-Button bekommt `aria-pressed` und einen klaren aktiven Zustand (Badge "aktiv" oder gefüllter Hintergrund).

### 3. Tooltips (shadcn `Tooltip`)

- Filter: "Zeigt nur Mails, für die bereits ein KI-Vorschlag existiert."
- Aktion: "Lässt die KI für alle offenen Mails ohne Vorschlag eine Zuordnung berechnen. Ändert nichts automatisch."

### 4. Während Bulk-Run

Aktions-Button zeigt während `bulkBusy`: `KI analysiert … (X / Y)` falls Fortschritt verfügbar, sonst nur Spinner + "KI analysiert …". Disabled bleibt.

### 5. Leere/Edge States

- Wenn 0 Mails ohne Vorschlag offen sind → Aktions-Button disabled mit Tooltip "Alle offenen Mails haben bereits einen Vorschlag".
- Wenn 0 Vorschläge existieren und Filter aktiv → Liste zeigt Empty-State "Noch keine Vorschläge — klicke 'KI-Vorschläge erstellen'".

### Out of scope

- Logik von `runBulkSuggest`, `onlySuggestions`, der Edge Function bleibt unverändert.
- Keine Schema- oder Backend-Änderungen.
