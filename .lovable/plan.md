

# Plan: Locked-Banner anpassen – Kein Gelb, besserer Button-Text

## Problem

1. **Farbgebung**: Das Banner verwendet Gelb/Amber-Töne (`amber-50`, `amber-200`, `amber-500`), was gegen die Design-Richtlinien verstößt
2. **Button-Text**: "Neue Version erstellen" ist missverständlich – es geht darum, ein neues Angebot zu erstellen

---

## Änderungen

### 1. Farben ersetzen (Amber → Neutral/Muted)

| Aktuell | Neu |
|---------|-----|
| `bg-amber-50/80` | `bg-muted/50` |
| `border-amber-200/60` | `border-border` |
| `bg-amber-500/10` | `bg-muted` |
| `text-amber-600` | `text-muted-foreground` |
| Lock-Icon gelb | Lock-Icon neutral |

### 2. Button-Text anpassen

| Aktuell | Neu |
|---------|-----|
| "Neue Version erstellen" | "Neues Angebot erstellen" |
| Beschreibungstext | "Die gesendete Konfiguration ist schreibgeschützt. Für Änderungen erstellen Sie ein neues Angebot." |

---

## Vorher → Nachher

```text
VORHER (gelb):
┌─────────────────────────────────────────────────────────────────┐
│ 🔒 Angebot v2 versendet              [ Neue Version erstellen ] │ ← Amber/Gelb
│ Antoine Monot • 30.01.26 um 23:32                               │
│ Die gesendete Konfiguration ist schreibgeschützt...             │
└─────────────────────────────────────────────────────────────────┘

NACHHER (neutral):
┌─────────────────────────────────────────────────────────────────┐
│ 🔒 Angebot v2 versendet           [ Neues Angebot erstellen ]   │ ← Grau/Neutral
│ Antoine Monot • 30.01.26 um 23:32                               │
│ Die gesendete Konfiguration ist schreibgeschützt...             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technische Änderungen

**Datei:** `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx`

Zeilen ~494-556: Locked-Banner-Styles und Text aktualisieren

```tsx
// Vorher:
className="... border-amber-200/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/40"
<div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
  <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />

// Nachher:
className="... border-border bg-muted/50"
<div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center">
  <Lock className="h-5 w-5 text-muted-foreground" />

// Button-Text:
// Vorher: "Neue Version erstellen"
// Nachher: "Neues Angebot erstellen"
```

---

## Zusammenfassung

- **Keine gelben Farben** mehr im Locked-Banner
- **Klarer Button-Text**: "Neues Angebot erstellen" 
- Konsistent mit dem restlichen Premium-UI-Design (neutral/grau)

