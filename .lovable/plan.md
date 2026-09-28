# Nur Vorlage synchronisieren (eSignatures 1.2.0)

## Ausgangslage
Die 16 Functions sind seit 05:40 UTC schon im Stand von main (Commit 513d9e31) veröffentlicht. Ich veröffentliche sie nicht noch einmal. Im Code steht die Vorlagenversion auf 1.2.0.

## Einziger Schritt
Ich rufe `sync-esignatures-template` genau einmal auf.
- Werkzeug: `supabase--curl_edge_functions`, POST `/sync-esignatures-template`, Body `{}`
- Voraussetzung: Du bist im Admin der Vorschau angemeldet. Das Werkzeug sendet deine Anmeldung dann automatisch mit. Ohne Anmeldung lehnt die Function mit 401 ab. In dem Fall melde ich das und rufe nichts weiter auf.
- Erwartete Antwort: `template_version: "1.2.0"` mit `status: "updated"` oder `"unchanged"`

## Was nicht passiert
- Keine Datei-Änderung (außer dieser Plan-Datei), kein erneutes Veröffentlichen.
- Keine Datenbank-Änderung durch mich: kein Migrations- oder SQL-Werkzeug, kein `is_test`, kein UPDATE auf event_inquiries oder catering_orders. Die Function selbst speichert nur ihre neue Vorlagen-ID in ihrer eigenen Einstellung; dafür ist sie da.
- Keine anderen Aufrufe: keine Zahlungs-, Mail- oder Testaufrufe.

## Rückmeldung
Die zurückgegebene Vorlagenversion samt Status, und die Bestätigung, dass keine Datei geändert wurde.
