
# Zahlungsart pro Anfrage — 4 Optionen

## Was sich ändert

Aktuell gibt es im `PaymentTermsBlock` nur numerische Felder (Anzahlung %, Frist, Gültigkeit). Es fehlt die Auswahl **wie** bezahlt wird. Wir fügen ein neues Feld `payment_method` zur Inquiry hinzu mit 4 klar verständlichen Optionen:

| Zahlungsart | Beschreibung | Verhalten |
|---|---|---|
| **Anzahlung + Online** | Teilzahlung vorab per Stripe, Rest vor Event | Deposit-Felder aktiv (%, Frist) |
| **Vorauszahlung Online** | 100 % vorab per Stripe | Deposit = 100 %, Frist-Feld aktiv |
| **Vor Ort bezahlen** | Zahlung während des Events | Deposit-Felder ausgeblendet |
| **Rechnung im Nachgang** | Rechnung nach dem Event | Deposit-Felder ausgeblendet, Zahlungsfrist-Feld sichtbar |

## Technische Umsetzung

### 1. Datenbank-Migration
- Neue Spalte `payment_method` (text, nullable, default `'deposit_online'`) auf der Inquiries-Tabelle
- Erlaubte Werte: `deposit_online`, `prepayment_online`, `on_site`, `invoice_after`

### 2. PaymentTermsBlock erweitern
- Oben im Block: 4 große, klar beschriftete Radio-Kacheln (Icons + Text) zur Auswahl der Zahlungsart
- Darunter: bedingte Felder je nach Auswahl
  - `deposit_online`: Anzahlung %, Frist, Gültigkeit (wie bisher)
  - `prepayment_online`: Nur Frist + Gültigkeit (Anzahlung fix 100 %)
  - `on_site`: Nur Gültigkeit
  - `invoice_after`: Zahlungsfrist (neues Feld `invoice_due_days`) + Gültigkeit

### 3. Types aktualisieren
- `ExtendedInquiry` um `payment_method` erweitern
- Neues Feld `invoice_due_days` (nullable number) für Rechnungsfrist

### 4. OfferBuilder / Public Offer
- Zahlungsart im Angebot und in der Kunden-Ansicht anzeigen
- Bei "Vor Ort" und "Rechnung": kein Stripe Payment Link generieren

## UX-Design

Die 4 Kacheln werden prominent im PaymentTermsBlock dargestellt — große Touch-Targets, verständliche Beschreibung, passendes Icon pro Option. Die Detail-Felder darunter passen sich dynamisch an die gewählte Zahlungsart an (kein unnötiges UI).
