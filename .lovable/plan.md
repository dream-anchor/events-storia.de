

# Terminologie-Korrektur: "Anfrage" vs "Bestellung/Buchung"

## Problem
Die aktuelle Logik unterscheidet nach **Zahlungsmethode** (Stripe vs Rechnung), aber das ist falsch:

| Aktuell (FALSCH) | | |
|------------------|-----------|---------|
| Zahlungsmethode | Terminologie | Problem |
| Stripe | "Bestellung" | ✓ Korrekt |
| Rechnung | "Anfrage" | ✗ FALSCH - Rechnung = auch bezahlt! |

## Korrekte Logik

Die Unterscheidung muss nach **Zahlungsstatus** erfolgen, nicht nach Zahlungsmethode:

| Zahlungsstatus | Terminologie |
|----------------|--------------|
| `paid` | **Bestellung** / **Buchung** |
| `pending` / anderes | **Anfrage** |

---

## Technische Änderungen

### 1. Edge Function: `send-order-notification/index.ts`

**Interface erweitern (Zeile 53):**
```typescript
paymentStatus?: 'pending' | 'paid' | 'failed';  // NEU
```

**Logik ändern (Zeile 380, 384-399):**

Aktuell:
```typescript
const isStripe = data.paymentMethod === 'stripe';
// verwendet isStripe für Terminologie
```

Neu:
```typescript
const isPaid = data.paymentStatus === 'paid';
// verwendet isPaid für Terminologie
```

**Betroffene Stellen:**
- Zeile 71-92: `generateCustomerEmailText` - Grußformel und nächste Schritte
- Zeile 384-399: Email-Betreffzeilen

| Feld | isPaid = true | isPaid = false |
|------|---------------|----------------|
| Kunden-Betreff (Event) | "Ihre Event-Buchung" | "Ihre Event-Anfrage" |
| Kunden-Betreff (Catering) | "Ihre Catering-Bestellung" | "Ihre Catering-Anfrage" |
| Restaurant-Betreff (Event) | "BEZAHLT: Neue Event-Buchung" | "Neue Event-Anfrage" |
| Restaurant-Betreff (Catering) | "BEZAHLT: Neue Bestellung" | "Neue Anfrage" |
| Gruß (Event) | "vielen Dank für Ihre Event-Buchung!" | "vielen Dank für Ihre Event-Anfrage!" |
| Gruß (Catering) | "vielen Dank für Ihre Bestellung!" | "vielen Dank für Ihre Anfrage!" |

### 2. Frontend: `Checkout.tsx`

Beim Aufruf der Edge Function muss `paymentStatus` mitgesendet werden:

```typescript
// Bei send-order-notification Aufruf hinzufügen:
paymentStatus: paymentMethod === 'stripe' ? 'pending' : 'pending',
// Wird nach Stripe-Zahlung auf 'paid' gesetzt
```

**Wichtig:** Bei Stripe-Zahlungen wird die Email erst NACH erfolgreicher Zahlung gesendet (aus `create-catering-payment` oder `OrderSuccess`), daher ist `paymentStatus: 'paid'` korrekt.

Bei Rechnungszahlungen wird die Email sofort gesendet mit `paymentStatus: 'pending'` - daher korrekt als "Anfrage" bezeichnet.

### 3. Bestellnummer-Format (bereits korrekt)

Das Format `CAT-ANGEBOT` vs `CAT-BESTELLUNG` ist bereits korrekt implementiert, da:
- Stripe-Zahlung = sofort bezahlt = "BESTELLUNG"
- Rechnung = noch nicht bezahlt = "ANGEBOT" (= Anfrage)

---

## Dateien die geändert werden

1. **`supabase/functions/send-order-notification/index.ts`** - Logik von `isStripe` auf `isPaid` umstellen
2. **`src/pages/Checkout.tsx`** - `paymentStatus` Parameter beim Edge Function Aufruf hinzufügen

---

## Zusammenfassung der neuen Logik

```text
┌────────────────────────────────────────────────────────────┐
│                    TERMINOLOGIE-REGEL                       │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   BEZAHLT (paymentStatus = 'paid'):                        │
│     → "Bestellung" (Catering)                              │
│     → "Buchung" (Event)                                    │
│     → Betreff: "BEZAHLT: ..."                              │
│                                                             │
│   NICHT BEZAHLT (paymentStatus = 'pending'):               │
│     → "Anfrage" (Catering & Event)                         │
│     → Betreff: "Neue Anfrage ..."                          │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

