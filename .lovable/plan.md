# ✅ Terminologie-Korrektur: "Anfrage" vs "Bestellung/Buchung"

**Status:** Implementiert

## Umgesetzte Logik

Die Terminologie wird jetzt nach **Zahlungsstatus** unterschieden, nicht nach Zahlungsmethode:

| paymentStatus | Terminologie |
|---------------|--------------|
| `paid` | **Bestellung** / **Buchung** |
| `pending` | **Anfrage** |

## Geänderte Dateien

1. ✅ `supabase/functions/send-order-notification/index.ts` - `isPaid = paymentStatus === 'paid'`
2. ✅ `src/pages/Checkout.tsx` - `paymentStatus: 'pending'` bei Rechnung, `paymentStatus: 'paid'` nach Stripe-Erfolg

