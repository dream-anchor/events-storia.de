
# Plan: Checkout-Farbschema – Warm & Einladend statt Kalt-Grau

## Problem-Analyse

Die aktuellen Anthrazit-Farben (`gray-800`) wirken im Checkout:
- **Kalt und distanziert** – keine emotionale Verbindung
- **Technisch** – wie ein Enterprise-Formular
- **Nicht zum Marken-Feeling passend** – STORIA ist warm, italienisch, einladend

Das Brand-Design nutzt warme Erdtöne (HSL 25° = warm beige/terracotta).

---

## Neue Farbstrategie: "Warm Italian Checkout"

```text
┌─────────────────────────────────────────────────────────────┐
│              CHECKOUT FARBPALETTE 2026                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WARM ESPRESSO (Primary Action Buttons)                     │
│  ├── bg-amber-900        → #78350f (dunkles Kaffee-Braun)  │
│  ├── hover:bg-amber-800  → Aufhellen beim Hover            │
│  └── text-amber-50       → Heller Cremeton                 │
│                                                              │
│  GOLDENER CTA (Zahlungspflichtig bestellen)                 │
│  ├── bg-amber-500        → Bleibt! (Positiv, einladend)    │
│  └── text-amber-950      → Dunkler Text für Kontrast       │
│                                                              │
│  WARMES TERRACOTTA (Akzente, aktiver Ring)                  │
│  ├── ring-amber-400/30   → Subtiler warmer Glow            │
│  ├── text-amber-800      → Links, "Bearbeiten"             │
│  └── border-amber-200    → Aktive Zustände                 │
│                                                              │
│  GRÜN (Erfolg – bleibt!)                                    │
│  ├── bg-green-100        → Abgeschlossene Schritte         │
│  └── text-green-600      → Checkmarks                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Visueller Vergleich

```text
┌─────────────────────────────────────────────────────────────┐
│                    AKTUELL (Kalt-Grau)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ▓▓▓▓▓▓▓ Weiter zu Kontaktdaten ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │     │  ← gray-800 (kalt!)
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Brutto │ Netto                ← gray-800 Toggle (kalt!)    │
│                                                              │
│  Gesamt: 990,00 € ← gray-900 (neutral, aber kalt)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    NEU (Warm Italian)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ☕☕☕☕ Weiter zu Kontaktdaten ☕☕☕☕☕☕☕☕☕☕☕☕│     │  ← amber-900 (warm!)
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Brutto │ Netto                ← amber-900 Toggle (warm!)   │
│                                                              │
│  Gesamt: 990,00 € ← amber-950 (warm & lesbar)              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ████████ Zahlungspflichtig bestellen ██████████████│     │  ← amber-500 (golden!)
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Betroffene Dateien & Änderungen

### 1. `src/components/ui/button.tsx`

**Button-Varianten aktualisieren:**

```typescript
// VORHER (kalt):
checkout: "bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300",
checkoutCta: "bg-amber-500 text-gray-900 hover:bg-amber-400 font-semibold shadow-lg",

// NACHHER (warm):
checkout: "bg-amber-900 text-amber-50 hover:bg-amber-800 dark:bg-amber-800 dark:text-amber-50 dark:hover:bg-amber-700",
checkoutCta: "bg-amber-500 text-amber-950 hover:bg-amber-400 font-semibold shadow-lg",
```

### 2. `src/components/checkout/StickySummary.tsx`

**Brutto/Netto Toggle (Zeilen 121-139):**

```tsx
// VORHER:
showGross
  ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 font-medium"

// NACHHER:
showGross
  ? "bg-amber-900 text-amber-50 dark:bg-amber-800 font-medium"
```

**Gesamt-Preis (Zeile 214):**

```tsx
// VORHER:
<span className="font-serif text-xl font-bold text-gray-900 dark:text-white">

// NACHHER:
<span className="font-serif text-xl font-bold text-amber-950 dark:text-amber-50">
```

### 3. `src/components/checkout/AccordionSection.tsx`

**Aktiver Ring (Zeile 38):**

```tsx
// VORHER:
isOpen && "ring-2 ring-gray-400/20",

// NACHHER:
isOpen && "ring-2 ring-amber-400/30",
```

**Step-Indicator aktiv (Zeile 57):**

```tsx
// VORHER:
isOpen && !isCompleted && "bg-gray-100 text-gray-900 border-2 border-gray-800 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-200",

// NACHHER:
isOpen && !isCompleted && "bg-amber-50 text-amber-900 border-2 border-amber-800 dark:bg-amber-900 dark:text-amber-50 dark:border-amber-400",
```

**Bearbeiten-Link (Zeile 76):**

```tsx
// VORHER:
<span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 hover:underline">

// NACHHER:
<span className="flex items-center gap-1 text-sm text-amber-800 dark:text-amber-400 hover:underline">
```

### 4. `src/pages/Checkout.tsx`

**Alle `text-gray-*` zu `text-amber-*` Links:**

| Zeile | Element | Vorher | Nachher |
|-------|---------|--------|---------|
| ~1405 | Login-Link | `text-gray-700` | `text-amber-800` |
| ~1549 | AGB-Links | `text-gray-700` | `text-amber-800` |

### 5. `src/components/ui/calendar.tsx`

**Selected Day (falls noch rot):**

```tsx
// NACHHER:
day_selected:
  "bg-amber-900 text-amber-50 hover:bg-amber-800 focus:bg-amber-900 dark:bg-amber-700 dark:text-amber-50",
```

---

## Farbpalette Referenz (Tailwind amber)

| Klasse | Hex | Verwendung |
|--------|-----|------------|
| `amber-50` | #fffbeb | Text auf dunklem Hintergrund |
| `amber-100` | #fef3c7 | Helle Hintergründe |
| `amber-400` | #fbbf24 | Akzent-Ringe, Hover-States |
| `amber-500` | #f59e0b | CTA-Button (Gold) |
| `amber-800` | #92400e | Links, Hover-States |
| `amber-900` | #78350f | Action-Buttons (Espresso) |
| `amber-950` | #451a03 | Dunkler Text |

---

## Psychologie der Farben

| Farbe | Emotion | Wirkung im Checkout |
|-------|---------|---------------------|
| **Grau** (vorher) | Neutral, sicher, aber kalt | Keine Kaufmotivation |
| **Amber/Gold** (neu) | Warm, wertvoll, appetitlich | Vertrauen + Begehrlichkeit |
| **Espresso-Braun** | Gemütlich, hochwertig | Passt zu italienischem Essen |
| **Grün** (bleibt) | Erfolg, Bestätigung | Abgeschlossene Schritte |

---

## Zusammenfassung

| Datei | Änderungen |
|-------|------------|
| `button.tsx` | `checkout` + `checkoutCta` Varianten → amber-Töne |
| `StickySummary.tsx` | Toggle + Gesamt-Preis → amber |
| `AccordionSection.tsx` | Ring, Step-Indicator, Bearbeiten-Link → amber |
| `Checkout.tsx` | Login- und AGB-Links → amber |
| `calendar.tsx` | Selected day → amber |

**Ergebnis:** Ein warmer, einladender Checkout, der zum italienischen Restaurant-Branding passt und Kunden zum Abschluss motiviert statt sie mit kaltem Grau zu distanzieren.
