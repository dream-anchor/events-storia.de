

# Plan: Versendete Menüs unveränderlich machen

## Problem

Nach dem Versand eines Angebots kann das Menü noch bearbeitet werden. Das ist falsch:

```text
AKTUELL (falsch):
┌─────────────────────────────────────────────────────────────────┐
│ Option A: Business Dinner                                       │
│ Menü: Carpaccio, Risotto, Tiramisu         [Menü anpassen] ← ⚠️│
│                                                                 │
│ Diese Option wurde in v2 gesendet – sollte NICHT mehr          │
│ bearbeitbar sein!                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Geschäftslogik:**
- Ein bereits versendetes Menü darf **niemals** geändert werden
- Bei Änderungswunsch muss eine **neue Option hinzugefügt** werden
- Alte Optionen bleiben als Dokumentation erhalten (was wurde dem Kunden gesendet?)

---

## Lösung

### Konzept: Optionen tragen ihre eigene "gesperrt"-Info

Jede Option speichert, in welcher Version sie erstellt wurde. Wenn diese Version bereits gesendet wurde, ist die Option dauerhaft gesperrt.

```text
┌─────────────────────────────────────────────────────────────────┐
│ Option A: Business Dinner (v2 – gesendet)          🔒 Gesperrt  │
│ Menü: Carpaccio, Risotto, Tiramisu                              │
│                                                                 │
│ [Keine Bearbeitung möglich]                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Option B: Aperitivo (v3 – in Bearbeitung)               Aktiv   │
│ Menü: noch nicht konfiguriert              [Menü konfigurieren] │
│                                                                 │
│ [Neu hinzugefügt – bearbeitbar]                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technische Änderungen

### 1. OfferOption erhält `createdInVersion`

**Datei:** `types.ts`

```typescript
export interface OfferOption {
  // ... bestehende Felder
  offerVersion: number;        // In welcher Version gespeichert
  createdInVersion?: number;   // NEU: In welcher Version erstellt
}
```

### 2. Lock-Logik pro Option

**Datei:** `OfferOptionCard.tsx`

Die `isLocked`-Prop wird nicht mehr global gesetzt, sondern pro Option berechnet:

```typescript
// Eine Option ist gesperrt, wenn sie in einer bereits gesendeten Version erstellt wurde
const optionIsLocked = useMemo(() => {
  // Prüfe ob die Version, in der diese Option erstellt wurde, bereits gesendet wurde
  // (existiert in der History)
  if (!option.createdInVersion) return false;
  
  // Finde in der History, ob diese Version gesendet wurde
  return history.some(h => h.version >= option.createdInVersion);
}, [option.createdInVersion, history]);
```

### 3. Neue Optionen erhalten aktuelle Version

**Datei:** `useMultiOfferState.ts`

Beim Hinzufügen einer neuen Option:

```typescript
const addOption = useCallback(() => {
  // ...
  setOptions(prev => [...prev, {
    id: crypto.randomUUID(),
    ...createEmptyOption(nextLabel, guestCount),
    createdInVersion: currentVersion,  // NEU: Merken, in welcher Version erstellt
  }]);
}, [options, guestCount, currentVersion]);
```

### 4. MultiOfferComposer übergibt History an OptionCard

**Datei:** `MultiOfferComposer.tsx`

```typescript
<OfferOptionCard
  // ...
  history={history}  // NEU: Für Lock-Berechnung
  isLocked={...}     // Wird pro Option berechnet
/>
```

### 5. UI-Feedback für gesperrte Optionen

**Datei:** `OfferOptionCard.tsx`

```typescript
{optionIsLocked && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Lock className="h-4 w-4" />
    <span>Gesendet in v{option.createdInVersion} – nicht änderbar</span>
  </div>
)}
```

---

## Workflow nach Änderung

```text
1. Option A erstellt (v1)
2. Option A konfiguriert
3. Angebot v1 gesendet
   → Option A ist jetzt dauerhaft gesperrt
   
4. "Neues Angebot erstellen" geklickt → v2 startet
5. Option A kann NICHT bearbeitet werden (v1 gesendet)
6. Neue Option B hinzugefügt (v2)
   → Option B ist bearbeitbar (v2 noch nicht gesendet)
   
7. Angebot v2 gesendet
   → Option A bleibt gesperrt
   → Option B ist jetzt auch gesperrt
```

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `types.ts` | `createdInVersion` zu OfferOption hinzufügen |
| `useMultiOfferState.ts` | `createdInVersion` beim Erstellen setzen |
| `OfferOptionCard.tsx` | Lock-Logik pro Option, UI-Feedback |
| `MultiOfferComposer.tsx` | History an OptionCard übergeben |
| **DB Migration** | `created_in_version` Spalte zu `inquiry_offer_options` |

---

## Migration bestehender Daten

Optionen, die bereits in einer gesendeten Version waren, erhalten `created_in_version = 1`:

```sql
-- Setze created_in_version für existierende Optionen
UPDATE inquiry_offer_options o
SET created_in_version = COALESCE(
  (SELECT MIN(h.version) FROM inquiry_offer_history h WHERE h.inquiry_id = o.inquiry_id),
  o.offer_version
);
```

---

## Zusammenfassung

- **Gesendete Optionen sind unveränderlich** – keine Bearbeitung möglich
- **Neue Optionen können hinzugefügt werden** – für Änderungswünsche
- **Klare visuelle Unterscheidung** – gesperrt vs. bearbeitbar
- **History als Wahrheitsquelle** – bestimmt, was gesendet wurde

