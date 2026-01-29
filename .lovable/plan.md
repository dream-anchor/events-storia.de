
# Plan: Checkout-Farbschema – Rot entfernen, Anthrazit + Gelb

## Übersicht

Alle roten (`primary`) Elemente im Checkout werden durch Anthrazit-Töne ersetzt. Der Haupt-CTA-Button ("Zahlungspflichtig bestellen") wird gelb/gold gestylt, um als positive Aufforderung zu wirken statt als Warnung.

---

## Identifizierte rote Elemente (aus Screenshot + Code)

| Element | Aktuell | Neu |
|---------|---------|-----|
| "Weiter zu Kontaktdaten" Button | `bg-primary` (Rot) | Anthrazit (`bg-gray-800`) |
| "Weiter zur Zahlung" Button | `bg-primary` (Rot) | Anthrazit (`bg-gray-800`) |
| **"Zahlungspflichtig bestellen" Button** | `bg-primary` (Rot) | **Gelb** (`bg-amber-500`) |
| Brutto/Netto Toggle (aktiv) | `bg-primary` (Rot) | Anthrazit (`bg-gray-800`) |
| Gesamt-Preis | `text-primary` (Rot) | Anthrazit (`text-gray-900`) |
| Accordion Ring (aktiv) | `ring-primary/20` (Rot) | `ring-gray-400/20` |
| "Bearbeiten" Link | `text-primary` (Rot) | Anthrazit (`text-gray-700`) |
| CalendarDays Icon | `text-primary` (Rot) | Anthrazit (`text-gray-600`) |
| Login Link | `text-primary` (Rot) | Anthrazit (`text-gray-700`) |
| AGB Links | `text-primary` (Rot) | Anthrazit (`text-gray-700`) |

---

## Betroffene Dateien

### 1. `src/components/ui/button.tsx`

Neue Checkout-spezifische Button-Variante hinzufügen:

```typescript
const buttonVariants = cva(
  // ... base styles
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        // NEU: Checkout-Buttons
        checkout: "bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300",
        checkoutCta: "bg-amber-500 text-gray-900 hover:bg-amber-400 font-semibold shadow-lg",
        // ... rest
      },
    },
  }
);
```

### 2. `src/pages/Checkout.tsx`

**Zeile 1305 – CalendarDays Icon:**
```tsx
// VORHER:
<CalendarDays className="h-4 w-4 text-primary" />

// NACHHER:
<CalendarDays className="h-4 w-4 text-gray-600 dark:text-gray-400" />
```

**Zeile 1377-1384 – "Weiter zu Kontaktdaten" Button:**
```tsx
// VORHER:
<Button type="button" onClick={...} className="w-full">

// NACHHER:
<Button type="button" onClick={...} variant="checkout" className="w-full">
```

**Zeile 1405 – Login Link:**
```tsx
// VORHER:
<Link ... className="text-primary hover:underline font-medium">

// NACHHER:
<Link ... className="text-gray-700 dark:text-gray-300 hover:underline font-medium">
```

**Zeile 1549-1550 – AGB Links:**
```tsx
// VORHER:
<Link ... className="text-primary underline">

// NACHHER:
<Link ... className="text-gray-700 dark:text-gray-300 underline hover:text-gray-900 dark:hover:text-white">
```

**Zeile 1558-1565 – "Weiter zur Zahlung" Button:**
```tsx
<Button variant="checkout" className="w-full">
```

**Zeile 1617-1633 – Mobile Submit Button:**
```tsx
// NACHHER:
<Button
  type="submit"
  variant="checkoutCta"
  className="w-full h-12"
  disabled={...}
>
```

### 3. `src/components/checkout/StickySummary.tsx`

**Zeile 116-140 – Brutto/Netto Toggle:**
```tsx
// VORHER:
showGross
  ? "bg-primary text-primary-foreground font-medium"
  : "bg-muted hover:bg-muted/80"

// NACHHER:
showGross
  ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 font-medium"
  : "bg-muted hover:bg-muted/80"
```

**Zeile 214 – Gesamt-Preis:**
```tsx
// VORHER:
<span className="font-serif text-xl font-bold text-primary">

// NACHHER:
<span className="font-serif text-xl font-bold text-gray-900 dark:text-white">
```

### 4. `src/components/checkout/StickyMobileCTA.tsx`

