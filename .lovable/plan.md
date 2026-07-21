## Beobachteter Fall (Speranza GmbH, Event `dfa42faf`)

Der Datensatz erfüllt zwei Vorbedingungen der Edge Function `admin-send-cost-acceptance` **nicht**:

| Prüfung | Ist-Zustand | Erwartet |
|---|---|---|
| Kunden-Mobilnummer (`v2_customers.phone`) | `2466` (4 Ziffern) | 7–20 Ziffern (`isPlausibleMobile`) |
| Rechnungsadresse (Event ODER Kunde) | Straße/PLZ/Ort überall `NULL` | Straße + PLZ/Ort gesetzt |
| Betrag | Event `amount_total` `NULL`, aber Offer-Option A = 690,00 € ✓ | ok |

Die Function antwortet daher mit `409` und einer klaren deutschen Fehlermeldung. In der UI (`CostAcceptanceCard.onAdminSend`) wird dieser Fehler zwar per `toast.error` ausgegeben, aber der Button zeigt fast keinen Loading-State (Request ist sehr kurz) und der Text „passiert nichts" deutet darauf hin, dass die 409-Antwort im Toast entweder nicht sichtbar oder zu generisch (`"Edge Function returned a non-2xx status code"`) landet — dann bleibt für den Nutzer wirklich „nichts passiert".

## Ziel

1. Den Versand für den aktuellen Test-Datensatz möglich machen, ohne Validierung aufzuweichen.
2. Fehlerfälle sichtbar machen, damit „nichts passiert" nie wieder auftritt.

## Änderungen

### 1) Fehler-Surfacing in `CostAcceptanceCard.tsx`
- `onAdminSend`: bei Fehler nicht nur `toast.error(message)` (kann bei `supabase.functions.invoke`-Fehler generisch sein), sondern **immer** die `error`-Message aus dem 409-JSON verwenden (bereits vorhandener `call()`-Parser bevorzugen) — Fallback nur wenn wirklich leer.
- Toast mit **längerer Anzeigedauer** (`duration: 8000`) und `description` mit Handlungshinweis (z. B. „Bitte Kundenprofil oder Firmenadresse an der Anfrage vervollständigen").
- Button-Loading: `busy === "admin-send-cost-acceptance"` wird gesetzt, aber die Function kann in < 200 ms 409 zurückgeben. Zusätzliches optisches Feedback: bei Fehler kurz einen roten Inline-Hinweis unter dem Button rendern (State `lastSendClientError`), damit der Grund direkt neben dem Button steht — nicht nur als Toast.

### 2) Präventive Client-Vorprüfung (kein Silent-Fail)
Vor `call("admin-send-cost-acceptance", …)` das lokal bekannte Event/Customer-Objekt prüfen:
- Kunde vorhanden, `email` gültig, `phone` mit ≥ 7 Ziffern
- Rechnungsadresse: Event `company_street` + (`company_postal_code` ODER `company_city`) ODER (bei `billing_address_different`) Billing-Felder, sonst Kundenprofil-Adresse

Fehlt etwas → **kein** Request, sondern sofort ein sprechender Toast + Inline-Hinweis mit konkret fehlenden Feldern (z. B. „Mobilnummer im Kundenprofil zu kurz (2466). Bitte mit Ländervorwahl und mind. 7 Ziffern hinterlegen.").

### 3) Edge Function `admin-send-cost-acceptance` — nur robusteres Error-Payload
Kein Verhalten ändern, nur zusätzliche Felder im 409-Response:
```json
{ "error": "…", "field": "signer_mobile" | "invoice_address" | "amount" | "event_date" | "guest_count" }
```
Damit die UI gezielt die betroffene Sektion (Kundenprofil / Firmenadresse) hervorheben kann.

### 4) Keine Änderung an
- eSignatures-Client, Template-Logik, Payment-Terms, Idempotenz.
- RLS, DB-Schema, Cron.

## Test / Verifikation (nach Implementierung)

Mit dem Speranza-Testdatensatz (`dfa42faf`) manuell:
1. Ohne Änderung am Kunden → Klick auf „Kostenübernahme an Kunden schicken" muss **sofort** einen sichtbaren Fehler „Kunden-Mobilnummer zu kurz" bringen (Toast + Inline).
2. Mobilnummer im Kundenprofil auf `+49 170 1234567` setzen → erneut klicken → Fehler „Rechnungsadresse fehlt".
3. Firmenadresse an der Anfrage pflegen → Versand geht durch, `cost_acceptances`-Row mit `status='sent'` und `esignatures_contract_id` entsteht.

Kein Deploy ohne deine Freigabe — Änderungen laufen auf `fix/maestro-handoff-recovery-and-refund`.
