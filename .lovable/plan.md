
# Audit: Zahlungsmodalitäten — End-to-End

## Ergebnis-Übersicht

| Ebene | Status | Details |
|---|---|---|
| DB-Spalten `v2_events` | OK | `payment_method` (default `deposit_online`) und `invoice_due_days` vorhanden |
| View `event_inquiries` | OK | Beide Felder werden korrekt exponiert |
| Update-Trigger | OK | `payment_method` und `invoice_due_days` werden nach `v2_events` geschrieben |
| Insert-Trigger | OK | Neue Inquiries übernehmen beide Felder |
| Admin-UI `PaymentTermsBlock` | OK | 4 Kacheln, konditionsabhängige Felder, Defaults aus `site_settings` |
| Admin-UI `OfferBuilder` | OK | Leitet `payment_method` und `invoice_due_days` korrekt durch |
| Typen `ExtendedInquiry` | OK | `payment_method` und `invoice_due_days` vorhanden |
| **RPC `get_public_offer`** | **KRITISCH** | Gibt `payment_method` und `invoice_due_days` **nicht** zurück — Kunde bekommt immer `null` |
| PublicOffer Frontend | OK | `isStripePayment`-Logik, "Verbindlich buchen"-Button, Trust-Elemente korrekt |
| `handleConfirmBooking` | OK | Ruft `confirm_offline_booking` RPC auf |
| `confirm_offline_booking` RPC | OK | Setzt Status, validiert Zahlungsart, existiert in DB |
| Edge Function Guard | OK | `create-payment-session` blockiert `on_site`/`invoice_after` mit 400-Fehler |
| MobileStickyBookingBar | OK | `onConfirmBooking` → `handleConfirmBooking` korrekt verdrahtet |

## Kritische Lücke

### RPC `get_public_offer` — fehlt `payment_method` + `invoice_due_days`

Die RPC-Funktion in der Datenbank ist noch die alte Version. Sie gibt die beiden neuen Felder nicht an den Kunden weiter. Dadurch:

- Der Kunde sieht **immer** den Stripe-Zahlungsflow (Fallback auf `deposit_online`)
- "Vor Ort" und "Rechnung" werden auf der Kundenseite nie angezeigt
- Der "Verbindlich buchen"-Button erscheint nie

**Ursache:** Die vorherige Migration (`20260501193500`) hat die RPC-Funktion zwar als Datei angelegt, sie wurde aber in der Live-DB nicht übernommen (die Datenbank zeigt die alte Funktionsdefinition ohne die beiden Felder).

## Fix

Eine einzige Migration:

- `CREATE OR REPLACE FUNCTION get_public_offer(...)` — ergänzt um:
  - `'payment_method', COALESCE(ei.payment_method, 'deposit_online')`
  - `'invoice_due_days', COALESCE(ei.invoice_due_days, 14)`

Keine Frontend-Änderungen nötig — der Code liest die Felder bereits korrekt.

## Sekundäre Beobachtungen (nicht blockierend)

1. **Bestätigungs-E-Mail**: Nach "Verbindlich buchen" wird `notify-customer-response` aufgerufen, aber es gibt keine dedizierte E-Mail-Vorlage für Offline-Buchungsbestätigungen. Der Kunde erhält aktuell keine automatische Bestätigung per E-Mail.
2. **Activity-Log**: Der `confirm_offline_booking` RPC erstellt keinen Activity-Log-Eintrag. Für CRM-Transparenz wäre ein automatischer Log sinnvoll.
3. **Bestehende Inquiries**: Alle existierenden Inquiries haben `payment_method = 'deposit_online'` (korrekt als Default).
