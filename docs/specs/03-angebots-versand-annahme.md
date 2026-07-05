# Angebots-Versand & Kunden-Annahme

Modul-Spec MAESTRO · Stand 2026-07-05 · Status: entscheidungsreif
Scope: Anschreiben-Composer, WYSIWYG-Vorschau, Testmail, Versand mit Zustell-
Tracking, öffentliche Angebotsseite mit Optionswahl, Annahme (online + offline
erfasst) → Anzahlungs-Checkout, Angebots-Rückzug, Auto-Nachfassen,
Verlustgründe, View-Tracking. Dieses Modul IST die Nordstern-Metrik: `sent_at`
stempelt „Minuten bis Angebot", Annahme stempelt „Tage bis gewonnen".

## A — IST im Alt-System (mit Evidenz)

Inventar-Funktionen (docs/MAESTRO-FEATURE-INVENTAR.md, „Angebot", „E-Mail/
Zustellung", „Angebot (Anfrage-Editor)"): Angebots-Mail mit Link + optionalem
LexOffice-PDF (de/en/it/fr, CC/BCC, Threading, Dry-Run) · KI-Anschreiben-
Composer (Vorlagen/Textbausteine/Variablen) · WYSIWYG-Vorschau · Testmail ·
versionierte Angebots-Historie · öffentliche Angebotsseite per Slug · Kunden-
Antwort (Option + Anmerkung) · Öffnungs-Tracking & Verlustgründe · Offline-/
Telefon-Annahme · Annahme ohne Stripe (vor Ort/Rechnung) · Stripe-Payment-Link
je Option · zweistufige Nachfass-Mails · Zustell-Tracking (email_delivery_logs,
Resend-Webhook, SMTP-Fallback) · Kundenreaktions-Benachrichtigung +
Kundenkopie · Betreiber-Adressen-Schutz.

Nachweislich unfertig/fehlerhaft:

1. **Auto-Nachfassen gegen Legacy-Tabelle** — `send-scheduled-reminders`
   (Z. 211–215) liest `event_inquiries.status='offer_sent'`, der Versand
   schreibt `v2_events.offer_phase='proposal_sent'` (`send-offer-email`
   Z. 686–691); kein `cron.schedule` — Tag-3/7-Nachfassen für v2 de facto tot.
2. **Empfänger per Zeitfenster geraten** — `useOfferHistory.ts` (Z. 49,
   92–117): Rekonstruktion via „outbound-Mail-Log ±5 min" + Subject-Regex
   `/angebot|offer/i`; Beleg-Charakter nur heuristisch.
3. **Zustellstatus verwässert** — `receive-resend-webhook` (Z. 4–21):
   `delivered`/`opened` bewusst auf „sent" gemappt (EINE `email_id` deckt
   Kunde + Archiv-BCC); Öffnungen werden verworfen.
4. **12s-Timer als Webhook-Ersatz** — `send-offer-email` (Z. 740–825):
   `setTimeout(12s)` + `waitUntil`, ggf. SMTP-Nachschuss (`resend-via-smtp`).
5. **Mail-Link ignoriert das Tracking** — Slug gespeichert (Z. 371–377), Mail
   verlinkt die UUID-Route (Z. 384); `PublicOffer.tsx` (Z. 364) pingt
   `track_offer_view` nur auf der Slug-Route — Haupt-Klickpfad ungezählt.
6. **Mandant hart verdrahtet** — From `info@events-storia.de` (Z. 186),
   Archiv-BCC (Z. 510), Domainliste (Z. 322–326), Testmail `antoine@monot.com`
   (Z. 552), Footer-NAP „Karlstraße 43" (Z. 455; NAP-Vorgabe: Karlstr. 47a).
7. **PDF-Warteschleife im Sendepfad** — `waitForLexOfficePdf` (Z. 106–158):
   bis zu 5 Retries blockieren den Versand; sonst Mail ohne Anhang + Alarm.
8. **Race bei der HTML-Archivierung** — Z. 693–720: HTML nachträglich in die
   „höchste History-Version"; fehlt die Zeile, nur `console.warn`.
9. **Float-Euros am Geld-Übergang** — `create-offer-payment-link` (Z. 13,
   117): `amount // in EUR` + `Math.round(amount*100)`; Stripe-Product/Price/
   PaymentLink-Objekte pro Option.
