
# Plan: Bezahlte Event-Aufträge im Dashboard anzeigen + LexOffice-Integration

## Übersicht

Wenn ein Kunde über einen Stripe-Zahlungslink bezahlt, wird dies bereits in `event_bookings` mit `payment_status: "paid"` erfasst. Allerdings fehlen:
1. Eine automatische LexOffice-Rechnung nach der Zahlung
2. Die entsprechenden Datenbankfelder in `event_bookings`
3. Eine Anzeige im Dashboard unter "Bezahlte Aufträge"

---

## Schritt 1: Datenbank-Migration

Neue Spalten für `event_bookings` (analog zu `catering_orders`):

```text
ALTER TABLE event_bookings ADD COLUMN:
- lexoffice_invoice_id (text)
- lexoffice_document_type (text)  
- lexoffice_contact_id (text)
```

---

## Schritt 2: Edge Function erweitern

Die `handle-offer-payment` Edge Function wird erweitert, um nach erfolgreicher Buchungserstellung automatisch eine LexOffice-Rechnung zu erstellen:

```text
processSuccessfulPayment():
  1. Buchung erstellen (existiert bereits)
  2. Inquiry aktualisieren (existiert bereits)
  3. NEU: LexOffice-Rechnung erstellen via create-lexoffice-invoice
  4. NEU: Buchung mit lexoffice_invoice_id aktualisieren
```

---

## Schritt 3: Hook für bezahlte Buchungen

Neuer React Query Hook `usePaidEventBookings`:

```text
- Filtert event_bookings WHERE payment_status = 'paid'
- Sortiert nach created_at DESC
- Liefert Buchungsdaten inkl. LexOffice-Status
```

---

## Schritt 4: Dashboard-Erweiterung

Neue "Bezahlte Aufträge" Box im Dashboard:

```text
┌─────────────────────────────────────────────┐
│ 💳 Bezahlte Aufträge                        │
│ Erfolgreich bezahlte Event-Buchungen        │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ EVT-2026-0001                           │ │
│ │ Firma ABC GmbH                          │ │
│ │ 50 Gäste • 15.03.26                     │ │
│ │ ✅ Bezahlt • 2.415,00 €                 │ │
│ │ 📄 LexOffice: Rechnung erstellt         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ EVT-2026-0002                           │ │
│ │ ...                                     │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Angezeigte Informationen pro Buchung:
- Buchungsnummer (EVT-XXXX-XXXX)
- Firma/Kundenname
- Gästeanzahl + Event-Datum
- Zahlungsstatus mit Betrag
- LexOffice-Status (Rechnung erstellt / ausstehend)
- Link zur Buchungsdetailseite

---

## Technische Änderungen

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/...` | Neue Spalten für LexOffice-Integration |
| `src/integrations/supabase/types.ts` | Automatisch aktualisiert |
| `supabase/functions/handle-offer-payment/index.ts` | LexOffice-Rechnung nach Zahlung erstellen |
| `src/hooks/useEventBookings.ts` | Neuer Hook `usePaidEventBookings` |
| `src/components/admin/refine/Dashboard.tsx` | Neue "Bezahlte Aufträge" Box |

---

## Ablauf nach Implementierung

```text
Kunde bezahlt via Stripe-Link
         ↓
handle-offer-payment (Webhook)
         ↓
    ┌────┴────┐
    ↓         ↓
Buchung    Inquiry auf
erstellen  'confirmed'
    ↓         
LexOffice-Rechnung erstellen
    ↓
Buchung mit lexoffice_invoice_id aktualisieren
    ↓
Dashboard zeigt in "Bezahlte Aufträge":
- Buchungsnummer
- Kunde/Firma
- Betrag
- LexOffice-Status
```
