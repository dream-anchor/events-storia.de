
# Fix: Offline-Buchung — E-Mail an Kunden + Activity-Log

## Problem

1. **Keine Bestätigungs-E-Mail an Kunden**: Nach "Verbindlich buchen" (on_site / invoice_after) wird nur das Admin-Team per `notify-customer-response` informiert. Der Kunde erhält keine Bestätigung.
2. **Kein Activity-Log**: Der `confirm_offline_booking` RPC schreibt keinen Eintrag in `activity_logs` — die Buchung erscheint nicht in der CRM-Timeline.

## Lösung

### 1. Kunden-Bestätigungs-E-Mail nach Offline-Buchung

**Edge Function `notify-customer-response` erweitern** — zusätzlich zur Admin-Mail wird eine zweite E-Mail direkt an den Kunden gesendet mit:

- Betreff: "Ihre Buchung bei STORIA ist bestätigt"
- Inhalt: Zusammenfassung (Eventdatum, Gästeanzahl, gewählte Option, Zahlungsinformation je nach `payment_method`)
- Für `on_site`: "Zahlung bequem vor Ort"
- Für `invoice_after`: "Rechnung wird Ihnen nach dem Event zugestellt"

Die Kunden-E-Mail wird separat in `email_delivery_logs` geloggt.

### 2. Activity-Log bei Offline-Buchung

**`confirm_offline_booking` RPC erweitern** — nach erfolgreicher Statusänderung wird ein Eintrag in `activity_logs` geschrieben:

```
action: 'offline_booking_confirmed'
entity_type: 'event_inquiry'
entity_id: p_inquiry_id
new_value: { payment_method, selected_option_id }
metadata: { triggered_by: 'customer' }
```

### 3. Activity-Log Formatierung

`useActivityLog.ts` wird um den neuen Action-Typ `offline_booking_confirmed` ergänzt:
- Anzeige: "Verbindlich gebucht (ohne Online-Zahlung)"
- Icon: `CalendarCheck`

## Technische Schritte

| # | Aufgabe | Typ |
|---|---------|-----|
| 1 | Migration: `confirm_offline_booking` RPC um Activity-Log-Insert erweitern | DB Migration |
| 2 | `notify-customer-response/index.ts` um Kunden-E-Mail erweitern | Edge Function |
| 3 | `useActivityLog.ts` — neuen Action-Typ `offline_booking_confirmed` hinzufügen | Frontend |

Keine neuen Tabellen, keine neuen Edge Functions, keine Breaking Changes.
