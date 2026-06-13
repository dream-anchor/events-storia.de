## Ziel
Public Offer soll die in Maestro gesetzten Zahlungsbedingungen 1:1 anzeigen und verwenden: Anzahlung und Restzahlung getrennt nach Methode, Betrag/Prozent und Fristen. Das gilt für Paket, Menü, KI/Freitext und Mehrfachoptionen.

## Gefundene Ursache
- Maestro speichert inzwischen zwei getrennte Felder: `deposit_method` und `balance_method`.
- Public Offer bekommt diese Felder aktuell nicht aus der Public-Offer-Datenfunktion, sondern nur das alte `payment_method`.
- Bei „Anzahlung: Stripe“ + „Restzahlung: vor Ort“ wird das alte Feld zu `on_site`. Public Offer denkt deshalb: „alles offline“, blendet Stripe-Anzahlung aus und zeigt nur „verbindlich buchen ohne Online-Zahlung“.
- Die Zahlungs-Edge-Function blockiert aus demselben Grund aktuell auch Stripe, sobald das alte `payment_method` auf `on_site` steht.

## Umsetzung

### 1. Public-Offer-Daten vollständig aus Maestro liefern
Migration für `get_public_offer` aktualisieren:
- `deposit_method`
- `balance_method`
- `balance_due_days_before_event`
- weiterhin `deposit_percent`, `deposit_amount`, `deposit_due_days`, `invoice_due_days`, `offer_validity_days`

Damit liest Public Offer die tatsächliche Maestro-Aufteilung statt des Legacy-Fallbacks.

### 2. Frontend-Zahlungsmodell korrigieren
In `src/pages/PublicOffer.tsx`:
- PublicInquiry um `deposit_method`, `balance_method`, `balance_due_days_before_event` erweitern.
- Neue zentrale Hilfslogik für Zahlungsbedingungen einführen:
  - Anzahlung nur, wenn `deposit_method !== 'none'` und Betrag sinnvoll ist.
  - Stripe-Anzahlungsbutton nur, wenn `deposit_method === 'stripe'`.
  - Vollzahlung nur, wenn `balance_method === 'stripe_prepay'` und keine separate Restzahlung vor Ort/Rechnung vorgesehen ist.
  - Offline-Buchung nur dann als Hauptaktion zeigen, wenn keine Online-Zahlung vorgesehen ist.
  - Restzahlungstext korrekt nach Maestro anzeigen: vor Ort, Rechnung vor Event, Rechnung nach Event oder Stripe vorab.
- `computeDeposit` nicht mehr anhand von `payment_method=on_site` abschalten, sondern anhand von `deposit_method`.

### 3. Proposal- und Final-Ansicht angleichen
Für alle Angebotsphasen:
- Bei „Stripe-Anzahlung + Rest vor Ort“: Anzahlung-Button mit 20 % / Betrag anzeigen, darunter Hinweis „Restzahlung vor Ort beim Event“.
- Bei „Keine Anzahlung + Rest vor Ort/Rechnung“: nur verbindlich buchen ohne Online-Zahlung.
- Bei „Keine Anzahlung + Stripe vorab“: Vollzahlung / Vorauszahlung online.
- Bei „Anzahlung Stripe + Rest Stripe vorab“: wie bisher Anzahlung und vollständige Online-Zahlung, aber Beträge aus Maestro.
- Keine Neuberechnung der Angebotssumme außer bestehendem Fallback für fehlende Legacy-Werte; Maestro-Beträge bleiben maßgeblich.

### 4. Stripe-Session-Guard korrigieren
In `supabase/functions/create-payment-session/index.ts`:
- Guard auf `deposit_method`/`balance_method` umstellen.
- `paymentType='deposit'` erlauben, wenn `deposit_method === 'stripe'`, auch wenn `balance_method === 'on_site'` ist.
- `paymentType='full'` nur erlauben, wenn die Rest-/Vollzahlung tatsächlich online vorgesehen ist (`balance_method === 'stripe_prepay'` oder Legacy-Online-Fallback).
- Fehlertexte passend machen, falls ein nicht vorgesehener Zahlungstyp aufgerufen wird.

### 5. Regressionsfälle prüfen
Nach Umsetzung prüfen:
- Das gezeigte DataGuard-Angebot zeigt 25.000,00 € brutto, Anzahlung 20 % = 5.000,00 €, Restzahlung vor Ort beim Event.
- KI/Freitext-Angebote verwenden weiter `total_amount` bzw. `freeformProgram.totalsFromText.gross` als Fallback.
- Paket-/Menüangebote mit Preis pro Person behalten korrekte Gesamtbeträge.
- Keine-Anzahlung/offline zeigt keine Stripe-Buttons.
- Stripe-Vorauszahlung zeigt nur Online-Zahlung.
- Anzahlung + Restzahlung werden nicht durch Public Offer neu gerundet oder überschrieben.