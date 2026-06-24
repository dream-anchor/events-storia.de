## Ziel
Automatischer „Google-Bewertung erbitten"-E-Mail-Versand **2 Werktage nach durchgeführtem Catering**, im Admin global deaktivierbar (Default: aktiv). Look & Copy exakt wie im hochgeladenen Mockup (Bordeaux #6b1f2a / Creme #f8f1e4, Playfair-Heading, „Grazie für Ihr Vertrauen", CTA „Auf Google bewerten", Signatur Domenico Speranza).

## Scope der Auslöser
Ein einziger Job, der zwei Quellen prüft:
1. `v2_events` mit Status `completed` (Events mit Catering — alle anderen ausgeschlossen)
2. `catering_orders` mit Status `delivered`/`completed`

Bedingungen pro Datensatz:
- Eventdatum / Lieferdatum liegt **exakt 2 Werktage** (Mo–Fr, DE-Feiertage Bayern ignoriert in V1 — nur Wochenenden ausgenommen) zurück
- Kunden-E-Mail vorhanden, nicht in `suppressed_emails`
- Noch keine Review-Mail für diesen Datensatz versendet (Idempotenz)
- Kunde nicht via Footer-Link „Keine weiteren Nachrichten" abgemeldet

## Admin-Toggle
- Globaler Schalter in **Admin → Einstellungen → Benachrichtigungen**: „Google-Bewertungsanfrage 2 Werktage nach Catering versenden" (Default: **an**)
- Live aus DB lesbar, sofort wirksam (kein Deploy nötig)
- Anzeige: letzter Lauf, Anzahl heute versendet, Link zu Log

## Technische Umsetzung

### DB-Migration
- Neue Zeile in vorhandener Settings-Tabelle (oder neue `app_settings`-Row): Key `review_request_enabled` boolean default true, `review_request_delay_business_days` int default 2, `review_google_url` text
- Neue Tabelle `review_request_log` (event_id nullable, order_id nullable, recipient_email, sent_at, message_id, status) — RLS admin-only, GRANT staff read, service_role all
- Neue Tabelle `review_request_unsubscribes` (email pk, unsubscribed_at) — pflegt Footer-Link
- Eindeutiger Index auf (event_id) und (order_id) verhindert Doppelversand

### Edge Function `send-review-requests`
- Liest Settings; bei `enabled=false` → exit
- Berechnet Stichtag: heute minus 2 Werktage
- Selektiert Kandidaten aus beiden Tabellen, joint Kundendaten (Anrede, Nachname, E-Mail, bevorzugte Sprache)
- Rendert HTML aus Template (DE Default; EN-Block analog bestehender bilingualer Mails, falls `customer_language='en'`)
- Versendet via `sendEmailWithFallback` (Resend → IONOS), schreibt Log
- Footer enthält Unsubscribe-Link → Edge Function `review-unsubscribe` schreibt in `review_request_unsubscribes`

### Template
- Inline-HTML im Stil des Mockups, mobile-first, MSO-Reset
- Variablen: `{{Anrede}}`, `{{Nachname}}`, Google-URL aus Settings
- Klein gehaltener Plaintext-Alt-Body
- BCC an `info@events-storia.de` (analog Offer-Archive-BCC-Regel)
- Mehrsprachig: DE oben, EN unten falls customer_language!=de (Bilingual-Standard)

### Cron
- `pg_cron` Job täglich **10:00 Europe/Berlin**, ruft `send-review-requests` mit Service-Role-Header
- Manueller „Jetzt ausführen (Dry-Run)"-Button im Admin

### Admin-UI
- In `Settings.tsx` neuer Block „Bewertungsanfragen":
  - Switch (aktiv/inaktiv)
  - Input Google-Bewertungs-URL
  - Read-only: letzter Lauf, Versandzahl 7 Tage
  - Button „Vorschau senden an mich"

## Offen / zu bestätigen
1. Google-Bewertungs-URL (Place-ID-Link) — bitte 1× liefern, wird in Settings persistiert
2. Werktage: Wochenende ausschließen reicht, oder bayerische Feiertage auch berücksichtigen?
3. Auch für reine **Restaurant-/Inhouse-Events ohne Catering-Lieferung** versenden, wenn `v2_events.status=completed`? (Mockup spricht von „Catering" — Standard: nur wenn Event-Typ Catering/Delivery enthält)
4. Versand-Uhrzeit (Vorschlag: 10:00 Europe/Berlin)
5. Anrede-Fallback wenn `{{Anrede}}` leer (Vorschlag: „Guten Tag {{Vorname}} {{Nachname}}")

## Was NICHT Teil dieses Builds ist
- Keine Änderung an bestehenden Reminder-Functions
- Kein Trigger für Restaurant-Tisch-Reservierungen
- Keine Mehrfachversände/Re-Reminder
- Keine Sentiment-Weiche (positive vs. negative Reviews)

Nach Freigabe + Antworten auf die 5 Punkte: Build via Migration + Edge Function + Settings-UI + Cron-Aktivierung in einem Schritt.