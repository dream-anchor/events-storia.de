## Problem

Du findest die Auftragsbestätigung nicht, weil **die Zahlungsart-Werte im Admin und auf der Public-Offer-Seite nicht zusammenpassen**. Die letzte Implementierung verwendet neue Werte, die im UI gar nicht auswählbar sind.

| Stelle | Erwartete Werte |
|---|---|
| `PaymentTermsBlock` (Admin-Auswahl) | `deposit_online`, `prepayment_online`, **`on_site`**, **`invoice_after`** |
| `PublicOffer.tsx` (neue Logik) | `deposit_online`, `full_online`, **`pay_on_site`**, **`invoice_after_event`**, `bank_transfer_prepay` |

→ Egal welche Kachel du im Admin anklickst, die `OrderConfirmationDialog`-Logik triggert nie, weil sie auf die falschen Strings prüft. Außerdem ist im Admin nirgends sichtbar, *welcher Kunden-Flow* gerade aktiv ist.

## Plan

### 1. Werte vereinheitlichen (Single Source of Truth)
- Wir bleiben bei den **vorhandenen DB-Werten** (`deposit_online`, `prepayment_online`, `on_site`, `invoice_after`) — keine Migration nötig, keine Bestandsdaten zerstören.
- `PublicOffer.tsx` (Mapping `offlineTiming`) auf diese 2 offline-Werte umschreiben:
  - `on_site` → "vor Ort am Veranstaltungstag"
  - `invoice_after` → "per Rechnung nach der Veranstaltung"
- `bank_transfer_prepay` entfällt vorerst (kann später als 5. Kachel ergänzt werden).

### 2. Bestehenden „leichten" Buchungsflow durch den rechtssicheren Dialog ersetzen
In `ProposalView.tsx` (Zeile ~201–290) gibt es bereits einen Verbindlich-buchen-Button für `on_site` / `invoice_after` — der schreibt aber nur eine Notiz, ohne die §145-BGB-Beweissicherung (3 Checkboxen, Name, IP, UA, Snapshot-Version). Wir ersetzen diesen Button durch den **`OrderConfirmationDialog`**, der die Edge Function `confirm-order` aufruft. Dasselbe für `FinalOfferView`.

### 3. Sichtbares Indiz im Admin (deine eigentliche Frage)
In `PaymentTermsBlock` direkt unter der Zahlungsart-Auswahl und der Summary einen **Hinweis-Badge** ergänzen, z.B.:

```text
┌────────────────────────────────────────────────────┐
│ ⓘ  Kunde sieht „Verbindlich buchen ohne          │
│    Online-Zahlung" — verbindliche Auftrags-       │
│    bestätigung mit AGB-Zustimmung & Beweis-       │
│    sicherung (IP, Zeit, Name, Angebotsversion).   │
└────────────────────────────────────────────────────┘
```
- Erscheint **nur** wenn `payment_method ∈ {on_site, invoice_after}`.
- Bei `deposit_online` / `prepayment_online`: anderer Hinweis "Kunde zahlt direkt per Stripe — keine separate Auftragsbestätigung nötig".

### 4. Wo du es dann findest (User-Anleitung)
1. `/admin/inquiries` → eine Anfrage öffnen
2. Im OfferBuilder bis zum Block **„Zahlungs-Konditionen"** scrollen
3. Eine der Kacheln **„Vor Ort"** oder **„Rechnung"** anklicken
4. Sofort erscheint darunter der grüne Hinweis "Kunde sieht Auftragsbestätigung"
5. Angebot senden → der Kunde sieht auf der Public-Offer-Seite den Button **„Verbindlich buchen"**, der den 3-Checkboxen-Dialog öffnet

## Technische Details

**Geänderte Dateien (keine DB-Migration):**
- `src/pages/PublicOffer.tsx` — `offlineTiming`-Mapping (2 Stellen, ~Z. 851 & 1416) auf existierende Werte
- `src/pages/public-offer/ProposalView.tsx` — bestehende Inline-Buchung durch `OrderConfirmationDialog` ersetzen
- `src/pages/public-offer/FinalOfferView.tsx` — gleiche Anpassung
- `src/components/admin/refine/InquiryEditor/PaymentTermsBlock.tsx` — Hinweis-Badge unter den Kacheln
- `supabase/functions/confirm-order/index.ts` — `payment_timing`-Mapping anpassen (nur 2 Werte: `on_site`, `after_event`)

**Keine Änderungen an:** Schema, Migrations, `confirm-order`-Auth, OrderConfirmationDialog selbst.

## Offene Frage

Soll ich zusätzlich die alte „leichte" Buchungslogik aus `ProposalView` (die nur eine Customer-Notiz schreibt) **komplett entfernen**, sodass es nur noch den rechtssicheren Dialog gibt? Empfehlung als Anwalt: **Ja**, weil die alte Variante keine AGB-Zustimmung dokumentiert und damit nicht beweistauglich ist.