
# Plan: Gesendete Versionen korrekt anzeigen – History als Wahrheitsquelle

## Problem

Die aktuelle Logik:
```text
wasSent = Boolean(inquiry.offer_sent_at)
```

Das ist **falsch**, weil `offer_sent_at` auf NULL gesetzt wird, wenn ein neues Angebot erstellt wird (Unlock-Flow). Aber Version 2 wurde definitiv gesendet – das steht in der History!

**Datenbank aktuell:**
```text
event_inquiries:
  offer_sent_at = NULL (weil V3 "in Arbeit")
  current_offer_version = 3

inquiry_offer_history:
  version 2 → sent_at: 30.01.26 22:32 UTC (= 23:32 CET)
```

---

## Lösung: Zwei separate Status unterscheiden

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. AKTUELLE VERSION GESPERRT?                                   │
│    → isLocked = offer_sent_at != null                           │
│    → Wenn JA: Locked-Banner zeigen                              │
│                                                                 │
│ 2. WURDE JEMALS ETWAS GESENDET?                                 │
│    → hasSentHistory = history.length > 0                        │
│    → Die History enthält ALLE gesendeten Versionen              │
│                                                                 │
│ 3. ENTWURF-BANNER LOGIK:                                        │
│    → Zeige nur wenn: email_draft UND keine aktuelle Sperre      │
│    → Text: "Anschreiben gesendet" wenn history[0] existiert     │
│           (und current_version > sent_version)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Konkrete Änderungen

### 1. Draft-Banner Logik korrigieren (MultiOfferComposer.tsx)

**Vorher (Zeile 61):**
```typescript
const wasSent = Boolean(inquiry.offer_sent_at);
```

**Nachher:**
```typescript
// Check if the CURRENT version was sent (locked)
const currentVersionSent = Boolean(inquiry.offer_sent_at);

// Check if ANY version was ever sent (from history)
const lastSentVersion = history.length > 0 ? history[0] : null;
const hasEverBeenSent = lastSentVersion !== null;
```

### 2. Banner-Anzeige anpassen

**Szenario: V2 gesendet, V3 in Arbeit**
```text
┌─────────────────────────────────────────────────────────────────┐
│ ✓ Anschreiben gesendet                               v2        │
│ @ Antoine Monot  ⌚ 30.01.26 um 23:32                            │
│                                                                 │
│ (Eine neue Version v3 ist in Arbeit)                            │
└─────────────────────────────────────────────────────────────────┘
```

- **Titel:** "Anschreiben gesendet" (nicht "Entwurf")
- **Badge:** Die gesendete Version (v2), nicht die aktuelle (v3)
- **Timestamp:** Aus `history[0].sent_at` (die echte Sendezeit)
- **Sender:** Aus `history[0].sent_by`

### 3. Datenbank-Korrektur für diese Anfrage

Da Version 2 gesendet wurde, aber die UI das nicht zeigt, muss ich die History als Quelle nutzen:

```sql
-- Keine DB-Änderung nötig!
-- Die Lösung liest aus inquiry_offer_history statt event_inquiries
```

---

## Code-Änderungen im Detail

### Datei: `MultiOfferComposer.tsx`

**A) Zeile 59-62 ersetzen:**
```typescript
// OLD:
const hasSavedDraft = Boolean(inquiry.email_draft);
const wasSent = Boolean(inquiry.offer_sent_at);

// NEW:
const hasSavedDraft = Boolean(inquiry.email_draft);
// The current version is locked if offer_sent_at is set
const currentVersionLocked = Boolean(inquiry.offer_sent_at);
// Check history for the last actually sent version
const lastSentEntry = history.length > 0 ? history[0] : null;
// Was ANY version ever sent?
const hasBeenSentBefore = lastSentEntry !== null;
```

**B) Draft-Banner (Zeile 594-700) aktualisieren:**

Banner sollte zeigen:
- "Anschreiben gesendet" wenn `hasBeenSentBefore` (aus History)
- Timestamp aus `lastSentEntry.sentAt` (nicht `inquiry.offer_sent_at`)
- Sender aus `lastSentEntry.sentBy` (nicht `inquiry.offer_sent_by`)
- Badge zeigt `lastSentEntry.version` (die gesendete Version)

**C) Zusätzlich: Hinweis wenn neue Version in Arbeit**

Wenn `hasBeenSentBefore` aber `!currentVersionLocked`, zeigen wir:
```text
"(Version X in Bearbeitung – noch nicht gesendet)"
```

---

## Vorher → Nachher (Screenshot-Fall)

```text
VORHER (falsch):
┌─────────────────────────────────────────────────────────────────┐
│ ✉ Anschreiben-Entwurf vorhanden                        v3      │
│ @ Antoine Monot  ⌚ 31.01.26 um 00:34                            │
└─────────────────────────────────────────────────────────────────┘

NACHHER (korrekt):
┌─────────────────────────────────────────────────────────────────┐
│ ✓ Anschreiben gesendet                                  v2     │
│ @ Antoine Monot  ⌚ 30.01.26 um 23:32                            │
│                                                                 │
│ Version 3 in Bearbeitung                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `MultiOfferComposer.tsx` | Draft-Banner Logik auf History umstellen |

---

## Zusammenfassung

- **History ist die Wahrheitsquelle** für gesendete Versionen
- **Entwurf ≠ Gesendet:** Wir unterscheiden klar zwischen beiden Zuständen
- **Korrekte Timestamps:** Immer aus `sent_at` in der History
- **Korrekte Version:** Die gesendete Version wird angezeigt, nicht die aktuelle
