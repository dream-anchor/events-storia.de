
## Teil A — Audit der letzten 14 Tage

### A.1 Anfragen / Bestellungen im System

In `v2_events` sind in den letzten 14 Tagen **20 Datensätze** angelegt worden (alle erscheinen also im System). Verteilt nach Quelle:

- `website` (Event-Anfrageformular): 5
- `catering_form`: 4 (3 echte bezahlte Bestellungen + 1 Test)
- `reisegruppen`: 4
- `manual` (im Maestro angelegt): 7 (davon 2 als `is_test=true` markiert)

Zusätzlich in den Legacy-/Sekundärtabellen (werden parallel von alten Edge Functions geschrieben, sollten konsistent sein):

- `event_inquiries`: 13 neu
- `catering_orders`: 3 neu
- `event_bookings`: 1 neu
- `v2_payments` / `event_payments`: je 4 neu

**Befund:** Es gibt **keine "verwaisten" Datensätze**, die in der DB liegen, aber nicht im Maestro auftauchen würden. Jede Anfrage/Bestellung der letzten 14 Tage existiert mit Customer-Verknüpfung in `v2_events`.

Einziges Auffälliges:
- 2 `reisegruppen`-Einträge vom 12.05. mit Status `offer_draft` und gleicher Mail (Tom Test) — sieht nach Doppel-Submit aus, beide echt in der Tabelle.
- 2 manuelle Test-Einträge mit `is_test=true` werden je nach Filter in der UI ausgeblendet.

### A.2 Benachrichtigungen an Betreiber & Kunden

`email_delivery_logs` für die letzten 14 Tage gegen die `v2_events`-Liste gemappt:

| Datum | Quelle | Kunde-Mail | Betreiber-Mail | WhatsApp |
|---|---|---|---|---|
| 22.05. 07:35 Mimmo (website) | ✅ | ✅ | ❌ "WhatsApp not configured" |
| 22.05. 07:34 Mimmo (manual, paid) | — keine Mail-Logs | — | — |
| 19.05. neo-kanzlei (website) | ✅ | ✅ | ❌ "WhatsApp not configured" |
| 19.05. Anna Besyakova (manual, paid) | — keine Mail-Logs | — | — |
| 18.05. Test2 reisegruppen | — keine Mail-Logs | — | — |
| 16.05. CAT-...-530 (catering_form, bezahlt) | ✅ | ✅ | ❌ |
| 15.05. CAT-...-321 (catering_form, bezahlt) | ✅ | ✅ | ❌ |
| 14.05. Fardo, Agnese, Mimmo (website) | ✅ | ✅ | ❌ |
| 14.05. Ida Lucca (manual, cancelled) | — keine Mail-Logs | — | — |
| 13.05. Jessica Lagourrès (manual, paid) | nur Angebots-Mails ab 15.05. | — | — |
| 13.05. rachele ruggeri (website, paid) | (zu prüfen, oberhalb des Truncate) | | |
| 12.05. Tom Test reisegruppen ×2 | — | — | — |
| 12.05. Test reisegruppen | — | — | — |
| 11.05. Mimmo website | ✅ | ✅ | ❌ |

**Befunde Notifications:**

1. **`source = 'manual'` löst keine Benachrichtigung aus.** Korrekt designed (man legt im Admin selbst an), aber: bei `status = 'paid'` manuell angelegt (Anna 19.05., Jessica 13.05.) gibt es **keine Zahlungsbestätigung an den Kunden**. Das ist eine Lücke — sobald wir "paid" setzen, sollte zumindest optional die LexOffice-Rechnung + Bestätigungsmail rausgehen (passt zum laufenden Anzahlungs/Schlussrechnungs-Thema).
2. **`source = 'reisegruppen'` (Tom Test, Test, Test2) versendet aktuell gar keine Mail** — weder an Kunde noch Betreiber. Das ist ein echter Bug: 4 Reisegruppen-Anfragen in 14 Tagen, 0 Logs.
3. **WhatsApp-Alarm schlägt seit Tagen fehl** mit `WhatsApp not configured` (Meta API Credential fehlt/abgelaufen). Trifft alle 4 Inquiry-Pfade.
4. Die Betreiber-Mail (`info@events-storia.de, d.speranza@storia-muenchen.de`) bei `Kundenantwort` wird mit Status `bounced` geloggt (mehrere Treffer am 15.05./22.05.) — Resend lehnt die kommaseparierte Adressliste in einem Feld ab, müsste als Array übergeben werden.

### A.3 Maßnahmen Teil A

1. `process-new-inquiry` / Reisegruppen-Flow: Notification-Hook hinzufügen (Kunden-Confirmation + Betreiber-Alert + Logging in `email_delivery_logs`), analog zu `website`/`catering_form`.
2. Bei `manual`-Anlage mit `status = 'paid'`: optionalen Schalter "Bestätigung + Rechnung an Kunde senden" im AddPaymentDrawer aktivieren (greift bestehende `create-lexoffice-downpayment-invoice` / `…-final-invoice` Pipelines aus dem letzten Schritt).
3. WhatsApp-Versand: `WHATSAPP_*` Secret-Status prüfen, sonst stillschweigend skippen (kein "failed"-Log) bis Credentials wieder gesetzt sind.
4. Kundenantwort-Notification: Empfängerliste als Array `["info@…", "d.speranza@…"]` an Resend übergeben, nicht als ein String mit Komma.

## Teil B — Mobile-Fehler "Can't find variable: Temporal"

### Ursache

`src/main.tsx` macht `import "@js-temporal/polyfill"`. Aber `@js-temporal/polyfill@0.5.1` ist **kein Auto-Side-Effect-Polyfill** — das Paket exportiert `Temporal` als Named Export und setzt `globalThis.Temporal` **nicht** selbst. Auf Desktop-Chrome funktioniert es trotzdem, weil V8 bereits experimentelles `Temporal` hat; auf iOS Safari und älteren Android-WebViews fehlt es ⇒ `@schedule-x/calendar` knallt mit `Can't find variable: Temporal`.

Im polyfill-Bundle (`dist/index.esm.js`) ist auch kein `globalThis.Temporal = …` Statement (verifiziert).

### Fix

`src/main.tsx`:

```ts
import { Temporal, Intl as TemporalIntl, toTemporalInstant } from "@js-temporal/polyfill";

if (typeof globalThis.Temporal === "undefined") {
  // @ts-expect-error – Temporal ist im TS-Lib noch nicht enthalten
  globalThis.Temporal = Temporal;
  // @ts-expect-error – toTemporalInstant auf Date.prototype anhängen
  Date.prototype.toTemporalInstant = toTemporalInstant;
}
```

`@ts-expect-error` Kommentare, weil `globalThis.Temporal` in den eingebundenen TS-Libs nicht typisiert ist.

### Validierung

1. Build durchlaufen lassen.
2. Mobile-Preview öffnen → `/maestro` Route lädt ohne ErrorBoundary "Admin konnte nicht geladen werden".
3. Console-Check: `typeof globalThis.Temporal === "object"`.

## Out of Scope (separate Runde)

- Echte Backfill-Mails für die 7 manuell angelegten Vorgänge der letzten 14 Tage.
- LexOffice-Integration für `source='manual'`-Zahlungen.
- Renaming/Cleanup der parallelen Legacy-Tabellen (`event_inquiries`, `catering_orders`, `event_bookings`) zugunsten von `v2_events` als Single Source.
