
## Antworten auf deine drei Punkte

### 1. Wo siehst du Christinas Versand?

Maestro → Anfrage Christina Byrne Windfeld → Tab **„Aktivitäten"** (Timeline rechts).
Christinas Eintrag ist bereits da:

- **Datum:** 24.05.2026, 23:50
- **Betreff:** „Restzahlung Ihrer Veranstaltung am 28.08.2026 — STORIA Events"
- **Empfänger:** christina.byrne.windfeld@regionh.dk
- **Status:** sent (Resend-ID `5cd7b7e1…`)

Direktlink: `/admin/inquiries/316a0f27-8911-464f-97ea-c5135328f3d5/edit` → Aktivitäten.

### 2. Jessicas Mail in Maestro sichtbar machen

Jessicas Event ID gefunden: **`f64adbad-2e37-463a-804b-ee0bfc0503b4`** (Cyim · j.lagourres@cyim.com).

Ich trage einen Eintrag in `email_delivery_logs` ein:

- entity_type: `v2_event`
- entity_id: `f64adbad-2e37-463a-804b-ee0bfc0503b4`
- recipient: `j.lagourres@cyim.com` / Jessica Lagourrès
- subject: „Anzahlung erhalten – Ihre Veranstaltung am 29.08.2026 / Payment received — STORIA Events"
- provider_message_id: `b75e629a-c55d-4f92-9f06-3d2e74e36962` (Resend)
- status: `sent`
- metadata: `{ bcc: 'info@events-storia.de', template: 'cyim-anzahlung-bestaetigung', type: 'anzahlung_bestaetigung' }`

Danach erscheint die Mail in der Aktivitäten-Timeline ihres Events analog zu Christina.

### 3. Design „Christina-Style" als Standard festlegen

Ich speichere eine Memory-Notiz `mem://communications/restzahlung-email-design-standard` mit folgendem verbindlichen Aufbau für alle künftigen Zahlungs-/Bestätigungs-Mails:

- Header: schwarzer Balken (`#1a1a1a`), weißes „STORIA Events"
- **Vollständiger DE-Block zuerst**, dann horizontaler Trenner mit „ENGLISH VERSION" (Akzent `#b45309`), dann **vollständiger EN-Block**
- Tabelle Buchungsnr · Anzahlung · Gesamtsumme · Restbetrag · Datum (rechtsbündig, Werte fett)
- Akzent-Box (`#fff8ea` / `#f1d9a2`) für besondere Hinweise (z. B. Entschuldigung)
- Stornobedingungen als Inline-Block mit AGB-Link
- Footer einmalig am Ende: Datenschutz · Impressum · Speranza GmbH / Karlstr. 47a / Tel / Mail
- Font: Arial/Helvetica, Body weiß (`#ffffff`), Text `#333333` 15 px

Diese Memory-Regel sorgt dafür, dass künftige Restzahlungs-/Anzahlungs-Mails automatisch im gleichen Look gebaut werden.

## Was passiert beim „Implement"

1. Insert in `email_delivery_logs` für Jessica → erscheint sofort in der Timeline.
2. Memory-Datei `restzahlung-email-design-standard` anlegen + Index aktualisieren.

Kein Code im App-Frontend wird verändert.
