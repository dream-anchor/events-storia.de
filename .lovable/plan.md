
# Automatische Rechnungsstellung bei "Rechnung nach Event"

## Logik

Bei `invoice_after` soll nach der verbindlichen Buchung automatisch:
1. Eine LexOffice **Rechnung** (nicht Angebot) erstellt werden
2. Das Zahlungsziel = Event-Datum + `invoice_due_days` Tage
3. Die Rechnung wird sofort finalisiert und an den Kunden verschickt

## Technische Umsetzung

### 1. `create-event-quotation` erweitern — auch Rechnungen unterstützen

Neuer optionaler Parameter: `forceDocumentType: 'invoice'`

Wenn gesetzt:
- API-Endpoint: `lexoffice.io/v1/invoices?finalize=true` statt `quotations`
- `paymentConditions`: `{ paymentTermLabel: "Zahlbar innerhalb von X Tagen nach der Veranstaltung", paymentTermDuration: invoice_due_days }`
- `shippingConditions` hinzufügen (Pflicht bei LexOffice-Rechnungen): `{ shippingType: "service", shippingDate: event_date }`
- `taxConditions.taxType` bleibt `gross`
- DB-Update: `lexoffice_invoice_id` und `lexoffice_document_type = 'invoice'` setzen

### 2. `notify-customer-response` erweitern — automatische Rechnungserstellung

Nach der Bestätigungs-E-Mail an den Kunden, wenn `payment_method === 'invoice_after'`:
- Edge Function `create-event-quotation` intern aufrufen mit `forceDocumentType: 'invoice'`
- Ergebnis loggen (Activity Log + email_delivery_logs)
- Fehler abfangen, aber Buchungsbestätigung nicht blockieren (fire-and-forget mit Logging)

### 3. Kunden-Bestätigungs-E-Mail anpassen

Text bei `invoice_after` ändern von:
> "Sie erhalten die Rechnung nach der Veranstaltung per E-Mail."

zu:
> "Die Rechnung wurde Ihnen per E-Mail zugestellt. Zahlungsziel: X Tage nach der Veranstaltung."

## Technische Schritte

| # | Aufgabe | Typ |
|---|---------|-----|
| 1 | `create-event-quotation/index.ts` — `forceDocumentType: 'invoice'` Support + passende Payment Conditions | Edge Function |
| 2 | `notify-customer-response/index.ts` — nach Offline-Booking bei `invoice_after` automatisch `create-event-quotation` mit `forceDocumentType: 'invoice'` aufrufen | Edge Function |
| 3 | Kunden-Bestätigungs-E-Mail Text für `invoice_after` anpassen | Edge Function |
| 4 | Beide Edge Functions deployen und testen | Deploy |

## Hinweise

- Bei `on_site` wird **keine** Rechnung erstellt — nur die Buchungsbestätigung
- Die LexOffice-Rechnung wird mit `finalize=true` erstellt und damit direkt als PDF verfügbar
- Die `lexoffice_invoice_id` wird am Event gespeichert, damit sie im Admin-Panel sichtbar ist