10. **Public-Page-Monolith** — `PublicOffer.tsx` (2.494 Z.): Legacy-Status-
    Mapping (Z. 596), doppelte Drink-Parser (Z. 1397, 1694), vier Aliasse.

Neubau-Stand (`/home/user/maestro-cloud`): `POST /api/events/:id/offers/send`
existiert (Options-Snapshot in `offer_history`, Versions-Bump, stabiler
Public-Token, Status `offer_sent`) — versendet aber **keine Mail**. Public-
Flow existiert: `GET /api/public/offer/:token` + `POST .../respond` via
SECURITY-DEFINER-RPCs, Rolle `maestro_public` (kein Existenz-Leak), Seite
`offer-public.tsx` (`/angebot/:token`). Stripe-Checkout ist Stub
(`payments.ts` Z. 110: „TODO(stripe keys)").

## B — Der eigentliche Job (Jobs-to-be-done)

**Job:** „Bring mein fertiges Angebot in unter 2 Minuten zustellsicher zum
Kunden, lass ihn auf einem Screen ansehen → wählen → Änderung wünschen →
annehmen → anzahlen, und fasse automatisch nach, bis gewonnen oder ein
Verlustgrund dokumentiert ist." Telefonische Zu-/Absagen (Gastro-Realität,
1–20 MA) gehören dazu — sie werden als Offline-Aktion erfasst (s. D). Alles
nach dem Builder (Spec 02) bis zur bezahlten Anzahlung ist dieses Modul.

**Gestrichen / zusammengelegt (mit Begründung):**
- **IONOS-SMTP-Fallback + 12s-Nachverifizierung:** Symptome der geteilten
  Absenderadresse. Ersatz: Queue mit Retry, Webhook je Empfänger, Sending-
  Domain-Stufen (s. D).
- **Slug-URLs:** Kundennamen in URLs = DSGVO-Geruch, nie verlinkt (A5).
  Hoch-entropischer Token-Link (Neubau, existiert).
- **Archiv-BCC an info@:** `offer_sends` speichert das gerenderte HTML — das
  Archiv liegt in der App. (Optionales BCC bleibt Tenant-Setting.)
- **±5-Min-Empfänger-Matching:** Empfänger/CC/BCC am Versanddatensatz.
- **LexOffice-PDF-Anhang aus dem Sendepfad:** Das Web-Angebot ist das
  Angebot; PDF als Download auf der Angebotsseite (Renderer/Archiv: Spec 04).
- **Proposal-/Final-Doppelwelt zusammengelegt:** EINE Angebotsseite; „final"
  ist eine neue Version nach Änderungswunsch.
- **Benachrichtigung + Kundenkopie + Buchungsbestätigung zusammengelegt** in
  eine Bestätigungs-Pipeline (ein Renderer, zwei Empfänger).
- **IT/FR gestrichen** — Produktsprachen DE + EN.
- **Betreiber-Domainliste gestrichen** — generische Warnung bei Mandanten-
  Domain/Teammitglied als Empfänger.
- **Storia-only ausgelagert:** eSignatures.com-Kostenübernahme, Restaurant-
  Galerie (wird generisches Branding-Bild je Mandant).

## C — Benchmark 2026

Table Stakes (Digest): Web-Angebot mit Branding + Click-Accept + Anzahlung bei
Annahme + Auto-Follow-ups + Engagement-Tracking. Tripleseat setzt den Massstab
„Ein-Screen-Annahme" und warnt bei Kalender-Konflikten (Holds); PartyPay
fordert die Anzahlung automatisch nach Signatur an. MICE DESK/Proposales:
Engagement-Tracking + 1-Klick-Change-Requests. iVvy/hivr.ai: KI-Follow-up mit
Human-in-the-Loop-Schwellen. Perfect Venue: Auto-Erinnerungen + Zahlungen.

**Gleichziehen:** Web-Angebot mit Optionswahl (Basis existiert), Click-to-
Accept, Anzahlungs-Checkout nach Annahme, Auto-Follow-ups, View-Tracking,
Konflikt-Check bei Annahme (Tripleseat-Holds), strukturierter Änderungswunsch.

**Bewusst schlagen:**
1. **Nordstern sichtbar:** „Minuten bis Angebot" live beim Senden + Benchmark
   im Dashboard — zeigt kein Wettbewerber. Metrik-Definition s. D.
