
# Plan: Formular-Persistierung im Checkout bei Zahlungsabbruch

## Problem

Wenn ein Kunde zur Stripe-Zahlungsseite weitergeleitet wird und dort abbricht, gehen alle eingegebenen Formulardaten (Datum, Uhrzeit, Adresse, Kontaktdaten) verloren. Der Kunde muss alles erneut eingeben.

---

## Lösung: localStorage-Persistierung

Implementierung einer robusten Formular-Persistierung nach dem Muster der bereits funktionierenden Warenkorb-Speicherung.

### 1. localStorage-Key und Initialisierung

```typescript
// Neuer Key für Checkout-Formulardaten
const CHECKOUT_FORM_KEY = 'storia-checkout-form';

// Geänderter useState mit Wiederherstellung aus localStorage
const [formData, setFormData] = useState(() => {
  const defaultState = {
    name: '',
    email: '',
    phone: '',
    company: '',
    deliveryType: 'delivery',
    deliveryStreet: '',
    deliveryZip: '',
    deliveryCity: '',
    deliveryFloor: '',
    hasElevator: false,
    date: '',
    time: '',
    notes: '',
    wantsSetupService: false,
    sameAsDelivery: true,
    showBillingAddress: false,
    billingName: '',
    billingStreet: '',
    billingZip: '',
    billingCity: '',
    billingCountry: 'Deutschland',
    acceptTerms: false,
    referenceNumber: ''
  };
  
  // Aus localStorage wiederherstellen (wenn vorhanden)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(CHECKOUT_FORM_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...defaultState, ...parsed };
      } catch (e) {
        // Bei Parsing-Fehler: Default verwenden
      }
    }
  }
  return defaultState;
});
```

### 2. Debounced Speicherung bei Änderungen

```typescript
// Nach dem useState-Block (ca. Zeile 160)
useEffect(() => {
  // Debounce: Speichern nach 500ms Inaktivität
  const timeoutId = setTimeout(() => {
    localStorage.setItem(CHECKOUT_FORM_KEY, JSON.stringify(formData));
  }, 500);
  
  return () => clearTimeout(timeoutId);
}, [formData]);
```

### 3. Accordion-Schritt persistieren

```typescript
// Neuer Key für Accordion-Status
const CHECKOUT_STEP_KEY = 'storia-checkout-step';

// Geänderter useState für currentStep
const [currentStep, setCurrentStep] = useState<CheckoutStep>(() => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(CHECKOUT_STEP_KEY);
    if (stored && ['delivery', 'customer', 'payment'].includes(stored)) {
      return stored as CheckoutStep;
    }
  }
  return 'delivery';
});

// completedSteps ebenfalls persistieren
const [completedSteps, setCompletedSteps] = useState<CheckoutStep[]>(() => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('storia-checkout-completed');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
  }
  return [];
});

// Speicherung bei Änderungen
useEffect(() => {
  localStorage.setItem(CHECKOUT_STEP_KEY, currentStep);
}, [currentStep]);

useEffect(() => {
  localStorage.setItem('storia-checkout-completed', JSON.stringify(completedSteps));
}, [completedSteps]);
```

### 4. Daten nach erfolgreicher Bestellung löschen

Im bestehenden `handlePaymentSuccess`:

```typescript
// In handlePaymentSuccess (ca. Zeile 330-475)
// Nach clearCart() hinzufügen:
localStorage.removeItem(CHECKOUT_FORM_KEY);
localStorage.removeItem(CHECKOUT_STEP_KEY);
localStorage.removeItem('storia-checkout-completed');
```

### 5. Prioritätslogik: Profil vs. gespeicherte Daten

Die Profil-Daten sollen nur dann verwendet werden, wenn keine gespeicherten Formulardaten existieren:

```typescript
// Angepasster useEffect für Profil-Prefill (Zeile 205-224)
useEffect(() => {
  if (profile) {
    // Nur überschreiben, wenn das Feld leer ist
    setFormData(prev => ({
      ...prev,
      name: prev.name || profile.name || '',
      email: prev.email || profile.email || '',
      // ... weitere Felder ...
    }));
  }
}, [profile]);
```

Diese Logik bleibt unverändert, da sie bereits `prev.field || profile.field` verwendet.

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `src/pages/Checkout.tsx` | localStorage-Persistierung für formData, currentStep, completedSteps |

### Ablauf

```text
Nutzer füllt Formular aus
        ↓
formData wird debounced (500ms) in localStorage gespeichert
        ↓
Nutzer wird zu Stripe weitergeleitet
        ↓
[Abbruch bei Stripe]
        ↓
Rückkehr zu /checkout
        ↓
useState initialisiert formData aus localStorage
        ↓
Alle Eingaben sind wiederhergestellt ✓
```

---

## Technische Details

- **Debounce 500ms**: Verhindert zu häufiges Schreiben bei schnellem Tippen
- **Sichere Initialisierung**: `typeof window !== 'undefined'` für SSR-Kompatibilität
- **Try-Catch**: Fehlerresistentes JSON-Parsing
- **Cleanup bei Erfolg**: Daten werden nach erfolgreicher Bestellung gelöscht
