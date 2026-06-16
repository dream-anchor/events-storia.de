# Kostenübernahme — Technischer Testplan & Go-Live-Checkliste

Stand: Schritt 10 des Maestro-Kostenübernahme-Plans.
Dieses Dokument bündelt die Abnahmefälle für den eSignatures-basierten
Kostenübernahme-Flow. Es ist bewusst als manuell ausführbarer Testplan
formuliert, weil im Repo aktuell keine Test-Infrastruktur für Vitest /
Jest / Playwright und keine Deno-Test-Suite für die Edge Functions
existiert (siehe Abschnitt „Test-Infrastruktur").

---

## Test-Infrastruktur (Bestandsaufnahme)

- **Frontend:** `package.json` enthält keine Test-Runner-Skripte
  (kein `vitest`, `jest`, `playwright`). Verfügbar: `npm run build`,
  `npm run lint` (ESLint).
- **Edge Functions:** keine `*_test.ts` / `*.test.ts` Dateien unter
  `supabase/functions/**`. Es existiert lediglich ein Hilfsmodul
  `supabase/functions/_shared/test-safety.ts` (Production-Guards).
- **Konsequenz:** In Schritt 10 werden **keine** neuen Test-Frameworks
  eingeführt. Die nachfolgenden Fälle werden manuell durchgespielt.
  Empfehlung für später: Vitest für reine Validator-/Helper-Funktionen
  (E-Mail-/Mobil-Validierung, `extractTemplateId`, `extractContract`,
  `extractErrorDetail`) sowie Deno-Tests für den HMAC-Guard im Webhook.

---

## A. Setup-Prüfung

| # | Prüfung | Erwartung |
|---|---------|-----------|
| A1 | `ESIGNATURES_API_KEY` in Edge-Function-Secrets gesetzt | Wert vorhanden |
| A2 | `ESIGNATURES_WEBHOOK_SECRET` gesetzt **oder** bewusst leer | leer = Kompatibilitätsmodus, gesetzt = HMAC erzwungen |
| A3 | Template via `create-esignatures-cost-acceptance-template` initialisiert | Template-ID in `site_settings` / Config gespeichert |
| A4 | `sync-esignatures-template` läuft fehlerfrei | Response enthält gültige `template_id`, kein `undefined` wird persistiert |
| A5 | Storage-Bucket `cost-acceptances` existiert und ist privat (`public = false`) | Listing im Storage zeigt private Lock-Anzeige |
| A6 | Download-Function `download-signed-cost-acceptance` ist auth-geschützt | Aufruf ohne JWT → 401/Error |

---

## B. Public-Flow (Kunde)

| # | Schritt | Erwartung |
|---|---------|-----------|
| B1 | Public Offer per Slug öffnen | `CostAcceptanceSection` lädt initialen Status (`form` / `signing` / `signed` / `inactive`) |
| B2 | Formular ausfüllen, Pflichtfelder leer lassen → absenden | Inline-Fehler, kein Server-Call |
| B3 | Pflicht-Checkbox „Kostenübernahme bestätigen" nicht setzen | Submit blockiert |
| B4 | Ungültige E-Mail (`foo@bar`) | Validierung schlägt fehl |
| B5 | Ungültige Mobilnummer (`123`) | Validierung schlägt fehl |
| B6 | Maestro-Betrag = 0 € auf der Option | `create-cost-acceptance-from-public-offer` liefert Fehler; keine Pending-Row mit 0 € |
| B7 | Manipulierte / fremde `offer_option_id` | Server validiert Zugehörigkeit zur Inquiry und lehnt ab |
| B8 | Gültiges Formular abschicken | Pending-Row angelegt, eSignatures-Contract erzeugt, iframe wird angezeigt |
| B9 | Browser-Reload während Signatur | `get-public-cost-acceptance-state` liefert bestehenden Status, iframe erscheint wieder, kein neues Pending |
| B10 | Fallback-Link „In neuem Tab öffnen" klicken | `sign_page_url` öffnet eSignatures-Seite in neuem Tab |
| B11 | Erneutes Absenden nach bereits gestarteter Signatur | UI bleibt im `signing`-Status, keine Doppelerstellung |

---

## C. Admin-Mailversand

| # | Schritt | Erwartung |
|---|---------|-----------|
| C1 | In `CostAcceptanceCard` „Per E-Mail senden" klicken | `send-cost-acceptance-email` läuft, Toast „erfolgreich" |
| C2 | DB-Felder prüfen | `sent_at`, `sent_to`, `send_count = 1` gesetzt |
| C3 | Erneut senden | `send_count` zählt hoch, `sent_at` aktualisiert |
| C4 | Versand ohne `sign_page_url` (z. B. fehlgeschlagene Vertragsanlage) | Button blockiert / Fehler-Meldung auf Deutsch |
| C5 | Versand bei Status `signed` / `withdrawn` / `cancelled` / `expired` | Button blockiert |
| C6 | SMTP-Fehler simulieren (z. B. Resend-Key invalidieren) | `last_send_error` wird in Admin sichtbar, deutsche Fehlermeldung |

---

## D. Webhook (`esignatures-webhook`)

| # | Event | Erwartung |
|---|-------|-----------|
| D1 | `contract-sent-to-signer` | Status → `sent` (sofern nicht bereits höher) |
| D2 | `contract-viewed` / `signer-viewed` | Status → `viewed` |
| D3 | `contract-signature-started` | Status → `signature_started` |
| D4 | `signer-signed` | Status → `signer_signed` |
| D5 | `contract-signed` **mit** `contract_pdf_url` | PDF im Bucket abgelegt, Status → `signed`, Offer gelockt, Activity-Log-Eintrag `cost_acceptance_signed` |
| D6 | `contract-signed` **ohne** `contract_pdf_url` | Status → `signed_pending_pdf`, `signed_pdf_pending = true`, Offer trotzdem gelockt |
| D7 | PDF-Download wirft Fehler (URL liefert 500) | Status → `signed_pending_pdf`, `pdf_download_attempts` inkrementiert, `pdf_download_last_error` & `last_webhook_error` gesetzt, HTTP 200 (kein Retry-Sturm) |
| D8 | Späteres `contract-signed` mit PDF nach D6/D7 | Status hebt auf `signed`, Error-Felder werden `null`, kein doppelter Activity-Log |
| D9 | Niedrigeres Event (z. B. `viewed`) nach `signed` | Wird ignoriert, kein Downgrade |
| D10 | `ESIGNATURES_WEBHOOK_SECRET` gesetzt, Header fehlt | **401** Missing signature |
| D11 | `ESIGNATURES_WEBHOOK_SECRET` gesetzt, falscher Header | **401** Bad signature |
| D12 | `ESIGNATURES_WEBHOOK_SECRET` nicht gesetzt | Webhook akzeptiert (Kompatibilitätsmodus), nichts wird geloggt was Secret leaken könnte |

---

## E. PDF / Storage

| # | Prüfung | Erwartung |
|---|---------|-----------|
| E1 | Nach D5: Pfad `cost-acceptances/{acceptanceId}/signed.pdf` existiert | Datei vorhanden, Content-Type `application/pdf` |
| E2 | Bucket-Eigenschaften | `public = false`, MIME auf `application/pdf` beschränkt, Größenlimit 25 MB |
| E3 | Admin-Download via `download-signed-cost-acceptance` | 5-Min-Signed-URL, Download startet |
| E4 | Direkter anon-Zugriff auf `…/object/public/cost-acceptances/...` | 400/404, kein Inhalt |
| E5 | Direkter anon-Zugriff via REST-API ohne JWT | abgelehnt (keine Storage-Policy für `anon` / `authenticated`) |

---

## F. Locking nach Signatur

| # | Prüfung | Erwartung |
|---|---------|-----------|
| F1 | `v2_events.locked_after_signature = true` nach D5/D6 | gesetzt |
| F2 | Offer-Tab im Admin zeigt Lock-Banner | sichtbar |
| F3 | Preise / Optionen im `OfferBuilder` | dimmed, `pointer-events-none` |
| F4 | Menüs/Pakete editierbar? | nein |
| F5 | Datum / Gästezahl / Adressen (`EventDNACard`, `LocationBlock`) | `isReadOnly`, nicht editierbar |
| F6 | Rechnungsdaten | nicht editierbar |
| F7 | Interne Notizen, Tasks, Assignee | weiterhin editierbar |
| F8 | `CostAcceptanceCard` (Versand, Status, Download) | weiterhin bedienbar |
| F9 | „Erneut senden" auf gelocktem Offer | blockiert mit Hinweis „neue Version erstellen" |

---

## G. Regression

| # | Bereich | Erwartung |
|---|---------|-----------|
| G1 | Public-Offer Zahlungsflow (Stripe Anzahlung / Restzahlung) | unverändert |
| G2 | „Angebot senden" bei **nicht** gesperrten Angeboten | unverändert |
| G3 | LexOffice-Rechnungserstellung nach Stripe-Payment | unverändert |
| G4 | E-Mail-Historie / Mails-Tab | unverändert |
| G5 | KI-Draft & `OfferBuilder` bei nicht gesperrten Angeboten | unverändert |
| G6 | Catering- & Restaurant-Bookings | unverändert |
| G7 | Webhook bei Inquiries ohne `metadata` (Acceptance-ID) | wird ignoriert (`{ok:true, ignored:true}`) |

---

## H. Automatisierte Tests

- **Aktueller Stand:** Keine automatisierten Tests in Schritt 10
  ergänzt, weil weder Vitest/Jest/Playwright noch Deno-Tests im Repo
  etabliert sind. Ein Test-Setup wäre ein größerer Umbau, der gemäß
  Schritt-10-Scope ausgeschlossen ist.
- **Empfohlene spätere Automatisierung (außerhalb dieses Schritts):**
  - Vitest-Unit-Tests für reine Pure-Functions: E-Mail-/Mobil-/Pflicht­feld-
    Validierung (`CostAcceptanceSection`), `extractTemplateId`,
    `extractContract`, `extractErrorDetail`.
  - Deno-Test für den HMAC-Guard im `esignatures-webhook` (Missing
    Header → 401, falsche Signatur → 401, korrekte Signatur → 200).
  - Integrationstest via Supabase Local DB für die Status-Downgrade-
    Protection.

---

## I. Build & Lint

| Kommando | Wann | Erwartung |
|----------|------|-----------|
| `npm run build` | Vor Deploy | Build grün (wird in Lovable automatisch durch das Build-System ausgeführt; manuelles Triggern nicht nötig) |
| `npm run lint` | Vor Deploy | ESLint läuft. Pre-existing Warnungen/Errors **nicht** in diesem Schritt fixen — nur sicherstellen, dass die in Schritt 1–9 geänderten Dateien keine **neuen** offensichtlichen Probleme einführen. |

Hinweis: In der Lovable-Sandbox werden Build- und Typecheck-Läufe vom
Harness selbst ausgeführt. Manuelle Aufrufe sind nicht erforderlich und
werden in diesem Schritt bewusst nicht ausgelöst, um keine pre-existing
Lint-Probleme zu „adoptieren".

---

## J. Go-Live-Checkliste

- [ ] Alle Migrationen aus Schritt 1–9 angewendet (insb.
      `…_cost_acceptances_storage_bucket.sql`)
- [ ] Edge Functions deployed:
      - [ ] `create-esignatures-cost-acceptance-template`
      - [ ] `sync-esignatures-template`
      - [ ] `create-cost-acceptance-from-public-offer`
      - [ ] `get-public-cost-acceptance-state`
      - [ ] `send-cost-acceptance-email`
      - [ ] `esignatures-webhook`
      - [ ] `download-signed-cost-acceptance`
- [ ] Env Vars gesetzt: `ESIGNATURES_API_KEY`,
      `ESIGNATURES_WEBHOOK_SECRET` (optional, aber empfohlen),
      `RESEND_API_KEY` / IONOS-Fallback
- [ ] Template-ID in Settings vorhanden (kein `undefined`)
- [ ] Webhook-URL bei eSignatures korrekt eingetragen
      (`…/functions/v1/esignatures-webhook`)
- [ ] Webhook-Secret beidseitig gleich (eSignatures-Dashboard ↔
      Lovable-Cloud-Secret)
- [ ] Bucket `cost-acceptances` privat (`public = false`)
- [ ] Public-Flow getestet (Abschnitt B)
- [ ] Admin-Mailversand getestet (Abschnitt C)
- [ ] Webhook `contract-signed` mit & ohne PDF getestet (D5/D6)
- [ ] PDF-Download via Admin getestet (E3)
- [ ] Locking nach Signatur visuell verifiziert (Abschnitt F)
- [ ] Regressionsbereiche stichprobenartig geprüft (Abschnitt G)