2. **Verlustgrund vom Kunden selbst:** „Leider nein"-Option mit Grund-Auswahl
   — Conversion-Daten, die sonst niemand erhebt.
3. **DACH-sauber:** DE/EN; DSGVO-armes Tracking: Primärsignal First-Party-
   View-Ping mit Bot-Heuristik (kein Pixel-Zwang); Provider-Open-/Klick-
   Tracking nur als Opt-in-Tenant-Setting mit DSGVO-Hinweis. AGB-Version +
   Zeitstempel + IP + Betrags-Snapshot als Annahme-Beleg, SEPA/Klarna.

## D — Soll-Design (Neubau)

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)
1. Aus dem Builder: „Vorschau & Senden" öffnet den **Composer**: Anschreiben
   (KI-Entwurf, Vorlagen, Variablen-Chips), Empfänger (vorausgefüllt), CC/BCC,
   Betreff, DE/EN; Warn-Chip bei Betreiber-/Team-Adresse.
2. **WYSIWYG-Vorschau** als Tabs: E-Mail (Desktop/Mobil) · Angebotsseite —
   gerendert vom SELBEN Server-Code wie der Versand (Dry-Run-Endpoint).
3. **Testmail**: an den eingeloggten User (+ Team-Adressen), Präfix „[TEST]",
   kein Statuswechsel, `kind='test'`.
4. **Senden**: transaktional Options-Snapshot (existiert) + `offer_sends` +
   Queue-Job; UI zeigt den Nordstern-Moment: „Angebot versendet — 47 Minuten
   nach Anfrage-Eingang ⚡" (Definition s. u.).
5. **Zustellprotokoll**: Chips queued → sent → delivered → viewed (plus
   opened/clicked, falls Provider-Tracking aktiviert) bzw. bounced/complained;
   Bounce → Aufgabe + Klartext-Banner mit Alternativvorschlag.
6. **Kunde** öffnet `/angebot/:token` (kein Login): Branding, Anschreiben,
   Options-Karten, Sticky-CTA. Aktionen: **Option wählen** (Wechsel bis zur
   Annahme erlaubt) · **Änderung wünschen** (strukturiert + Chips) ·
   **Annehmen** (AGB-Checkbox, Name) · **Leider absagen** (Grund-Auswahl).
7. Nach **Annahme** (Versions- + Verfügbarkeits-Check, s. u.): Status →
   `accepted`, `won_at` gestempelt — unabhängig vom Zahlungsweg. Danach
   Anzahlungs-Checkout (Stripe Connect Session; Karte/SEPA/Klarna/Wallets)
   oder bei „vor Ort/Rechnung" Bestätigungsseite; Mail an Kunde + Team.
8. **Änderungswunsch** → Aufgabe, Kadenz pausiert; neue Version im Builder,
   Re-Send nutzt denselben Token (Kunde behält einen Link) — der Versions-
   Check schützt vor Annahme veralteter Seiten.
9. **Auto-Nachfassen** bis Reaktion, Annahme, Absage, Rückzug oder Ablauf;
   Ablauf zeigt „Angebot abgelaufen — Verfügbarkeit erneut anfragen".

### Zustandsmaschine (Angebots-Lebenszyklus)
Erweitert die Neubau-Zustände (`06_public_offer.sql`). Erlaubte Übergänge:
`draft → offer_sent` (Erstversand) · `offer_sent → offer_chosen` (Kunde
wählt; Optionswechsel bis zur Annahme, letzte Wahl zählt) ·
`offer_sent|offer_chosen → change_requested` (pausiert Kadenz) ·
`change_requested → offer_sent` (Re-Send neuer Version: setzt gewählte Option
zurück, `current_offer_version`++) · `offer_sent|offer_chosen → accepted`
(Click-Accept oder Offline-Aktion; stempelt `won_at`) · `→ accepted_pending`
(Slot-Konflikt; Freigabe → `accepted`, sonst Absage) · `→ offer_declined`
(mit Grund; Reaktivierung NUR per explizitem Re-Send) · `→ expired` ·
`→ withdrawn`; `expired|withdrawn → offer_sent` per Re-Send. `accepted` ist
terminal bis Storno (Zahlungs-Modul). `get_public_offer` liefert nur die
Whitelist `offer_sent · offer_chosen · change_requested · accepted ·
expired · withdrawn`; alles andere ist von außen wie ein falscher Token.

