## Ziel
Klare Trennung zwischen **Angebot** (unverbindlich) und **Auftrag/Buchung** (verbindlich) – egal ob mit Anzahlung, Vollzahlung oder Zahlung erst nach dem Event. Auch ohne Online-Zahlung muss der Kunde digital eine **Auftragsbestätigung** abgeben, die rechtlich verbindlich ist.

---

## Aktueller Zustand (Manko)
- `offer_phase`: `draft → proposal_sent → customer_responded → final_draft → final_sent → confirmed → paid`
- Verbindlichkeit entsteht heute faktisch nur über Stripe-Zahlung (`deposit` / `full`).
- Wenn vereinbart wird "Zahlung vor Ort / nach Event", gibt es keinen sauberen Schritt, der den Auftrag rechtsverbindlich auslöst.
- Ein **Angebot** und eine **Buchung** (`event_bookings`) leben in zwei Welten, ohne klaren Übergangsmoment.

---

## Konzept (CX + Recht)

### 1. Drei klare Lebensphasen
```text
ANGEBOT (offer)        → unverbindlich, jederzeit änderbar
   │
   ▼
AUFTRAGSBESTÄTIGUNG    → Kunde nimmt rechtsverbindlich an (Vertragsschluss §145 ff. BGB)
   │
   ▼
BUCHUNG (booking)      → operative Durchführung, Zahlung läuft separat
```

Die **Auftragsbestätigung** ist der juristische Kipppunkt – nicht die Zahlung.

### 2. Drei Akzeptanz-Pfade auf der PublicOffer-Seite
Der Kunde sieht je nach `payment_method` der Inquiry **einen** primären CTA:

| Zahlungsmodus (`payment_method`)    | CTA                                | Auslöser für "verbindlich"           |
|--------------------------------------|------------------------------------|--------------------------------------|
| `deposit_online` / `full_online`    | "Jetzt anzahlen / bezahlen"        | Stripe-Webhook `checkout.completed`  |
| `invoice_after_event`               | "Jetzt verbindlich buchen"         | Klick auf Bestätigungs-Button + Checkbox |
| `pay_on_site`                       | "Jetzt verbindlich buchen"         | wie oben                              |
| `bank_transfer_prepay`              | "Jetzt verbindlich buchen + Überweisen" | Bestätigungs-Button (Zahlung folgt) |

### 3. Verbindliche Bestätigung ohne Zahlung – das Modal
Pflicht-Schritt vor Bestätigung:
- ☐ **Checkbox 1:** "Ich nehme das Angebot in der gezeigten Form rechtsverbindlich an."
- ☐ **Checkbox 2:** "Ich habe die [AGB] und [Stornobedingungen] gelesen und akzeptiere sie."
- ☐ **Checkbox 3 (optional, bei `pay_on_site`):** "Mir ist bekannt, dass der Gesamtbetrag von **X €** vor Ort / nach Veranstaltung fällig ist."
- Eingabefeld: **Vor- und Nachname** (Doppelte Bestätigung der Identität)
- Speicherung: IP, User-Agent, Timestamp, Snapshot der Angebotsversion (rechtssichere Beweisführung).

### 4. Neuer Phasenfluss
```text
draft → proposal_sent → customer_responded → final_sent
                                                │
                                ┌───────────────┼───────────────┐
                                ▼               ▼               ▼
                          deposit_paid    order_confirmed   fully_paid
                                │               │               │
                                └───────────────┴───────┬───────┘
                                                        ▼
                                                   completed
```

Neuer Status: **`order_confirmed`** = verbindlicher Auftrag, Zahlung offen (oder teilweise).

### 5. Daten / Schema-Änderungen (Migration)
Neue Felder auf `event_inquiries` (heute Single-Source-of-Truth):
- `order_confirmed_at` timestamptz
- `order_confirmed_by_name` text  (Klartext-Eingabe Kunde)
- `order_confirmed_ip` text
- `order_confirmed_user_agent` text
- `order_confirmed_version` int  (offer-version snapshot)
- `order_confirmation_terms_version` text  (z.B. "AGB-Catering 2026-05")
- `payment_timing` enum: `prepay_online`, `prepay_transfer`, `deposit_online`, `pay_on_site`, `pay_after_event`

