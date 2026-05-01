
# Zahlungsmodalitäten — Lücken schließen

## Problem

Die Spalten `payment_method` und `invoice_due_days` wurden versehentlich nur auf `_legacy_event_inquiries` angelegt. Die aktive Tabelle `v2_events` hat diese Spalten nicht, die View `event_inquiries` gibt sie nicht aus, und der Update-Trigger propagiert sie nicht. Dadurch:

1. Admin speichert die Zahlungsart → Daten gehen ins Leere
2. Kunden-Seite (PublicOffer) bekommt immer den Default `deposit_online`
3. "Verbindlich buchen"-Button für Offline-Zahlungen hat keinen Backend-Flow

## Schritt 1 — Datenbank-Migration

- `ALTER TABLE v2_events ADD COLUMN payment_method text DEFAULT 'deposit_online'`
- `ALTER TABLE v2_events ADD COLUMN invoice_due_days integer DEFAULT NULL`
- View `event_inquiries` neu erstellen mit `ev.payment_method` und `ev.invoice_due_days`
- Update-Trigger `event_inquiries_update_trigger` erweitern: `payment_method` und `invoice_due_days` nach `v2_events` durchschreiben
- Insert-Trigger `event_inquiries_insert_trigger` erweitern: neue Felder bei Anlage übernehmen
- RPC `get_public_offer` ist bereits aktualisiert (Zeile 34-35), liest aber aus der View — funktioniert automatisch nach View-Update

## Schritt 2 — "Verbindlich buchen"-Flow (Backend)

Für `on_site` und `invoice_after` gibt es keinen Stripe-Checkout. Stattdessen:

- Neuer RPC `confirm_offline_booking(p_inquiry_id uuid, p_selected_option_id uuid)`:
  - Setzt `offer_phase = 'confirmed'` und `status = 'confirmed'`
  - Erstellt Activity-Log-Eintrag
  - Gibt `{success: true}` zurück
- PublicOffer ruft diesen RPC auf statt Stripe

## Schritt 3 — PublicOffer Frontend anpassen

- `handleConfirmBooking()` Funktion: ruft `confirm_offline_booking` RPC auf
- Nach Erfolg: Confirmation-State anzeigen (wie nach Zahlung)
- Bestehende `isStripePayment`-Logik ist bereits korrekt implementiert

## Schritt 4 — Edge Function Guard verifizieren

- `create-payment-session` blockiert bereits `on_site`/`invoice_after` — nur prüfen ob es nach DB-Fix korrekt die Daten liest

## Dateien

| Datei | Änderung |
|---|---|
| Migration (neu) | v2_events Spalten, View, Trigger, RPC |
| `src/pages/PublicOffer.tsx` | `handleConfirmBooking` mit RPC-Aufruf |
