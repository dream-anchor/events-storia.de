

# Plan: Versendete Angebote korrekt in der Übersicht anzeigen

## Problem

Wenn ein Angebot gesendet wurde, wird es nicht unter "Angebot versendet" angezeigt. Das liegt daran, dass:

1. **Unlock-Logik setzt offer_sent_at auf NULL**: Beim Klick auf "Neues Angebot erstellen" wird `offer_sent_at` zurückgesetzt, damit die aktuelle Version bearbeitet werden kann
2. **Filter prüft nur offer_sent_at**: Dashboard und EventsList kategorisieren Anfragen anhand von `offer_sent_at`, nicht anhand der Historie
3. **Status wird nicht aktualisiert**: Der `status` bleibt auf 'new' statt 'offer_sent'

```text
Aktuelle Daten im Test-Fall:
┌──────────────────────────────────────────────────────────────┐
│ event_inquiries (ID: 7c7ca1cf...)                           │
│   status = 'new'            ← Falsch! Sollte 'offer_sent'   │
│   offer_sent_at = NULL      ← Weil V3 in Arbeit             │
│   current_offer_version = 3                                  │
├──────────────────────────────────────────────────────────────┤
│ inquiry_offer_history                                        │
│   version 2 → sent_at: 30.01.26 22:32 ✓                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Lösung

### 1. Historie als Wahrheitsquelle für Kategorisierung

Die Filterlogik muss prüfen, ob jemals ein Angebot gesendet wurde – unabhängig davon, ob gerade eine neue Version bearbeitet wird.

```text
VORHER (falsch):
offerSent = status === 'offer_sent' || offer_sent_at

NACHHER (korrekt):
offerSent = status === 'offer_sent' 
         || offer_sent_at 
         || history_count > 0   ← NEU
```

**Technische Umsetzung:**
- Neues Feld `has_sent_offer` als berechnete Spalte oder
- Join mit `inquiry_offer_history` um zu prüfen, ob Einträge existieren

### 2. Unlock setzt Status auf 'offer_sent' statt 'new'

Wenn bereits ein Angebot gesendet wurde, soll der Status `'offer_sent'` bleiben – nicht auf 'new' zurückfallen.

```text
useMultiOfferState.ts → unlockForNewVersion():

VORHER:
  offer_sent_at: null,      ← Entfernt nur den Lock
  offer_sent_by: null,

NACHHER:
  offer_sent_at: null,
  offer_sent_by: null,
  status: 'offer_sent',     ← Status bleibt 'offer_sent'
```

### 3. Bestehende Daten reparieren (einmalig)

Alle Anfragen, die Einträge in `inquiry_offer_history` haben, aber nicht als `'offer_sent'` markiert sind, werden automatisch korrigiert:

```sql
UPDATE event_inquiries e
SET status = 'offer_sent'
WHERE status NOT IN ('confirmed', 'declined')
AND EXISTS (
  SELECT 1 FROM inquiry_offer_history h
  WHERE h.inquiry_id = e.id
);
```

---

## Technische Änderungen

### A. Dashboard.tsx und EventsList.tsx

Die Kategorisierung muss auf den `status` vertrauen können. Da wir den Status korrekt setzen, reicht:

```typescript
// VORHER (unzuverlässig):
const offerSent = events.filter(e => 
  (e.status === 'offer_sent' || e.offer_sent_at) && ...
);

// NACHHER (verlässt sich auf korrekten Status):
const offerSent = events.filter(e => 
  e.status === 'offer_sent' && 
  e.status !== 'confirmed' && 
  e.status !== 'declined'
);
```

### B. useMultiOfferState.ts → unlockForNewVersion()

Status nicht ändern, wenn bereits gesendet:

```typescript
await supabase
  .from("event_inquiries")
  .update({ 
    offer_sent_at: null,
    offer_sent_by: null,
    current_offer_version: newVersion,
    // status bleibt 'offer_sent' → wird NICHT auf 'new' zurückgesetzt
  })
  .eq("id", inquiryId);
```

### C. Datenbank-Migration

Einmalige Korrektur aller inkonsistenten Einträge:

```sql
-- Repariere alle Anfragen mit gesendeter Historie
UPDATE event_inquiries
SET status = 'offer_sent'
WHERE status NOT IN ('confirmed', 'declined')
AND id IN (
  SELECT DISTINCT inquiry_id FROM inquiry_offer_history
);
```

---

## Ergebnis

```text
VORHER:                              NACHHER:
┌─────────────────┬─────────────┐    ┌─────────────────┬─────────────┐
│ In Bearbeitung  │ Versendet   │    │ In Bearbeitung  │ Versendet   │
├─────────────────┼─────────────┤    ├─────────────────┼─────────────┤
│ Test3 (falsch!) │ (leer)      │    │ (andere...)     │ Test3 ✓     │
│ Test GmbH       │             │    │                 │ • v2        │
└─────────────────┴─────────────┘    │                 │ • 30.01.26  │
                                     └─────────────────┴─────────────┘
```

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/admin/refine/Dashboard.tsx` | Filterlogik vereinfachen auf `status === 'offer_sent'` |
| `src/components/admin/refine/EventsList.tsx` | Filterlogik vereinfachen auf `status === 'offer_sent'` |
| `src/components/admin/refine/InquiryEditor/MultiOffer/useMultiOfferState.ts` | Unlock setzt Status nicht zurück |
| **DB Migration** | Korrektur bestehender Anfragen mit Historie |

---

## Zusammenfassung

- **Status ist die Wahrheitsquelle**: Einmal gesendet = `status: 'offer_sent'`
- **offer_sent_at nur für Lock-Zustand**: Zeigt an, ob die aktuelle Version gesperrt ist
- **Automatische Reparatur**: Bestehende Daten werden einmalig korrigiert
- **Konsistente UI**: "Angebot versendet" zeigt alle Anfragen, bei denen mindestens eine Version gesendet wurde

