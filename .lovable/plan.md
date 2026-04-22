

# Restaurant-Menü auf Public-Offer richtig listen + Stripe-Back darf Auswahl nicht zerstören

## Befund

### Problem 1 — Restaurant-Menü zeigt keine Gänge
`MenuImporter.tsx` erzeugt beim Import eines Restaurant-Menüs Optionen mit:
- `packageName = item.name` (z.B. "Tasting Menu Auriga")
- `menuSelection.courses = []` (leer!)
- `menuSelection.drinks = []`

Auf der Public-Offer-Seite (`PublicOffer.tsx` Zeile 1551 + 1611) wird bei `courses.length === 0` und `drinkRows.length === 0` nur "Menüdetails werden noch zusammengestellt." angezeigt → Karte sieht leer aus, im Gegensatz zu "Individuelles Menü" das saubere Antipasto/Hauptgang/Dessert-Reihen rendert.

Die `description` der Restaurant-Menüs ist aber gefüllt (typisch Pipe-getrennt: `"Antipasto X | Primo Y | Dessert Z"`) und enthält genau die fehlenden Gang-Infos.

### Problem 2 — Stripe-Cancel löscht die Mengen-Verteilung
In `ProposalView` lebt `optionQuantities` nur in React-State (Zeile 662). Ablauf:
1. Kunde verteilt B=3, C=7 → klickt "Jetzt zahlen"
2. `create-payment-session` schreibt `selected_quantity` pro Option in DB und redirected zu Stripe
3. Kunde klickt bei Stripe "Zurück" → cancel_url `/offer/{id}?payment=cancelled` lädt die Seite neu
4. `optionQuantities` startet wieder bei `{}`, alle Steppers auf 0, "Bezahlen"-Button verschwindet → wirkt als wären "alle Optionen weg"

Zusätzlich: Es gibt **keine Behandlung** des `?payment=cancelled`-Query-Params (kein Toast, keine Bereinigung).

## Lösung

### Fix 1 — Gänge aus Description parsen beim Import

In `src/components/admin/refine/InquiryEditor/OfferBuilder/MenuImporter.tsx`:

Helper-Funktion `parseMenuDescription(description: string): CourseSelection[]`:
- Splittet `description` an `|` (oder `\n`, `•`, `–`)
- Pro Teil: erkennt optionales Label vor `:` (z.B. "Antipasto: Burrata…") → `courseLabel` + `itemName`
- Ohne Label: nutzt generische Folge-Labels ("Vorspeise", "Hauptgang", "Dessert" je nach Position) oder einfach "Gang 1/2/3"
- Liefert eine `CourseSelection[]` mit `courseType`, `courseLabel`, `itemName`, `itemDescription: null`

Anwendung im Import-Loop (sowohl Lunch als auch Dinner-Tasting):
```ts
const parsedCourses = parseMenuDescription(item.description ?? menu.description ?? '');
const menuSel: OfferBuilderOption['menuSelection'] = {
  courses: parsedCourses,
  drinks: [],
};
```

Fallback: leere Description → `courses` bleibt leer, alte Anzeige greift.

### Fix 2 — `optionQuantities` über Reload persistieren + Cancel-Toast

In `src/pages/PublicOffer.tsx`, `ProposalView`:

**a) localStorage-Persistierung** (Key: `storia_offer_qty_${inquiry.id}`):
```ts
const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>(() => {
  if (typeof window === 'undefined') return Object.fromEntries(options.map(o => [o.id, 0]));
  try {
    const saved = localStorage.getItem(`storia_offer_qty_${inquiry.id}`);
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, number>;
      // Nur valide option-ids aus aktuellem Angebot übernehmen
      const valid = Object.fromEntries(options.map(o => [o.id, parsed[o.id] ?? 0]));
      return valid;
    }
  } catch { /* ignore */ }
  return Object.fromEntries(options.map(o => [o.id, 0]));
});

useEffect(() => {
  try {
    localStorage.setItem(`storia_offer_qty_${inquiry.id}`, JSON.stringify(optionQuantities));
  } catch { /* ignore quota */ }
}, [optionQuantities, inquiry.id]);
```

**b) Cancel-Toast + URL-Cleanup** im Hauptkomponenten-Effect:
```ts
useEffect(() => {
  if (searchParams.get('payment') === 'cancelled') {
    toast.info('Zahlung abgebrochen — Ihre Auswahl wurde gespeichert.', { duration: 5000 });
    // Query-Param entfernen damit Reload nicht erneut Toast zeigt
    const url = new URL(window.location.href);
    url.searchParams.delete('payment');
    window.history.replaceState({}, '', url.toString());
  }
}, [searchParams]);
```

**c) Cleanup nach erfolgreicher Submission** in `handleSendMessage` und nach erfolgreichem `?payment=success`:
```ts
localStorage.removeItem(`storia_offer_qty_${inquiry.id}`);
```

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/OfferBuilder/MenuImporter.tsx` — `parseMenuDescription`-Helper + Anwendung im Import-Loop (~30 Zeilen)
- `src/pages/PublicOffer.tsx` — localStorage-Hydration für `optionQuantities`, Cancel-Toast, Cleanup nach Erfolg (~25 Zeilen)

Keine DB-Migration. Keine Edge-Function-Änderungen. Keine Breaking Changes für bereits importierte Restaurant-Menüs (alte Optionen ohne courses fallen weiter auf "Menüdetails werden noch zusammengestellt." zurück — können vom Admin per Re-Import oder manueller Bearbeitung repariert werden).

## Verifikation

1. **Restaurant-Menü-Anzeige:** Neuen Restaurant-Menü-Import durchführen → in Public-Offer-Karte erscheinen die Gänge (Antipasto/Primo/Dessert) genau wie bei "Individuelles Menü".
2. **Stripe-Back:** Kunde verteilt A=3, B=7 → "Jetzt zahlen" → bei Stripe abbrechen → zurück auf Offer-Page → Verteilung A=3, B=7 ist noch da, Toast "Zahlung abgebrochen — Ihre Auswahl wurde gespeichert" erscheint, URL ist sauber (kein `?payment=cancelled`).
3. **Erfolgreiche Zahlung:** Bezahlung durchläuft → ConfirmationView → localStorage ist bereinigt (Reload zeigt keine alten Quantities mehr).
4. **Inkonsistenter localStorage** (z.B. alte option-IDs): nicht mehr existierende IDs werden ignoriert, neue Options starten bei 0.