`offer_phase` erweitern um `order_confirmed`.

### 6. Neue Edge Function `confirm-order`
- Input: `inquiry_id`, `selected_option_id`, `customer_name`, `agbs_accepted`, `terms_accepted`, `payment_acknowledged`
- Validiert: alle Checkboxen + Phase = `final_sent`
- Schreibt: alle `order_confirmed_*` Felder, setzt `offer_phase = order_confirmed`, loggt in `activity_logs`
- Sendet:
  - **Mail an Kunden:** "Ihre verbindliche Auftragsbestätigung" inkl. PDF des Angebots-Snapshots + AGB
  - **Mail/WhatsApp an Betreiber:** "Neuer verbindlicher Auftrag"
  - BCC an `info@events-storia.de`
- Erstellt automatisch `event_booking`-Eintrag (Übergang Angebot → Buchung), falls noch nicht vorhanden.

### 7. UI-Änderungen
- **PublicOffer**: Phase `final_sent` → ersetzt CTA-Bereich:
  - Großer Primär-Button "**Jetzt verbindlich buchen**" (öffnet Modal)
  - Sekundär-Buttons (falls online-Zahlung möglich): "Jetzt anzahlen" / "Voll bezahlen"
  - Hinweistext klärt: "Mit Klick auf 'verbindlich buchen' kommt ein rechtswirksamer Vertrag zustande."
- **Phase `order_confirmed`**: zeigt Bestätigungs-Banner, Option zur Zahlung bleibt, falls noch offen.
- **Admin / SmartInquiryEditor**: neuer Reiter / Badge "Auftrag bestätigt am … von …" inkl. IP & Snapshot.
- **Sprachversionen** (DE/EN/IT/FR): alle neuen Strings über `pickLang`.

### 8. Rechtliche Absicherung (Anwalts-Hut)
- Vertragsschluss = Angebot (Storia) + Annahme (Kunde-Klick) → §§145, 147 BGB.
- Beweisbarkeit: Snapshot der Angebotsversion + IP + UA + Name + Timestamp persistent speichern; **niemals nur State im Frontend**.
- AGB-Einbindung muss aktiv (Opt-In Checkbox) sein – kein "vorausgewähltes Häkchen" (BGH-Konform).
- Stornobedingungen explizit verlinken (bereits vorhanden, ggf. anpassen).
- Widerrufsrecht: bei B2C-Veranstaltungsbuchung greift §312g II Nr. 9 BGB (Ausnahme für termingebundene Dienstleistungen) – Hinweistext einbauen.
- PDF mit Versionsnummer + Hash an Kunden mailen.

### 9. Migrationsstrategie für Bestand
- Bestehende `confirmed` Inquiries bleiben gültig (Backfill `order_confirmed_at = updated_at`, `payment_timing` aus altem `payment_method` ableiten).
- Keine Daten löschen.

---

## Implementierungs-Reihenfolge
1. **Migration**: neue Felder + Enum, Backfill.
2. **Edge Function** `confirm-order` (inkl. Mail-Templates DE/EN/IT/FR).
3. **PublicOffer-UI**: neues Modal `OrderConfirmationDialog`, neue CTA-Logik je `payment_timing`.
4. **Admin-UI**: Auftragsbestätigungs-Badge im SmartInquiryEditor + Activity Log.
5. **PDF-Snapshot** generieren & ablegen (Storage-Bucket `order-confirmations/`).
6. **Sync** mit `event_bookings` (Trigger oder im Edge Function).
7. **Tests** (manuell): alle 4 `payment_timing`-Pfade durchspielen.

---

## Offene Fragen
1. **`payment_timing` Standard**: heute existiert `payment_method` (`deposit_online`, …). Sollen wir das bestehende Feld **erweitern** oder ein neues `payment_timing` parallel führen? (Empfehlung: bestehendes `payment_method` umbenennen / mappen.)
2. **PDF-Generierung**: nutzen wir die bestehende `PrintMenu` Pipeline serverseitig (Puppeteer/Edge), oder reicht ein HTML-Snapshot in DB?
3. **Widerrufsrecht-Hinweis**: nur bei B2C zeigen, oder pauschal?
4. **AGB-Versionierung**: aktuelle AGBs haben keine Versionsnummer – einführen?
