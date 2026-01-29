
# Bestellnummer-Format für Event-Pakete anpassen

## Problem
Bei direkten Event-Paket-Buchungen über den Shop wird aktuell eine Bestellnummer im Format `EVENTS-ANGEBOT-DD-MM-YYYY-XXX` generiert. Das Wort "ANGEBOT" ist hier falsch, da es sich um eine direkte Buchung handelt und nicht um ein Angebot/Anfrage.

## Lösung
Die Bestellnummer-Generierung wird angepasst, sodass Event-Pakete ein eigenes Format erhalten: **`EVT-BUCHUNG-DD-MM-YYYY-XXX`**

Dieses Format:
- Unterscheidet klar zwischen Event-Buchungen und Catering-Bestellungen
- Vermeidet die irreführende Bezeichnung "ANGEBOT"
- Passt zur bestehenden `EVT-YYYY-XXXX` Logik für Angebots-Zahlungen

---

## Technische Änderungen

### 1. Frontend: `src/pages/Checkout.tsx`

Die `generateOrderNumber` Funktion wird erweitert, um den Buchungstyp zu berücksichtigen:

```text
Aktuelle Logik (Zeile 634-643):
┌─────────────────────────────────────────────┐
│ isStripePaid = true  → EVENTS-BESTELLUNG    │
│ isStripePaid = false → EVENTS-ANGEBOT       │
└─────────────────────────────────────────────┘

Neue Logik:
┌─────────────────────────────────────────────┐
│ isEventBooking = true:                      │
│   → EVT-BUCHUNG-DD-MM-YYYY-XXX              │
│                                             │
│ isEventBooking = false (Catering):          │
│   isStripePaid = true  → CAT-BESTELLUNG     │
│   isStripePaid = false → CAT-ANGEBOT        │
└─────────────────────────────────────────────┘
```

Die Änderung betrifft:
- Zeile 634-643: Funktion `generateOrderNumber` erhält neuen Parameter `isEvent`
- Zeile 727: Aufruf wird angepasst, um `isEventBooking` zu übergeben

### 2. Backend: `supabase/functions/create-lexoffice-invoice/index.ts`

Die Edge Function erhält einen neuen Parameter `isEventBooking`, um das korrekte Nummernformat für LexOffice-Dokumente zu generieren:

```text
Aktuelle Logik (Zeile 67-100):
┌─────────────────────────────────────────────┐
│ isInvoice = true  → EVENTS-RECHNUNG         │
│ isInvoice = false → EVENTS-ANGEBOT          │
└─────────────────────────────────────────────┘

Neue Logik:
┌─────────────────────────────────────────────┐
│ isEventBooking = true:                      │
│   → EVT-BUCHUNG-DD-MM-YYYY-XXX              │
│                                             │
│ isEventBooking = false:                     │
│   isInvoice = true  → CAT-RECHNUNG          │
│   isInvoice = false → CAT-ANGEBOT           │
└─────────────────────────────────────────────┘
```

### 3. Datenbank-Sequenz

Ein neuer Präfix `EVT-BUCHUNG` wird in der `order_number_sequences` Tabelle verwendet, um eigene fortlaufende Nummern für Event-Buchungen zu erzeugen.

---

## Zusammenfassung der Nummernformate nach Umsetzung

| Typ | Zahlungsmethode | Format |
|-----|-----------------|--------|
| Event-Paket (Shop) | Stripe/Rechnung | `EVT-BUCHUNG-DD-MM-YYYY-XXX` |
| Catering | Stripe | `CAT-BESTELLUNG-DD-MM-YYYY-XXX` |
| Catering | Rechnung | `CAT-ANGEBOT-DD-MM-YYYY-XXX` |
| Event via Angebot | Stripe | `EVT-YYYY-XXXX` (bestehend) |

---

## Dateien die geändert werden

1. **`src/pages/Checkout.tsx`** – Anpassung der `generateOrderNumber` Funktion
2. **`supabase/functions/create-lexoffice-invoice/index.ts`** – Anpassung der Bestellnummer-Generierung für LexOffice