### Annahme (gehärtet)
- **Versions-Bindung:** Accept-Payload enthält `offerVersion`; Server prüft
  gegen `current_offer_version`. Mismatch (alte Seite offen, Token bleibt bei
  Re-Send gleich) → 409 + Prompt „Angebot wurde aktualisiert — Seite neu
  laden". Server persistiert `accepted_amount_cents` als Snapshot in
  `offer_responses` — der Beleg zeigt exakt den gesehenen Preis (G3).
- **Verfügbarkeits-Check:** Accept-RPC prüft Datum/Raum gegen gewonnene/
  bestätigte Events. Konflikt → `accepted_pending` + Sofort-Aufgabe statt
  Auto-Confirm; Kunde sieht „Wir bestätigen den Termin umgehend". Optional
  (Registry): Hold beim Senden reserviert den Slot.
- **Annahme vs. Zahlung:** `accepted` + `won_at` beim Accept-Klick (Vertrag
  formfrei, G3) — auch im Stripe-Pfad; Zahlungsstatus separat im Zahlungs-
  Modul. Abgebrochener Checkout (Session läuft nach 24 h ab) → Zahlungs-
  Erinnerungs-Kadenz + Aufgabe (PartyPay-Muster).
- **Offline-Erfassung:** „Als angenommen markieren": Option + Zahlungs-
  bedingung wählen, optional Payment-Link per Mail; protokolliert als
  `offer_responses.kind='accepted_offline'` mit `sent_by`, stempelt `won_at`
  + `accepted_option_id`, stoppt die Kadenz. Analog „Als abgesagt markieren"
  mit Verlustgrund (`declined_offline`).
- **Rückzug:** „Angebot zurückziehen" (Preisfehler, Slot vergeben): Seite →
  neutral + Kontakt-CTA, Accept-RPC verweigert, Follow-ups stoppen.

