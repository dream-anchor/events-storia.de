

# Plan: Grün entfernen + "Jetzt zahlen" Button in rechter Box hinzufügen

## Problem 1: Grüne Elemente entfernen

Es gibt drei Stellen mit grüner Farbe:

| Datei | Element | Aktuell |
|-------|---------|---------|
| `StickySummary.tsx` Z.187-190 | "Lieferung kostenlos" | `text-green-600` |
| `Checkout.tsx` Z.1670-1677 | Trust-Notice Box | `bg-green-50`, `text-green-600/700` |
| `Checkout.tsx` Z.1649 | "Beliebt" Badge | `badgeColor="green"` |

**Änderung:** Alle grünen Farben durch monochrome Grautöne ersetzen.

---

## Problem 2: Fehlender CTA-Button in rechter Box

Die `StickySummary` Komponente hat einen `ctaButton` Slot (Zeile 221):
```tsx
{ctaButton && <div className="pt-2">{ctaButton}</div>}
```

Aber in `Checkout.tsx` wird dieser **nicht übergeben** (Zeile 1707-1719).

**Änderung:** CTA-Button als `ctaButton` Prop übergeben:
```tsx
<StickySummary
  // ... andere props
  ctaButton={
    completedSteps.includes('payment') && (
      <Button
        type="submit"
        variant="checkoutCta"
        className="w-full h-12"
        disabled={isSubmitting || isProcessingPayment || !formData.acceptTerms}
      >
        {isSubmitting || isProcessingPayment ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Wird verarbeitet...
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            Sofort kaufen
          </>
        )}
      </Button>
    )
  }
/>
```

Der Button erscheint erst, wenn Schritt 3 (Zahlung) abgeschlossen ist.

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `StickySummary.tsx` | Grün bei "Lieferung kostenlos" → neutral |
| `Checkout.tsx` Z.1649 | `badgeColor="green"` → `badgeColor="neutral"` |
| `Checkout.tsx` Z.1670-1677 | Trust-Notice: Grün → Neutral |
| `Checkout.tsx` Z.1707-1719 | `ctaButton` Prop hinzufügen |

---

## Ergebnis

1. Alle grünen Akzente entfernt → monochrome Ästhetik
2. "Sofort kaufen" Button erscheint in der rechten Zusammenfassung, sobald alle Schritte ausgefüllt sind

