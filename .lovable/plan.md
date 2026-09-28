# Veröffentlichen AGB-2026-10 (nur Deploy + ein Vorlagen-Sync)

## Hinweis zum aktuellen Stand
Alle unten genannten 16 Functions wurden in der vorherigen Nachricht (05:40 UTC) schon im Stand von main (Commit 513d9e31) erfolgreich veröffentlicht. Schritt 1 wäre also eine Wiederholung und schadet nicht. Offen ist nur Schritt 2.

## Schritt 1 – Deploy (unverändert, Stand main)
Werkzeug: `supabase--deploy_edge_functions`

Die fünf, die du genannt hast:
- create-payment-session
- confirm-order
- send-payment-email
- send-payment-confirmation-v2
- send-raw-html-email

Per grep über `supabase/functions/` gefunden, weil sie `_shared/email-i18n.ts` oder `_shared/cost-acceptance-template.ts` importieren:
- admin-send-cost-acceptance
- create-cost-acceptance-from-public-offer
- create-esignatures-cost-acceptance-template
- esignatures-integration-status
- send-cancellation-notification
- send-customer-response-copy
- send-invoice-email
- send-menu-confirmation
- send-scheduled-reminders
- set-esignatures-template-id
- sync-esignatures-template
- (send-payment-email und send-payment-confirmation-v2 tauchen ebenfalls auf und stehen schon oben)

Keine indirekten Importe: `_shared/esignatures-client.ts` nennt die Vorlage nur in Kommentaren.

## Schritt 2 – Vorlage synchronisieren (ein einziger Aufruf)
Werkzeug: `supabase--curl_edge_functions`, POST `/sync-esignatures-template`, Body `{}`.
Im Code steht die Vorlagenversion auf 1.2.0 (`TEMPLATE_VERSION` in `_shared/cost-acceptance-template.ts`). Erwartete Antwort: `status: "updated"` (oder `"unchanged"`, falls sie schon aktuell ist) mit `template_version: "1.2.0"`.

Voraussetzung: Die Function lässt nur angemeldete Admins/Staff zu. Der erste Versuch wurde mit 401 abgelehnt, weil keine Anmeldung vorlag. Eine der beiden Voraussetzungen muss erfüllt sein:
- Du meldest dich im Admin der Vorschau an. Dann sendet das Werkzeug deine Anmeldung automatisch mit. Oder:
- Du nennst mir das Admin-Konto. Dann melde ich mich per `lovable auth-session --json --user <id>` an (du bekommst dafür eine Bestätigungsanfrage) und schicke die Anmeldung beim einen Aufruf mit.

## Was nicht passiert
- Datei-Änderungen: keine (nur diese Plan-Datei).
- Datenbank-Änderungen: keine. Kein Migrations- oder SQL-Werkzeug, kein `is_test`, kein UPDATE auf event_inquiries oder catering_orders. Der Sync schreibt lediglich die neue Vorlagen-ID in seine eigene Einstellung (`crm_settings`); das ist die normale Aufgabe der Function.
- Keine anderen Aufrufe: keine Zahlungs-, Mail- oder Testaufrufe.

## Rückmeldung am Ende
Deploy-Ergebnis je Function, die zurückgegebene Vorlagenversion und die Bestätigung, dass keine Datei geändert wurde.
