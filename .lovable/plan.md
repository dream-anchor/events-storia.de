

# Audit: „Zahlung anlegen" — Befund + Empfehlung

## Komponente
`AddPaymentDrawer.tsx` (Slide-Out aus `PaymentCard` im Inquiry-Editor) → DB-Insert in `event_payments` → optional `create-event-payment-session` (Stripe) + `send-payment-email` (Resend).

## Funktioniert grundsätzlich? Ja

Architektur und Datenfluss sind sauber. Drei Live-Beispiele aus der DB belegen, dass der Flow vollständig funktioniert (Anzahlung 500 € + Restzahlung 1.380 € am 08.04. — beide haben `stripe_payment_link_url` und `email_sent_at = true`, Status `overdue` → Stripe-Link wurde generiert, E-Mail versendet, später mangels Zahlung in „überfällig" gewechselt).

## Befunde

### 🟢 Gut gelöst
- **Reset bei Open**: Drawer setzt alle Felder beim Öffnen zurück.
- **Live-Berechnung Fälligkeitsdatum** aus „X Tage vor Event" wird unter dem Eingabefeld angezeigt.
- **Schnellwahl 25 % / 50 % / Rest** rechnet inklusive `paidSoFar`-Abzug korrekt.
- **Idempotenz-fester Flow**: Auch wenn E-Mail-Versand scheitert, bleibt der Datensatz bestehen — Toast „Zahlung angelegt, E-Mail-Versand fehlgeschlagen" erscheint, kein Datenverlust.
- **Stripe-Session ohne `payment_method_types`** → Karte / SEPA / Billie automatisch verfügbar; Billing-Address ist `required` (für Billie B2B-Bonität nötig). 23 h Gültigkeit unter Stripe-Limit.
- **23 Stripe-Test-Karten** würden funktionieren (`4242 4242 4242 4242`).

### 🟡 Kleine Schwächen (nicht blockierend)

| # | Befund | Auswirkung | Fix-Aufwand |
|---|---|---|---|
| 1 | **Typ "Endabrechnung" fehlt im Drawer.** UI bietet nur `deposit` + `prepayment`, obwohl `payment_type` auch `final` kennt (siehe `event_payments_enriched`-View und `send-payment-email`-Labels). | Admin kann Schluss­rechnung nicht über diesen Drawer anlegen. Workaround: derzeit nur `deposit`/`prepayment` möglich. | 5 Zeilen |
| 2 | **Sofort-Option ohne sichtbaren Effekt**: `dueType === 'immediate'` setzt weder `due_date` noch `due_days_before_event`. Liste zeigt dann „kein Fälligkeitsdatum". | Kunde bekommt zwar den Link sofort per E-Mail, aber im Maestro fehlt die Fälligkeit für Reminder-Logik. | trivial — z. B. `due_date = today` setzen |
| 3 | **Validation fehlt für `dueType === 'date'` ohne gewähltes Datum**: kein Toast, Insert geht durch mit `due_date = NULL`. Auch `dueType === 'days'` mit leerem `dueDays` → still NULL. | Stille Daten-Lücke. | 3 Zeilen |
| 4 | **Schnellwahl überschreibt manuelle Eingabe ohne Warnung**, kein Undo. | Mini-CX. | 1 Zeile |
| 5 | **Test-Sicherheit nicht im Drawer sichtbar**: Drawer zeigt nicht, ob die Inquiry `is_test=true` ist. E-Mail wird via `getSafeRecipientEmail` umgeleitet, aber Admin sieht den Test-Status nicht im Drawer. | Verwirrung möglich. | Test-Badge oben rechts |
| 6 | **Betrag > Restbetrag** wird ohne Warnung akzeptiert (`restCents` kann negativ werden, Anzeige bleibt). | Überzahlung still möglich. | 2 Zeilen Hinweis |
| 7 | **`amountCents <= 0`-Toast** ist generisch; bei 0,00 € sinnvoller wäre „Betrag muss > 0 sein". | Mini-CX. | 1 Zeile |
| 8 | **Doppel-Klick-Schutz** auf „Zahlung anlegen" greift erst nach `setIsSubmitting(true)`, was korrekt ist — aber kein React-Form, kein `Enter`-Submit. | Tastatur-UX. | optional |

### 🔴 Echte Bugs — keiner gefunden
Der Flow ist produktionsreif.

## Live-E2E-Test — Risiko & Bestätigung nötig

Die Inquiry aus dem Screenshot (`Antoine Monot`, antoine@monot.com, Event 12.03.2026) ist in der DB mit **`is_test = false`** geflaggt. Heißt:
- Stripe-Test-Modus hängt davon ab, ob `STRIPE_SECRET_KEY` in der Umgebung der Edge-Function ein Test-Key ist (`sk_test_…`) oder Live-Key (`sk_live_…`).
- Mit `is_test=false` würde `getSafeRecipientEmail` die E-Mail an die echte Adresse `antoine@monot.com` senden (deine Adresse, also OK), und Stripe-Webhook würde bei Live-Key in `lexoffice_invoice` einlaufen.

**Vorschlag:** Vor dem E2E-Test setzen wir die Inquiry temporär auf `is_test=true` (oder du bestätigst). Dann läuft der Test:

1. **AddPaymentDrawer**: Anzahlung 50 € (Stripe-Test-Karte 4242…) → DB-Insert + Stripe-Session + E-Mail an `antoine@monot.com` (Test-Modus → Subject mit „[TEST]"-Präfix).
2. **Stripe-Webhook**: nach Test-Zahlung mit Karte `4242 4242 4242 4242` → `payment.status = paid`, `paid_via`, `lexoffice_invoice_id` gesetzt.
3. **LexOffice-Rechnung**: Sichtbar im Inquiry.
4. **Logs**: Edge-Function-Logs von `create-event-payment-session`, `send-payment-email`, `handle-stripe-webhook` mitlesen.

## Empfohlene Mini-Fixes (eine Datei, ~25 Zeilen)

In `AddPaymentDrawer.tsx`:

1. **„Endabrechnung" ergänzen**: Typ-Buttons um `final` erweitern (Label „Endabrechnung", Icon 🧾). Persist als `payment_type='final'`.
2. **Sofort-Option fixt Fälligkeit auf heute**: bei `dueType === 'immediate'` → `due_date = format(new Date(), 'yyyy-MM-dd')`, damit Reminder-Logik weiterläuft.
3. **Validierung**: bei `dueType === 'date'` und `!dueDate` → Toast „Bitte Datum wählen". Bei `dueType === 'days'` und leerem/ungültigem `dueDays` → Toast.
4. **Test-Badge**: wenn `inquiry.is_test`, oben in `SheetHeader` ein orangenes „TEST"-Pill anzeigen + Hinweis „E-Mail wird an interne Test-Adresse umgeleitet".
5. **Überzahlungs-Hinweis**: wenn `restCents < 0`, kleiner Inline-Warntext „Betrag übersteigt Restschuld um X €".

## Out-of-scope (bewusst nicht)
- Kein Refactor des Stripe-Webhooks oder der LexOffice-Anbindung.
- Keine Änderung am DB-Schema.
- Keine Änderung am `send-payment-email`-Template (Styling-Memory).

## Was ich brauche
1. **Bestätigung Live-Test**: setze ich die Inquiry auf `is_test=true`, führe den E2E mit Test-Karte durch und logge die Ergebnisse? (Empfohlen.)
2. **Mini-Fixes** (Punkte 1–5 oben) in einer zweiten Runde umsetzen?