### Nordstern-Metrik (Definition)
„Minuten bis Angebot" = Erstversand (`kind='offer'`, Version 1) minus
`inquiry.received_at`; Re-Sends/neue Versionen zählen nicht erneut. Bei
manuell nacherfassten Anfragen ist `received_at` korrigierbar (Default
Anlagezeitpunkt, markiert „nacherfasst", vom Benchmark ausgenommen). Anzeige
und Benchmark rechnen Business-Hours-adjustiert (Tenant-Öffnungszeiten:
Anfrage 23:00, Versand 9:00 = top, nicht 600 Min). ⚡-Badge nur unterhalb
einer Schwelle (Default 120 Business-Minuten), sonst neutrale Anzeige.

### Datenmodell (Neon Postgres, Cents, tenant_id + RLS FORCE überall)
`offer_sends` (NEU — ersetzt email_delivery_logs+v2_event_emails im Angebotsflow):
```
id uuid pk · tenant_id → tenants (crudPolicy tenantIsMember, FORCE RLS)
event_id → events · offer_version int → offer_history
kind text check ('offer'|'reminder'|'confirmation'|'test')  -- reminder_no int null
recipient_email text not null · cc text[] · bcc text[]
subject text · letter_text text · rendered_html text        -- Beleg, kein Matching
language text check ('de'|'en') · sent_by uuid null
provider text · provider_message_id text · status text
  check ('queued'|'sent'|'delivered'|'opened'|'clicked'|'bounced'|'complained'|'failed')
error_message text · created_at timestamptz
index (tenant_id, event_id) · index (provider_message_id)
```
`offer_send_events` (NEU, append-only): `tenant_id → tenants (crudPolicy +
FORCE RLS wie die Schwester-Tabellen, inkl. Isolationstest) · send_id →
offer_sends · type · occurred_at · provider_event_id text · raw jsonb`.
Idempotenz primär per Unique auf `provider_event_id` (svix-id); `(send_id,
type, occurred_at)` nur Fallback für Provider ohne Event-ID.
`offer_responses` (NEU): `tenant_id · event_id · offer_version · kind check
('option_chosen'|'change_request'|'accepted'|'accepted_offline'|'declined'|
'declined_offline') · option_id null · accepted_amount_cents int null
(Snapshot) · notes · decline_reason check ('too_expensive'|'date_unavailable'
|'booked_elsewhere'|'plan_cancelled'|'other') · accepted_terms_version text ·
ip inet · user_agent text · sent_by uuid null (Offline) · created_at`.
Public-Insert nur via SECURITY-DEFINER-RPC; `*_offline` nur über Team-API.
`events` (Erweiterung): `offer_state (s. Zustandsmaschine) ·
offer_first/last_viewed_at · offer_view_count · offer_valid_until date ·
won_at · loss_reason(_note) · follow_up_paused_at · accepted_option_id`.
`tenant_settings` (Erweiterung): `mail_from_name · reply_to_email ·
sending_domain_status ('platform'|'subdomain_pending'|'subdomain_verified'|
'custom_pending'|'custom_verified') · archive_bcc · follow_up_cadence int[]
default '{3,7}' · follow_up_auto_send + auto_send_max_value_cents · terms_url
+ terms_version · test_recipients · provider_open_tracking boolean default
false (DSGVO-Hinweis in UI) · business_hours jsonb · retention_raw_days int
default 30 · retention_lost_months int default 24`.

### Retention (DSGVO)
`offer_send_events.raw` wird nach `retention_raw_days` per Purge-Job (Cron)
auf extrahierte Felder reduziert (`type`, `occurred_at`, `provider_event_id`
bleiben). Verlorene/abgelaufene Vorgänge: `rendered_html`, `recipient_email`,
`ip`, `user_agent` nach `retention_lost_months` anonymisiert; Annahme-Belege
gewonnener Events bleiben (Beweissicherung, gesetzliche Aufbewahrung).
Details im zentralen Löschkonzept der Plattform.

### Mail-Provider-Entscheidung (explizit)
**Resend als primärer Provider** (produktionsbewährt, svix-Muster vorhanden,
Domains-API, Idempotency-Keys, DPA/AVV). Deliverability dreistufig —
entschieden, denn bei Resend ist jede Subdomain eine eigene Domain mit
eigenen DKIM-Records; „Subdomain je Mandant" gibt es NICHT gratis:
- **Stufe 1 (Default, Time-to-Value < 15 Min): EINE Plattform-Domain**
  `angebote@mail.maestro.app`; From-Name = Betriebsname, **Reply-To = echte
  Mandanten-Adresse**. Ehrlich: keine Reputations-Isolation (der lokale
  Adressteil isoliert nichts) — Schutz über Complaint-/Bounce-Monitoring mit
  Kill-Switch pro Mandant + Rate-Limit für neue Tenants.
- **Stufe 1.5 (automatisch nachgelagert): Subdomain je Mandant** via
  Provisioning-Job beim Tenant-Anlegen: Resend-Domains-API + Cloudflare-DNS-
  API (Plattform kontrolliert die Zone), Verifikation asynchron; bis
  `subdomain_verified` sendet der Tenant über Stufe 1. Domain-Quota und
  Fehlerpfad (Retry, Betreiber-Task, Verbleib Stufe 1) im Adapter.
- **Stufe 2 (Pro-Tier): eigene Mandanten-Domain:** Settings-UI mit 3 DNS-
  Records + Live-Check; From wechselt erst nach `custom_verified`. NIE From =
  unverifizierte Mandanten-Domain (DMARC-Fail garantiert).
- **Kein hart verdrahteter Zweit-Provider** (Retry auf Hard-Bounce heilt
  nichts); Adapter-Interface `packages/mail`, Postmark/SES später Registry.
- Betrieb: Suppression-Liste pro Mandant sichtbar, DMARC-Reports.

### API (Hono-Worker)
- `POST /api/events/:id/offers/render-preview` — Dry-Run, keine Writes.
- `POST /api/events/:id/offers/test-send` — Testmail, `kind='test'`.
- `POST /api/events/:id/offers/send {recipient, cc, bcc, subject, letter,
  language}` — Snapshot + Token (existiert) + `offer_sends` + Queue-Job.
- `POST /api/events/:id/offers/mark-accepted | mark-declined | withdraw` —
  Offline-Aktionen/Rückzug mit Zustandsmaschinen-Guards.
- `GET /api/events/:id/sends` — Zustellprotokoll inkl. Events.
- `POST /api/webhooks/email` — svix-verifiziert, idempotent per
  `provider_event_id`, Downgrade-Schutz; bounce/complaint → Aufgabe + Badge.
- Public (Rolle `maestro_public`, nur RPC-EXECUTE): `GET /api/public/offer/
  :token` (Status-Whitelist s. Zustandsmaschine) · `POST .../view` — First-
  Party-View-Ping: JS-basiert nach Delay/Interaktion, UA-/Bot-Filter (Outlook
  SafeLinks, GMX-Prefetch, Scanner), HEAD/Prefetch und `?preview=1` (Team)
  zählen nicht (schließt A5) · `POST .../respond` (+ `kind`, `decline_reason`)
  · `POST .../accept {optionId, termsVersion, offerVersion}` → `{checkoutUrl
  | confirmed | pending_review}`; 409 bei Versions-Mismatch.

### Automatisierungen (Cloudflare Queues + Cron)
- **Send-Queue** mit Retry/Backoff (ersetzt 12s-Timer); Dead-Letter → Aufgabe.
- **Follow-up-Engine (Cron, stündlich):** Kandidaten = `offer_sent`, keine
  Response, Kadenz (T+3/T+7) fällig, nicht pausiert/abgelaufen/zurückgezogen.
  KI-Entwurf; Auto-Send nur wenn `follow_up_auto_send` UND Eventwert <
  Schwelle, sonst Freigabe-Task (iVvy-Muster). Jede Kundenreaktion (View
  reicht nicht; Response/Inbound-Mail/Zahlung/Offline-Statuswechsel schon)
  pausiert die Kadenz.
- **Zahlungs-Erinnerung:** `accepted` ohne abgeschlossene Anzahlung → eigene
  Kadenz + Aufgabe; getrennt von der Angebots-Kadenz.
- **Engagement-Trigger:** basiert auf `viewed` (First-Party, bot-gefiltert),
  NICHT auf Provider-`opened`: `viewed` ohne Antwort nach 48 h → Nachfass-
  Vorschlag; nie `viewed` nach 48 h → Hinweis „anderer Kanal" (Telefon).
- **Ablauf-Handling:** 2 Tage vor `offer_valid_until` letzte Erinnerung;
  danach Seite → „abgelaufen", Aufgabe „nachfassen oder Verlustgrund setzen".
- **Retention-Purge + Nordstern-Aggregation (nightly):** s. Retention-
  Abschnitt bzw. Metrik-Definition; anonymer Benchmark pro Tenant.

### KI-Punkte (Input → Vorschlag → Bestätigung)
1. **Anschreiben:** Anfrage + Angebotsstand + Tonalität → Entwurf; Erstversand
   nie ohne Menschen.
2. **Follow-up-Texte:** personalisiert; Auto-Send nur unter Schwellen.
3. **Änderungswunsch-Parsing:** Kundennotiz → strukturierte Vorschläge
   („Gästezahl 40→55, Option B, vegetarisch +6") als Builder-Draft.
4. **Verlustgrund-Vorschlag:** Absage-Freitext → vorbelegtes Dropdown.

### Integrations-Berührungen
- **Stripe Connect:** Checkout-Session (nicht PaymentLink-Objekte) mit
  `application_fee`, Metadata `payment_id`; nur Cents. PayPal: Welle 3.
- **PDF-Download:** Owner ist Spec 04 (Dokumente-Modul): serverseitiges PDF
  aus dem eingefrorenen Versions-Snapshot, asynchron, für ALLE Mandanten —
  nicht an LexOffice gekoppelt; bis dahin zeigt die Angebotsseite „PDF wird
  erstellt" mit Auto-Refresh. Ownership-Matrix s. Spec 04 D: Spec 03 besitzt
  Composer, Send-Endpoint und `offer_sends` (Versand-Beleg); `offer_history`
  (Spec 04) referenziert den Beleg per `send_id` — keine Doppelspeicherung.
- **LexOffice:** nur Rechnungswesen (Rechnung nach Annahme) — Zahlungs-Modul.
- **Inbound-E-Mail (Cloudflare Email Routing):** Antworten auf Reply-To →
  Inbox-Modul, pausieren die Kadenz.
- **WhatsApp (Welle 2):** Follow-up-Kanal via BSP; gleiche Kadenz-Engine.

## E — Klassifikation

**Kern.** Versand, Public-Page, Annahme (online + offline), Rückzug, Zustell-
Tracking, Nachfassen — nicht abschaltbar. Per Registry (B10) zuschaltbar:
eigene Sending-Domain (Pro), Auto-Send der Follow-ups, WhatsApp-Kanal,
Provider-Open-Tracking, Slot-Hold. **Storia-only:** eSignatures.com-
Kostenübernahme, IT/FR-Texte, Restaurant-Galerie-Inhalte. Kriterium wie
Spec 02: brauchen < 30 % der Zielmandanten es am Tag 1? → Registry/Fork.

## F — Bau-Plan

| # | Schritt | Abhängig von | Aufwand | Neu |
|---|---------|--------------|---------|-----|
| 1 | Migration: `offer_sends`, `offer_send_events` (inkl. tenant_id + provider_event_id-Unique), `offer_responses`, Events-/Settings-Felder, Zustands-Guards, RLS + FORCE + Isolationstests für ALLE drei Tabellen | — | S | Tabellen |
| 2 | `packages/mail`: Resend-Adapter (Stufe 1: Plattform-Domain), EIN Renderer (Send=Preview=Test; PDF-Export nutzt ihn via Spec 04), Send-Queue mit Retry | 1 | M | Paket |
| 3 | Send-Endpoint ausbauen (Composer-Payload, `offer_sends`, Queue, Nordstern-Stempel gem. Metrik-Definition) + render-preview + test-send | 2 | M | Endpunkte |
| 4 | Composer-UI + Vorschau-Tabs + Testmail | 3 | L | UI |
| 5 | Webhook `/api/webhooks/email` (provider_event_id-Idempotenz) + Status-Maschine + Zustellprotokoll-UI + Bounce-Aufgabe | 2 | M | Endpunkt/UI |
| 6 | Public-Page-Ausbau: View-Ping mit Bot-Heuristik, Änderungswunsch, Annahme (offerVersion-/Konflikt-Check, AGB/IP/Betrags-Snapshot), Absage, Ablauf-/Rückzugs-Zustand | 1 | L | UI/RPCs |
| 7 | Vorgangs-Aktionen: Als angenommen/abgesagt markieren, Angebot zurückziehen | 1 | S | UI/Endpunkte |
| 8 | Annahme → Stripe-Checkout-Session (Connect, Cents) + Bestätigungs-Mails + Zahlungs-Erinnerungs-Kadenz | 6, Zahlungs-Modul | M | Endpunkt |
| 9 | Follow-up-Engine: Cron, Kadenz, Pausierung, KI-Entwurf, Freigabe-Task, Auto-Send-Schwellen | 3,5,6 | L | Cron/Queue |
| 10 | Sending-Domains Stufe 1.5/2: Provisioning-Job (Resend-Domains-API + Cloudflare-DNS), Settings-UI, DNS-Check, Fehlerpfad | 2 | M | UI/Adapter |
| 11 | Nordstern-Dashboard (Minuten bis Angebot, Tage bis gewonnen, Benchmark, Business-Hours-Normalisierung) | 3,8 | M | UI/Cron |
| 12 | Retention-Purge-Job (raw-Reduktion, Anonymisierung verlorener Vorgänge) | 1 | S | Cron |
| 13 | KI: Anschreiben-, Follow-up-, Änderungswunsch-, Verlustgrund-Endpunkte | 3,6,9 | L | Endpunkte |

Kritischer Pfad 1→2→3→4 (erster Versand), dann 5/6/7 parallel; 8–13 danach.

## G — Risiken & Lösungen (Top 4)

1. **Plattform-Deliverability** — ein Spam-Mandant ruiniert die Zustellrate
   aller. → Stufe-1-Kill-Switch (Complaint-/Bounce-Monitoring), Rate-Limits,
   automatische Subdomain-Isolation ab Stufe 1.5, DMARC-Reports; Custom
   Domain als Ausweg. Test: Seed-Liste (Gmail/Outlook/GMX/web.de).
2. **Doppelbuchung durch Auto-Annahme** — zwei offene Angebote für denselben
   Slot, beide Kunden klicken „Annehmen" (Tripleseat: Holds/Kalender-
   Warnung). → Datums-/Raum-Konfliktcheck im Accept-RPC; Konflikt →
   `accepted_pending` + Sofort-Aufgabe statt Auto-Confirm; optionales Hold
   beim Senden (Registry). AK 10.
3. **Rechtsverbindlichkeit der Annahme** ohne eIDAS-Signatur. → Gastro-
   Verträge sind formfrei: Click-to-Accept mit AGB-Version, IP, User-Agent,
   Zeitstempel UND Versions-Bindung + `accepted_amount_cents` (Beleg zeigt
   exakt den gesehenen Preis) + doppelseitige Bestätigungs-Mail;
   qualifizierte E-Signatur bleibt optionales Modul.
4. **Follow-up-Automatik nervt** (Kunde hat telefonisch zu-/abgesagt, System
   mailt weiter). → Offline-Aktionen (AK 11) stoppen die Kadenz sofort;
   ebenso Inbound-Mail, Zahlung, Response; 1-Klick-Stopp am Vorgang;
   Reminder-Cap; Abmeldelink in jeder Nachfass-Mail (DSGVO).

## H — Akzeptanzkriterien

1. Versand stempelt `offer_sent_at`; „Minuten bis Angebot" zählt nur den
   Erstversand, basiert auf korrigierbarem `inquiry.received_at`, wird
   Business-Hours-adjustiert angezeigt/aggregiert; ⚡ nur unter der Schwelle,
   nacherfasste Anfragen fließen nicht in den Benchmark.
2. Vorschau, Testmail und echter Versand erzeugen byte-identisches HTML aus
   derselben Render-Funktion (Golden-Test); der PDF-Export (Spec 04) rendert
   aus demselben eingefrorenen Versions-Snapshot.
3. Testmail geht nur an User/Team-Adressen, ändert keinen Status, erzeugt
   keinen Kundenkontakt.
4. Jede Zustellprotokoll-Zeile trägt Empfänger/CC/BCC/HTML am Datensatz;
   Statuswechsel per signiertem Webhook, Failure wird nie durch spätere
   Success-Events überschrieben; ein erneut zugestelltes Event (gleiche
   `provider_event_id`) erzeugt keine zweite Zeile.
5. Hard-Bounce → innerhalb 1 Minute sichtbarer Fehler + Aufgabe mit Klartext-
   Erklärung (kein englischer Provider-Rohtext).
6. Der Kunde durchläuft öffnen → wählen → annehmen → Checkout ohne Login auf
   390 px; `accepted` + `won_at` beim Accept-Klick — im Stripe-Pfad WIE bei
   „vor Ort/Rechnung"; abgebrochener Checkout startet die Zahlungs-
   Erinnerungs-Kadenz + Aufgabe, ohne `accepted` zu berühren.
7. Mail-Link-Aufrufe erhöhen `offer_view_count` (first/last korrekt); Team-
   Vorschau zählt nicht; Link-Scanner/Prefetcher (Outlook SafeLinks, GMX)
   erhöhen den Zähler nicht (Bot-Heuristik-Test).
8. Änderungswunsch → strukturierte Aufgabe + Kadenz-Pause; Re-Send nutzt
   denselben Token-Link, setzt die gewählte Option zurück, erhöht die Version.
9. Annahme einer veralteten Version wird abgewiesen — 409 + Reload-Prompt
   „Angebot wurde aktualisiert" (automatisierter Test); `offer_responses`
   persistiert `accepted_amount_cents` der tatsächlich angenommenen Version.
10. Annahme bei bereits gewonnenem Konkurrenz-Event am selben Slot erzeugt
    keinen `accepted`-Status ohne Freigabe (→ `accepted_pending` + Aufgabe,
    automatisierter Test).
11. „Als angenommen markieren" stempelt `won_at`, setzt `accepted_option_id`,
    stoppt die Kadenz, protokolliert `accepted_offline` mit `sent_by`; „Als
    abgesagt markieren" erfasst den Verlustgrund analog.
12. Zurückgezogenes Angebot ist nicht annehmbar (Accept-RPC verweigert), die
    Seite zeigt den neutralen Zustand + Kontakt-CTA, Follow-ups stoppen.
13. Follow-ups feuern nach T+3/T+7 nur ohne Kundenreaktion; Annahme, Absage,
    Rückzug, Inbound-Mail, Zahlung oder Offline-Statuswechsel stoppen sofort
    (automatisierter Test); über der Wert-Schwelle nie ohne Freigabe.
14. Purge-Job entfernt Webhook-Rohdaten älter als `retention_raw_days` und
    anonymisiert Sends/Responses verlorener Vorgänge nach
    `retention_lost_months` (automatisierter Test).
15. RLS-Isolationstest: Mandant A sieht keine `offer_sends`/`offer_send_
    events`/`offer_responses` von Mandant B; Public-Zugriff nur über
    (Subdomain-Slug + Token)-Doppel-Match via SECURITY-DEFINER-RPC — falscher
    Token, Tenant oder Status sind von außen nicht unterscheidbar.