**Zeile 81-100 – CTA Button:**
```tsx
// VORHER:
<Button
  className="w-full h-14 text-base font-semibold shadow-lg"
  size="lg"
>

// NACHHER:
<Button
  variant="checkoutCta"
  className="w-full h-14 text-base shadow-lg"
  size="lg"
>
```

### 5. `src/components/checkout/AccordionSection.tsx`

**Zeile 37-38 – Aktiver Ring:**
```tsx
// VORHER:
isOpen && "ring-2 ring-primary/20",

// NACHHER:
isOpen && "ring-2 ring-gray-400/20",
```

**Zeile 76 – "Bearbeiten" Link:**
```tsx
// VORHER:
<span className="flex items-center gap-1 text-sm text-primary hover:underline">

// NACHHER:
<span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 hover:underline">
```

---

## Desktop CTA Button in StickySummary

Der Desktop-CTA-Button wird über `ctaButton` Prop übergeben. Dieser muss in `Checkout.tsx` angepasst werden:

**Zeile 789-810 (ctaButton Definition):**
```tsx
// NACHHER:
const ctaButton = (
  <Button
    type="submit"
    variant="checkoutCta"
    className="w-full h-12"
    disabled={isSubmitting || isProcessingPayment || !formData.acceptTerms}
  >
    {isSubmitting || isProcessingPayment ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
      </>
    ) : (
      <>
        <Lock className="mr-2 h-4 w-4" />
        {language === 'de' ? 'Zahlungspflichtig bestellen' : 'Place binding order'}
      </>
    )}
  </Button>
);
```

---

## Farbpalette

```text
┌─────────────────────────────────────────────────────────────┐
│  Checkout-Farbschema                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ANTHRAZIT (Neutrales Grau)                                 │
│  ├── bg-gray-800 / text-white     → Weiter-Buttons          │
│  ├── text-gray-700               → Links, Icons             │
│  ├── text-gray-900               → Gesamt-Preis             │
│  └── ring-gray-400/20            → Aktiver Accordion        │
│                                                              │
│  GELB/GOLD (Positiver CTA)                                  │
│  ├── bg-amber-500                → Zahlungspflichtig Button │
│  ├── hover:bg-amber-400          → Hover-State              │
│  └── text-gray-900               → Button-Text              │
│                                                              │
│  GRÜN (Erfolg/Vertrauen – bleibt)                           │
│  ├── text-green-600              → Checkmarks, SSL          │
│  └── bg-green-50                 → Success-Boxen            │
│                                                              │
│  ROT (nur für Fehler!)                                      │
│  └── text-destructive            → Validierungs-Fehler      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Visuelle Vorschau

```text
┌─────────────────────────────────────────────────────────────┐
│                      VORHER (Rot)                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ██████████ Weiter zu Kontaktdaten ██████████████████│     │  ← ROT (Warnung!)
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Gesamt: 990,00 € ← ROT                                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ██████ Zahlungspflichtig bestellen ████████████████│     │  ← ROT (Warnung!)
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     NACHHER (Anthrazit + Gelb)               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ▓▓▓▓▓▓▓▓ Weiter zu Kontaktdaten ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│     │  ← Anthrazit (Neutral)
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Gesamt: 990,00 € ← Schwarz (neutral)                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ ████████ Zahlungspflichtig bestellen ██████████████│     │  ← GELB (Positiv!)
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Zusammenfassung der Änderungen

| Datei | Änderungen |
|-------|------------|
| `src/components/ui/button.tsx` | +2 neue Varianten: `checkout`, `checkoutCta` |
| `src/pages/Checkout.tsx` | ~8 Stellen: Button-Varianten, Links, Icons |
| `src/components/checkout/StickySummary.tsx` | Brutto/Netto Toggle, Gesamt-Preis |
| `src/components/checkout/StickyMobileCTA.tsx` | CTA Button Variante |
| `src/components/checkout/AccordionSection.tsx` | Ring-Farbe, Bearbeiten-Link |

---

## Technische Hinweise

- Die `variant="checkout"` und `variant="checkoutCta"` Varianten werden nur im Checkout verwendet
- Die globale `primary` Farbe (Rot) bleibt für den Rest der Website erhalten
- Destruktive Aktionen (Löschen, Fehler) verwenden weiterhin `destructive`
- Grüne Akzente (Erfolg, Sicherheit) bleiben für Trust-Elemente bestehen
