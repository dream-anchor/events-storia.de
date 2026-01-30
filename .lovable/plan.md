

## Fehlerbehebung: create-catering-payment Edge Function

### Problem identifiziert

Die Edge Function `create-catering-payment` schlägt mit folgendem Fehler fehl:

```
Invalid URL: An explicit scheme (such as https) must be provided.
```

**Ursache:** Der `Origin`-Header ist in manchen Fällen `null`, was zu ungültigen Stripe-Redirect-URLs führt:

```typescript
// Zeile 190-191 - Problem:
success_url: `${req.headers.get("origin")}/checkout?payment=success&order=${orderNumber}`,
cancel_url: `${req.headers.get("origin")}/checkout?payment=cancelled`,

// Ergebnis wenn Origin fehlt:
// success_url: "null/checkout?payment=success..." → INVALID!
```

---

### Lösung

Die Edge Function muss einen **Fallback** verwenden, wenn der `Origin`-Header fehlt. Es gibt zwei Optionen:

#### Option 1: Referer-Header als Fallback (bevorzugt)

```typescript
// Ermittle die Basis-URL aus Origin oder Referer
const origin = req.headers.get("origin");
const referer = req.headers.get("referer");

let baseUrl = origin;
if (!baseUrl && referer) {
  // Extrahiere Origin aus Referer (z.B. "https://example.com/checkout" → "https://example.com")
  try {
    const refererUrl = new URL(referer);
    baseUrl = refererUrl.origin;
  } catch {
    baseUrl = null;
  }
}

// Fallback auf bekannte Produktions-Domain
if (!baseUrl) {
  baseUrl = "https://ristorantestoria.de";
}

// Verwende sichere baseUrl für Stripe-Redirects
success_url: `${baseUrl}/checkout?payment=success&order=${orderNumber}`,
cancel_url: `${baseUrl}/checkout?payment=cancelled`,
```

#### Option 2: Explizite URL vom Client übergeben

Der Client sendet im Request-Body die aktuelle URL mit, z.B.:

```typescript
// Checkout.tsx beim Aufruf
body: {
  ...
  returnUrl: window.location.origin,
}

// Edge Function
const returnUrl = body.returnUrl || "https://ristorantestoria.de";
```

---

### Empfehlung: Option 1 (Referer-Fallback)

**Warum?**
- Kein Frontend-Update nötig
- Funktioniert auch in Edge Cases (z.B. Previews, Custom Domains)
- Robuster Fallback auf bekannte Produktions-Domain

---

### Implementierung

**Datei:** `supabase/functions/create-catering-payment/index.ts`

**Änderungen:**

1. Nach Zeile 23 (`const { amount, ... } = await req.json();`) hinzufügen:

```typescript
// Determine base URL for Stripe redirect URLs
const origin = req.headers.get("origin");
const referer = req.headers.get("referer");

let baseUrl = origin;
if (!baseUrl && referer) {
  try {
    const refererUrl = new URL(referer);
    baseUrl = refererUrl.origin;
  } catch {
    baseUrl = null;
  }
}

// Fallback to production domain if no origin detected
if (!baseUrl) {
  baseUrl = "https://ristorantestoria.de";
}

logStep("Base URL determined", { origin, referer, baseUrl });
```

2. Zeilen 190-191 ändern zu:

```typescript
success_url: `${baseUrl}/checkout?payment=success&order=${orderNumber}`,
cancel_url: `${baseUrl}/checkout?payment=cancelled`,
```

---

### Erwartetes Ergebnis

- Zahlungen funktionieren auch wenn `Origin`-Header fehlt
- Preview-Domains werden automatisch erkannt
- Produktions-Fallback verhindert Fehler in Edge Cases
- Logging hilft bei zukünftiger Fehleranalyse

