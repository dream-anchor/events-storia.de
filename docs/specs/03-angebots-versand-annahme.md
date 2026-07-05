# Angebots-Versand & Kunden-Annahme

Modul-Spec MAESTRO · Stand 2026-07-05 · Status: entscheidungsreif
Scope: Anschreiben-Composer, WYSIWYG-Vorschau, Testmail, Mail-Versand mit
Zustell-Tracking, öffentliche Angebotsseite mit Optionswahl, Annahme (online
und offline erfasst) → Anzahlungs-Checkout, Angebots-Rückzug, automatisches
Nachfassen, Verlustgründe, View-Tracking. Dieses Modul IST die Nordstern-
Metrik: `sent_at` stempelt „Minuten bis Angebot", Annahme stempelt „Tage bis
gewonnen".

## A — IST im Alt-System (mit Evidenz)

Zugehörige Inventar-Funktionen (docs/MAESTRO-FEATURE-INVENTAR.md, Abschnitte
„Angebot", „E-Mail/Zustellung", „Angebot (Anfrage-Editor)"): Angebots-Mail mit
Link + optionalem LexOffice-PDF (de/en/it/fr, CC/BCC, Threading, Dry-Run) ·
KI-Anschreiben-Composer mit Vorlagen/Textbausteinen/Variablen · WYSIWYG-Versand-
vorschau (Dry-Run) · Testmail aus der Preview · versionierte Angebots-Historie ·
öffentliche Angebotsseite per Slug · Kunden-Antwort (Option + Anmerkung) ·
Öffnungs-Tracking & Verlustgründe · Offline-/Telefon-Annahme · Annahme ohne
Stripe (vor Ort/Rechnung) · Stripe-Payment-Link je Option · zweistufige
Nachfass-Mails · Zustell-Tracking (email_delivery_logs, Resend-Webhook,
SMTP-Fallback) · Kundenreaktions-Benachrichtigung + Kundenkopie ·
Betreiber-Adressen-Schutz.

Nachweislich unfertig/fehlerhaft:

1. **Auto-Nachfassen läuft gegen die Legacy-Tabelle** —
   `supabase/functions/send-scheduled-reminders/index.ts` (Z. 211–215) liest
   `event_inquiries` mit `status='offer_sent'`; der Versand-Flow schreibt aber
   `v2_events.offer_phase='proposal_sent'` (`send-offer-email/index.ts`
   Z. 686–691). Kein `cron.schedule` für die Funktion in den Migrationen.
   Das beworbene Tag-3/Tag-7-Nachfassen ist für v2-Vorgänge de facto tot.
2. **Empfänger per Zeitfenster geraten** — `src/hooks/useOfferHistory.ts`
   (Z. 49, 92–117): Die Historie speichert keinen Empfänger; er wird über das
   „nächstgelegene outbound-Mail-Log (±5 min)" plus Subject-Regex
   `/angebot|offer/i` rekonstruiert. Beleg-Charakter der Historie ist damit
   heuristisch, nicht garantiert.
3. **Zustellstatus systematisch verwässert** —
   `receive-resend-webhook/index.ts` (Z. 4–21, Kommentar): `email.delivered`
   wird bewusst nur auf „sent" gemappt, weil EINE Resend-`email_id` Kunde und
   Archiv-BCC gemeinsam abdeckt („der Kunde kann auf der Suppression-List
   stehen"). `email.opened` wird ebenfalls auf „sent" gemappt — Mail-Öffnungen
   werden verworfen.
4. **12-Sekunden-Timer als Webhook-Ersatz** — `send-offer-email/index.ts`
   (Z. 740–825): „Aktive Nachverifizierung bei Resend (Webhook ist nicht
   garantiert)" — `setTimeout(12s)` + `EdgeRuntime.waitUntil`, danach ggf.
   SMTP-Nachschuss über eine zweite Edge Function (`resend-via-smtp`).
5. **Mail-Link ignoriert das Öffnungs-Tracking** — `send-offer-email`
   generiert und speichert den Slug (Z. 371–377), verlinkt in der Mail aber
   `https://events-storia.de/offer/${inquiryId}` (Z. 384, UUID-Route);
   `PublicOffer.tsx` (Z. 364) pingt `track_offer_view` nur auf der Slug-Route
   (`!isSlugRoute return`). Der Haupt-Klickpfad aus der Mail wird nicht gezählt.
6. **Mandant hart verdrahtet** — From `info@events-storia.de` (Z. 186),
   Archiv-BCC (Z. 510), Betreiber-Domainliste (Z. 322–326), Testmail-Empfänger
   `antoine@monot.com` (Z. 552), Footer-NAP „Karlstraße 43" (Z. 455 —
   widerspricht der zentralen NAP-Vorgabe Karlstr. 47a). Nichts davon ist
   mandantenfähig.
7. **PDF-Warteschleife im Sendepfad** — `waitForLexOfficePdf` (Z. 106–158):
   bis zu 5 Retries mit Backoff blockieren den Versand; scheitert es, geht die
   Mail ohne Anhang raus plus Alarm-Mail an den Betreiber (Z. 629–641).
8. **Race bei der HTML-Archivierung** — Z. 693–720: Das versendete HTML wird
   nachträglich in die „höchste History-Version (vom Frontend kurz vorher
   angelegt)" geschrieben; existiert keine Zeile, nur ein `console.warn`.
9. **Float-Euros am Geld-Übergang** — `create-offer-payment-link/index.ts`
   (Z. 13): `amount: number; // in EUR (e.g., 2415.00)` +
   `Math.round(amount * 100)` (Z. 117). Verstößt gegen die Cents-Leitplanke;
   pro Option werden Stripe-Product/Price/PaymentLink-Objekte erzeugt.
10. **Public-Page-Monolith mit Legacy-Zöpfen** — `PublicOffer.tsx` (2.494 Z.):
    Kommentar Z. 596 „Legacy: offer_phase='draft' aber status='offer_sent' →
    wie final_sent behandeln", doppelte Legacy-Drink-Parser (Z. 1397, 1694),
    vier Routen-Aliasse (`/offer/:id`, `/ihr-angebot/:slug`, `/en/...`).

Neubau-Stand (`/home/user/maestro-cloud`): `POST /api/events/:id/offers/send`
existiert (Options-Snapshot in `offer_history`, Versions-Bump, stabiler
Public-Token, Status `offer_sent`, `offerSentAt`) — versendet aber **keine
Mail** (kein Mail-Code im Repo). Public-Flow existiert: `GET
/api/public/offer/:token` + `POST .../respond` über SECURITY-DEFINER-RPCs mit
Rolle `maestro_public` (kein Existenz-Leak), Web-Seite `offer-public.tsx`
(Route `/angebot/:token`, Optionswahl + Notizen + Annehmen). Stripe-Checkout
ist bewusst Stub (`payments.ts` Z. 110: „TODO(stripe keys)").

## B — Der eigentliche Job (Jobs-to-be-done)

**Job:** „Bring mein fertiges Angebot in unter 2 Minuten zustellsicher zum
Kunden, lass ihn auf einem Screen ansehen → wählen → Änderung wünschen →
annehmen → anzahlen, und fasse automatisch nach, bis gewonnen oder ein
Verlustgrund dokumentiert ist." Telefonische Zu-/Absagen (Gastro-Realität,
1–20 MA) gehören dazu und werden als Offline-Aktion erfasst (s. D). Alles
nach dem Builder (Spec 02) bis zur bezahlten Anzahlung (Zahlungs-Modul) ist
dieses Modul.

**Gestrichen / zusammengelegt (mit Begründung):**
- **IONOS-SMTP-Fallback + 12s-Nachverifizierung gestrichen.** Symptome der
  einen geteilten Absenderadresse (Suppression traf alle). Ersatz: Queue mit
  Retry, Webhook je Empfänger, Sending-Domain-Stufen (s. D).
- **Slug-URLs gestrichen** (`/ihr-angebot/max-mustermann-a851`). Kundennamen
  in URLs sind ein DSGVO-Geruch, der Slug wurde in der Mail ohnehin nie
  verlinkt (Befund A5). Ein hoch-entropischer Token-Link (Neubau, existiert).
- **Archiv-BCC an info@ gestrichen.** `offer_sends` speichert das gerenderte
  HTML — das Archiv liegt in der App, nicht im Postfach. (Optionales
  BCC bleibt Tenant-Setting.)
- **±5-Min-Empfänger-Matching gestrichen** — Empfänger/CC/BCC werden am
  Versanddatensatz persistiert, fertig.
- **LexOffice-PDF-Anhang aus dem Sendepfad gestrichen.** Das Web-Angebot ist
  das Angebot (Table Stakes 2026: „PDF ist out"); PDF gibt es als Download auf
  der Angebotsseite (eigener Renderer, s. D). Der Versand wartet nie wieder
  auf LexOffice.
- **Proposal-/Final-Doppelwelt zusammengelegt** (ProposalView vs.
  FinalOfferView): EINE Angebotsseite mit Optionen; „final" ist schlicht eine
  neue Version nach Änderungswunsch.
- **Kundenreaktions-Benachrichtigung + Kundenkopie + Buchungsbestätigung
  zusammengelegt** in eine Bestätigungs-Pipeline (ein Renderer, zwei
  Empfänger).
- **IT/FR gestrichen** — Produktsprachen DE + EN.
- **Betreiber-Domainliste gestrichen** — generische Warnung, wenn Empfänger
  zur Mandanten-Domain oder einem Teammitglied gehört.
- **Storia-only ausgelagert:** eSignatures.com-Kostenübernahme,
  Restaurant-Galerie (wird generisches Branding-Bild je Mandant).

## C — Benchmark 2026

Table Stakes (Digest): Web-Angebot mit Branding + E-Signatur/Click-Accept +
Anzahlung direkt bei Annahme + Auto-Follow-ups + Engagement-Tracking. Tripleseat
setzt den Massstab „Ein-Screen-Annahme" und warnt bei Kalender-Konflikten
(Holds); PartyPay fordert die Anzahlung automatisch nach Signatur an. MICE
DESK/Proposales tracken Planner-Engagement (Angebot geöffnet →
Nachfass-Trigger) und 1-Klick-Change-Requests. iVvy/hivr.ai: KI-Follow-up mit
Human-in-the-Loop-Schwellen. Perfect Venue: automatische Erinnerungen +
Anzahlung/Restzahlung automatisiert, AI Reply in allen Tiers.

**Gleichziehen:** Web-Angebot mit Optionswahl (Neubau-Basis existiert),
Click-to-Accept, Anzahlungs-Checkout direkt nach Annahme, Auto-Follow-ups,
View-/Engagement-Tracking, Konflikt-Check bei Annahme (Tripleseat-Holds),
strukturierter Änderungswunsch statt E-Mail-Pingpong.

**Bewusst schlagen:**
1. **Nordstern sichtbar:** „Minuten bis Angebot" wird beim Senden live
   angezeigt und im Dashboard benchmarkt („schneller als X % vergleichbarer
   Betriebe") — kein Wettbewerber zeigt das. Metrik-Definition s. D.
2. **Verlustgrund vom Kunden selbst:** Höfliche „Leider nein"-Option mit
   Grund-Auswahl auf der Angebotsseite — Conversion-Daten, die sonst niemand
   erhebt (Status quo: 23 % der Anbieter antworten nie, Gründe unbekannt).
3. **DACH-sauber:** DE/EN; DSGVO-armes Tracking: Primärsignal ist ein
   First-Party-View-Ping mit Bot-Heuristik (kein Pixel-Zwang);
   Provider-Open-/Klick-Tracking nur als Opt-in-Tenant-Setting mit
   DSGVO-Hinweis. AGB-Version + Zeitstempel + IP + Betrags-Snapshot als
   Annahme-Beleg, SEPA/Klarna im Checkout — US-Tools liefern das nicht
   lokalisiert.

## D — Soll-Design (Neubau)

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)
1. Aus dem Builder: „Vorschau & Senden" öffnet den **Composer**: links
   Anschreiben (KI-Entwurf-Button, Vorlagen, Textbausteine, Variablen-Chips
   {{name}} {{datum}} {{gaeste}}), rechts Empfänger (vorausgefüllt), CC/BCC,
   Betreff, Sprache DE/EN. Warn-Chip bei Betreiber-/Team-Adresse als Empfänger.
2. **WYSIWYG-Vorschau** als Tabs: E-Mail (Desktop/Mobil) · Angebotsseite
   (echte Public-Page mit Preview-Marker) — gerendert vom SELBEN Server-Code
   wie der echte Versand (Dry-Run-Endpoint, keine zweite Render-Logik).
3. **Testmail**-Button: sendet an den eingeloggten User (+ optionale
   Team-Adressen aus Settings), Betreff-Präfix „[TEST]", kein Statuswechsel,
   als `kind='test'` protokolliert.
4. **Senden**: transaktional Options-Snapshot (existiert) + `offer_sends`-Zeile
   + Queue-Job; UI zeigt sofort den Nordstern-Moment: „Angebot versendet —
   47 Minuten nach Anfrage-Eingang ⚡" (Metrik-Definition s. u.).
5. **Zustellprotokoll** am Vorgang: Chip-Kette queued → sent → delivered →
   viewed (plus opened/clicked, falls Provider-Tracking aktiviert) bzw.
   bounced/complained; Bounce erzeugt Aufgabe + Banner mit Klartext-Erklärung
   und Alternativvorschlag (Nummer anrufen, Adresse prüfen).
6. **Kunde** öffnet `/angebot/:token` (kein Login): Branding des Mandanten,
   Anschreiben, Options-Karten mit Preisen, Sticky-CTA. Aktionen:
   **Option wählen** (Wechsel bis zur Annahme erlaubt) · **Änderung wünschen**
   (strukturiertes Feld + Chips „Gästezahl", „Termin", „Menü", „Budget") ·
   **Annehmen** (AGB-Checkbox, Name-Bestätigung) · **Leider absagen**
   (Grund-Auswahl, optional Freitext).
7. Nach **Annahme** (Versions- + Verfügbarkeits-Check, s. „Annahme
   gehärtet"): Status → `accepted`, `won_at` gestempelt („Tage bis gewonnen")
   — unabhängig vom Zahlungsweg. Danach direkt Anzahlungs-Checkout (Stripe
   Connect Session; Karte/SEPA/Klarna/Wallets) oder, bei Zahlungsbedingung
   „vor Ort/Rechnung", sofortige Bestätigungsseite. Bestätigungs-Mail an
   Kunde + Team.
8. **Änderungswunsch** → Inbox/Aufgabe beim Betreiber, Nachfass-Kadenz
   pausiert; Betreiber baut neue Version im Builder, Re-Send nutzt denselben
   Token (Kunde behält einen Link); der Versions-Check (s. u.) schützt vor
   Annahme veralteter Seiten.
9. **Automatisches Nachfassen** (s. Automatisierungen) bis Reaktion, Annahme,
   Absage, Rückzug oder Ablauf der Angebotsgültigkeit; Ablauf zeigt auf der
   Seite „Angebot abgelaufen — Verfügbarkeit erneut anfragen".

### Zustandsmaschine (Angebots-Lebenszyklus)
Erweitert die Neubau-Zustände (`06_public_offer.sql`). Erlaubte Übergänge:
`draft → offer_sent` (Erstversand) · `offer_sent → offer_chosen` (Kunde wählt;
Optionswechsel bis zur Annahme erlaubt, letzte Wahl zählt) ·
`offer_sent|offer_chosen → change_requested` (Änderungswunsch, Kadenz
pausiert) · `change_requested → offer_sent` (Re-Send neuer Version: setzt die
gewählte Option zurück, `current_offer_version`++) ·
`offer_sent|offer_chosen → accepted` (Click-Accept oder Offline-Aktion;
stempelt `won_at`) · `offer_sent|offer_chosen → accepted_pending`
(Accept bei Slot-Konflikt, s. u.; Freigabe → `accepted`, sonst Absage) ·
`offer_sent|offer_chosen → offer_declined` (Kunde/Betreiber, mit Grund);
Reaktivierung eines `offer_declined` NUR durch expliziten Re-Send des
Betreibers · `offer_sent|offer_chosen → expired` (`offer_valid_until`
überschritten) bzw. `→ withdrawn` (Betreiber zieht zurück); beide per Re-Send
zurück nach `offer_sent`. `accepted` ist terminal bis Storno (Zahlungs-Modul).
`get_public_offer` liefert nur die Whitelist `offer_sent · offer_chosen ·
change_requested · accepted` (Bestätigungsansicht) `· expired · withdrawn`
(neutraler Zustand + Kontakt-CTA); alles andere ist von außen nicht
unterscheidbar von einem falschen Token.

### Annahme (gehärtet)
- **Versions-Bindung:** Accept-Payload enthält `offerVersion`; der Server
  vergleicht mit `current_offer_version`. Mismatch (alte Seite offen, Re-Send
  nutzt denselben Token) → 409 + UI-Prompt „Angebot wurde aktualisiert —
  Seite neu laden". Der Server persistiert `accepted_amount_cents` als
  Snapshot in `offer_responses` — der Beleg dokumentiert exakt den vom Kunden
  gesehenen Preis (stützt Risiko G2).
- **Verfügbarkeits-Check:** Der Accept-RPC prüft Datum/Raum gegen bereits
  gewonnene/bestätigte Events des Mandanten. Konflikt → Zustand
  `accepted_pending` („wird bestätigt") + Sofort-Aufgabe an den Betreiber
  statt Auto-Confirm; der Kunde sieht „Wir bestätigen den Termin umgehend".
  Optional (Registry): Hold beim Senden reserviert den Slot.
- **Annahme vs. Zahlung:** `accepted` + `won_at` beim Accept-Klick (Vertrag
  ist formfrei, G2) — auch im Stripe-Pfad. Zahlungsstatus lebt separat im
  Zahlungs-Modul. Abgebrochener/abgelaufener Checkout (Stripe-Session, 24 h)
  → eigene Zahlungs-Erinnerungs-Kadenz + Aufgabe (PartyPay-Muster: Anzahlung
  wird nach Annahme automatisch angefordert).
- **Offline-Erfassung:** „Als angenommen markieren" am Vorgang: Option
  wählen, Zahlungsbedingung setzen, optional Payment-Link per Mail;
  protokolliert als `offer_responses.kind='accepted_offline'` mit `sent_by`,
  stempelt `won_at`, setzt `accepted_option_id`, stoppt die Kadenz. Analog
  „Als abgesagt markieren" mit Verlustgrund (`declined_offline`).
- **Rückzug:** „Angebot zurückziehen" (Preisfehler, Slot anderweitig
  vergeben): Public-Seite → neutraler Zustand + Kontakt-CTA, Accept-RPC
  verweigert, Follow-ups stoppen.

### Nordstern-Metrik (Definition)
„Minuten bis Angebot" = Erstversand (`kind='offer'`, Version 1) minus
`inquiry.received_at`; Re-Sends/neue Versionen zählen nicht erneut. Bei
manuell nacherfassten/telefonischen Anfragen ist `received_at` beim Anlegen
korrigierbar (Default Anlagezeitpunkt, markiert „nacherfasst", vom Benchmark
ausgenommen). Anzeige und Benchmark rechnen Business-Hours-adjustiert
(Tenant-Öffnungszeiten: Anfrage 23:00, Versand 9:00 = top, nicht 600 Min).
Badge/⚡ nur unterhalb einer Schwelle (Default 120 Business-Minuten), sonst
neutrale Anzeige. Der anonyme Benchmark nutzt nur normalisierte Werte.

### Datenmodell (Neon Postgres, Cents, tenant_id + RLS FORCE überall)
`offer_sends` (NEU — ersetzt email_delivery_logs+v2_event_emails-Doppelung im Angebotsflow):
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
`offer_send_events` (NEU, append-only): `tenant_id → tenants (crudPolicy
tenantIsMember, FORCE RLS — wie die Schwester-Tabellen, inkl. Isolationstest)
· send_id → offer_sends · type · occurred_at · provider_event_id text ·
raw jsonb`. Idempotenz primär per Unique auf `provider_event_id` (svix-id);
`(send_id, type, occurred_at)` nur Fallback für Provider ohne Event-ID.
`offer_responses` (NEU): `tenant_id · event_id · offer_version · kind
check ('option_chosen'|'change_request'|'accepted'|'accepted_offline'|
'declined'|'declined_offline') · option_id null · accepted_amount_cents int
null (Snapshot) · notes · decline_reason check ('too_expensive'|
'date_unavailable'|'booked_elsewhere'|'plan_cancelled'|'other') ·
accepted_terms_version text · ip inet · user_agent text · sent_by uuid null
(Offline-Erfassung) · created_at`. Public-Insert nur über
SECURITY-DEFINER-RPC; `*_offline` nur über Team-Endpunkte.
`events` (Erweiterung): `offer_state (s. Zustandsmaschine) ·
offer_first_viewed_at · offer_last_viewed_at · offer_view_count ·
offer_valid_until date · won_at · loss_reason · loss_reason_note ·
follow_up_paused_at · accepted_option_id`.
`tenant_settings` (Erweiterung): `mail_from_name · reply_to_email ·
sending_domain_status ('platform'|'subdomain_pending'|'subdomain_verified'|
'custom_pending'|'custom_verified') · archive_bcc · follow_up_cadence int[]
default '{3,7}' · follow_up_auto_send boolean + auto_send_max_value_cents ·
terms_url + terms_version · test_recipients · provider_open_tracking boolean
default false (DSGVO-Hinweis in UI) · business_hours jsonb ·
retention_raw_days int default 30 · retention_lost_months int default 24`.

### Retention & Löschkonzept (DSGVO)
- `offer_send_events.raw` wird nach `retention_raw_days` per Purge-Job (Cron,
  nightly) auf extrahierte Felder reduziert (`type`, `occurred_at`,
  `provider_event_id` bleiben).
- Verlorene/abgelaufene Vorgänge: `rendered_html`, `recipient_email`, `ip`,
  `user_agent` werden nach `retention_lost_months` anonymisiert. Annahme-
  Belege gewonnener Events bleiben (berechtigtes Interesse/Beweissicherung,
  gesetzliche Aufbewahrung).
- Details im zentralen Löschkonzept (Plattform-Spec); der Purge-Job gehört zu
  diesem Modul (Bau-Schritt 12).

### Mail-Provider-Entscheidung (explizit)
**Resend als primärer Provider.** Gründe: im Alt-System produktionsbewährt
(Webhook-/svix-Verifikation als Code-Muster vorhanden), Domains-API für
mandantenfähigen Domain-Setup, Idempotency-Keys, DPA/AVV verfügbar.
Deliverability-Architektur dreistufig (entschieden — bei Resend ist jede
Subdomain eine eigene Domain mit eigenen DKIM-Records, „Subdomain je Mandant"
gibt es also NICHT gratis):
- **Stufe 1 (Default, Time-to-Value < 15 Min): EINE Plattform-Domain**
  `angebote@mail.maestro.app`; From-Name = Betriebsname, **Reply-To = echte
  Mandanten-Adresse**. Ehrlich: keine Reputations-Isolation (der lokale Teil
  der Adresse isoliert nichts) — Schutz kommt aus Complaint-/Bounce-Monitoring
  mit automatischem Kill-Switch pro Mandant + Rate-Limit für neue Tenants.
- **Stufe 1.5 (automatisch nachgelagert): Subdomain je Mandant**
  `<slug>.mail.maestro.app` via Provisioning-Job beim Tenant-Anlegen:
  Resend-Domains-API + Cloudflare-DNS-API (Plattform kontrolliert die Zone),
  Verifikation asynchron; bis `subdomain_verified` sendet der Tenant über
  Stufe 1 (kein Time-to-Value-Verlust). Domain-Quota/Limits und Fehlerpfad
  (Retry, Betreiber-Task, Verbleib auf Stufe 1) im Adapter dokumentiert.
- **Stufe 2 (Pro-Tier):** eigene Mandanten-Domain via Resend-Domains-API:
  Settings-UI zeigt die 3 DNS-Records + Live-Verifikations-Check; erst nach
  `custom_verified` wechselt der From. NIE From = Mandanten-Domain ohne
  Verifikation (DMARC-Fail garantiert).
- **Kein hart verdrahteter Zweit-Provider.** Der Alt-SMTP-Fallback heilte
  Suppression-Probleme der geteilten Adresse; ein Retry auf einen Hard-Bounce
  heilt nichts. Provider-Zugriff hinter ein Adapter-Interface
  (`packages/mail`), sodass Postmark/SES später Registry-Option werden können.
- Betrieb: Suppression-Liste pro Mandant sichtbar, DMARC-Reports auf der
  Plattform-Domain, Abuse-Kill-Switch pro Mandant, Rate-Limit für neue Tenants.

### API (Hono-Worker)
- `POST /api/events/:id/offers/render-preview` — Dry-Run: Mail-HTML +
  Public-Page-Daten, keine Writes.
- `POST /api/events/:id/offers/test-send` — Testmail, `kind='test'`.
- `POST /api/events/:id/offers/send {recipient, cc, bcc, subject, letter,
  language}` — erweitert den bestehenden Send-Endpoint: Snapshot + Token
  (existiert) + `offer_sends`-Insert + Queue-Job. Totals/Status serverseitig.
- `POST /api/events/:id/offers/mark-accepted` · `.../mark-declined` ·
  `.../withdraw` — Offline-Aktionen/Rückzug (s. „Annahme gehärtet",
  Zustandsmaschinen-Guards serverseitig).
- `GET /api/events/:id/sends` — Zustellprotokoll inkl. Events.
- `POST /api/webhooks/email` — svix-verifiziert, idempotent per
  `provider_event_id`, Status-Maschine mit Downgrade-Schutz (Muster aus
  Alt-Webhook übernehmen); bounce/complaint → Aufgabe + Badge.
- Public (Rolle `maestro_public`, nur RPC-EXECUTE): `GET /api/public/offer/
  :token` (existiert, Status-Whitelist s. Zustandsmaschine) · `POST .../view`
  — First-Party-View-Ping: JS-basiert nach Delay/Interaktion, UA-/Bot-Filter
  (Outlook SafeLinks, GMX-Prefetch, bekannte Scanner), HEAD/Prefetch zählen
  nicht; `?preview=1`-Aufrufe des Teams zählen nicht (schließt Befund A5) ·
  `POST .../respond` (erweitert um `kind`, `decline_reason`) · `POST
  .../accept {optionId, termsVersion, offerVersion}` → `{checkoutUrl |
  confirmed | pending_review}`; 409 bei Versions-Mismatch.

### Automatisierungen (Cloudflare Queues + Cron)
- **Send-Queue** mit Retry/Backoff (ersetzt 12s-Timer); Dead-Letter → Aufgabe.
- **Follow-up-Engine (Cron, stündlich):** Kandidaten = `offer_sent`, keine
  Response, Kadenz (Default T+3/T+7) fällig, nicht pausiert, Gültigkeit nicht
  abgelaufen, nicht zurückgezogen. KI-Entwurf; Auto-Send nur wenn
  `follow_up_auto_send` UND Eventwert < Schwelle, sonst Freigabe-Task
  (iVvy-Muster). Jede Kundenreaktion (View reicht nicht;
  Response/Inbound-Mail/Zahlung/Offline-Statuswechsel schon) pausiert.
- **Zahlungs-Erinnerung:** `accepted` ohne abgeschlossene Anzahlung (Checkout
  abgebrochen/abgelaufen) → eigene Erinnerungs-Kadenz + Aufgabe; getrennt von
  der Angebots-Kadenz (die mit der Annahme endet).
- **Engagement-Trigger:** basiert auf `viewed` (First-Party, bot-gefiltert),
  NICHT auf Provider-`opened`: `viewed` ohne Antwort nach 48 h →
  Nachfass-Vorschlag; nie `viewed` nach 48 h → Hinweis „anderer Kanal"
  (Telefon; WhatsApp in Welle 2).
- **Ablauf-Handling:** 2 Tage vor `offer_valid_until` letzte Erinnerung;
  danach Angebotsseite → „abgelaufen", Vorgang → Aufgabe „nachfassen oder
  Verlustgrund setzen".
- **Retention-Purge (nightly):** s. Retention-Abschnitt.
- **Nordstern-Aggregation (nightly):** Minuten bis Angebot (normalisiert,
  s. Definition) / Tage bis gewonnen pro Tenant + anonymer Benchmark.

### KI-Punkte (Input → Vorschlag → Bestätigung)
1. **Anschreiben:** Anfrage + Angebotsstand + Mandanten-Tonalität → Entwurf im
   Composer; Erstversand nie ohne Menschen.
2. **Follow-up-Texte:** personalisiert (Bezug auf Optionen, View-Verhalten);
   Auto-Send nur unter konfigurierten Schwellen.
3. **Änderungswunsch-Parsing:** Kundennotiz → strukturierte Vorschläge
   („Gästezahl 40→55, Option B, vegetarisch +6") als Builder-Draft.
4. **Verlustgrund-Vorschlag:** Absage-Freitext → vorbelegtes Dropdown.

### Integrations-Berührungen
- **Stripe Connect:** Checkout-Session (nicht PaymentLink-Objekte) mit
  `application_fee`, Metadata `payment_id` (Webhook-Bindung existiert im
  Neubau); Beträge nur Cents. PayPal-Lücke: Welle 3 (Digest).
- **PDF-Download:** eigener HTML→PDF-Render aus dem EINEN Renderer (derselbe
  wie Mail/Page, zahlt auf AK2 ein) als Default für ALLE Mandanten — nicht an
  LexOffice gekoppelt. Async erzeugt; bis dahin zeigt die Angebotsseite
  „PDF wird erstellt" mit Auto-Refresh.
- **LexOffice:** nur Rechnungswesen/Buchhaltung (Rechnung nach Annahme) —
  Zahlungs-/Rechnungs-Modul.
- **Inbound-E-Mail (Cloudflare Email Routing):** Antworten auf Reply-To landen
  im Inbox-Modul und pausieren die Follow-up-Kadenz.
- **WhatsApp (Welle 2):** Follow-up-Kanal via BSP; gleiche Kadenz-Engine.

## E — Klassifikation

**Kern.** Versand, Public-Page, Annahme (online + offline), Rückzug,
Zustell-Tracking und Nachfassen sind der Abschluss-Flow — nicht abschaltbar.
Per Registry (B10) zuschaltbar: eigene Sending-Domain (Pro-Tier), Auto-Send
der Follow-ups, WhatsApp-Kanal, Provider-Open-Tracking, Slot-Hold beim
Senden. **Storia-only:** eSignatures.com-Kostenübernahme, IT/FR-Texte,
Restaurant-Galerie-Inhalte (Mechanik wird generisches Branding). Kriterium wie
Spec 02: brauchen < 30 % der Zielmandanten es am Tag 1? → Registry/Fork.

## F — Bau-Plan

| # | Schritt | Abhängig von | Aufwand | Neu |
|---|---------|--------------|---------|-----|
| 1 | Migration: `offer_sends`, `offer_send_events` (inkl. tenant_id + provider_event_id-Unique), `offer_responses`, Events-/Settings-Felder, Zustandsmaschinen-Guards, RLS + FORCE + Isolationstests für ALLE drei Tabellen | — | S | Tabellen |
| 2 | `packages/mail`: Resend-Adapter (Stufe 1: Plattform-Domain), EIN Renderer (Send=Preview=Test=PDF), Send-Queue mit Retry | 1 | M | Paket |
| 3 | Send-Endpoint ausbauen (Composer-Payload, `offer_sends`, Queue, Nordstern-Stempel inkl. Metrik-Definition) + render-preview + test-send | 2 | M | Endpunkte |
| 4 | Composer-UI (Anschreiben, Vorlagen, Variablen, Empfänger, Warnungen) + Vorschau-Tabs + Testmail | 3 | L | UI |
| 5 | Webhook `/api/webhooks/email` (provider_event_id-Idempotenz) + Status-Maschine + Zustellprotokoll-UI + Bounce-Aufgabe | 2 | M | Endpunkt/UI |
| 6 | Public-Page-Ausbau: View-Ping mit Bot-Heuristik, Änderungswunsch, Annahme (offerVersion/Konflikt-Check/AGB/IP/Betrags-Snapshot), Absage mit Grund, Ablauf-/Rückzugs-Zustand | 1 | L | UI/RPCs |
| 7 | Vorgangs-Aktionen: Als angenommen/abgesagt markieren, Angebot zurückziehen | 1 | S | UI/Endpunkte |
| 8 | Annahme → Stripe-Checkout-Session (Connect, Cents) + Bestätigungs-Mails + Zahlungs-Erinnerungs-Kadenz | 6, Zahlungs-Modul | M | Endpunkt |
| 9 | Follow-up-Engine: Cron, Kadenz, Pausierung, KI-Entwurf, Freigabe-Task, Auto-Send-Schwellen | 3,5,6 | L | Cron/Queue |
| 10 | Sending-Domains Stufe 1.5/2: Provisioning-Job (Resend-Domains-API + Cloudflare-DNS), Settings-UI, DNS-Check, Fehlerpfad | 2 | M | UI/Adapter |
| 11 | Nordstern-Dashboard-Kacheln (Minuten bis Angebot, Tage bis gewonnen, Benchmark, Business-Hours-Normalisierung) | 3,8 | M | UI/Cron |
| 12 | Retention-Purge-Job (raw-Reduktion, Anonymisierung verlorener Vorgänge) | 1 | S | Cron |
| 13 | KI: Anschreiben-, Follow-up-, Änderungswunsch-, Verlustgrund-Endpunkte | 3,6,9 | L | Endpunkte |

Kritischer Pfad 1→2→3→4 (erster echter Versand), dann 5/6/7 parallel; 8–13 danach.

## G — Risiken & Lösungen (Top 4)

1. **Plattform-Deliverability** — ein Spam-Mandant ruiniert die Zustellrate
   aller. → Stufe-1-Kill-Switch (Complaint-/Bounce-Monitoring), Rate-Limits
   für neue Tenants, automatische Subdomain-Isolation ab Stufe 1.5,
   DMARC-Reports; Custom Domain als Pro-Ausweg. Akzeptanztest: Seed-Liste
   (Gmail/Outlook/GMX/web.de).
2. **Doppelbuchung durch Auto-Annahme** — zwei offene Angebote für denselben
   Slot, beide Kunden klicken „Annehmen" (Tripleseat löst das mit
   Holds/Kalender-Warnung). → Serverseitiger Datums-/Raum-Konfliktcheck im
   Accept-RPC; Konflikt → `accepted_pending` + Sofort-Aufgabe statt
   Auto-Confirm; optionales Hold beim Senden (Registry). AK 12.
3. **Rechtsverbindlichkeit der Annahme** ohne eIDAS-Signatur. → Gastro-Verträge
   sind formfrei: Click-to-Accept mit protokollierter AGB-Version, IP,
   User-Agent, Zeitstempel UND Versions-Bindung + `accepted_amount_cents`
   (`offer_responses`) — der Beleg zeigt exakt den gesehenen Preis — +
   doppelseitiger Bestätigungs-Mail; qualifizierte E-Signatur bleibt
   optionales Modul für Firmen-/Kostenübernahme-Fälle.
4. **Follow-up-Automatik nervt** (Kunde hat telefonisch zu-/abgesagt, System
   mailt weiter). → Offline-Aktionen (AK 13) stoppen die Kadenz sofort; ebenso
   Inbound-Mail-Zuordnung, Zahlung, Response; 1-Klick-Stopp am Vorgang;
   Reminder-Cap (max. Kadenz-Länge); Abmeldelink in jeder Nachfass-Mail
   (DSGVO).

## H — Akzeptanzkriterien

1. Versand aus dem Composer stempelt `offer_sent_at`; „Minuten bis Angebot"
   zählt nur den Erstversand, basiert auf korrigierbarem
   `inquiry.received_at`, wird Business-Hours-adjustiert angezeigt und
   aggregiert; ⚡-Badge nur unterhalb der Schwelle, nacherfasste Anfragen
   fließen nicht in den Benchmark.
2. Vorschau, Testmail, echter Versand und PDF-Download erzeugen
   byte-identisches HTML aus derselben Render-Funktion (Golden-Test).
3. Testmail geht nur an User/Team-Adressen, ändert keinen Status und erzeugt
   keinen Kundenkontakt.
4. Jede Zeile im Zustellprotokoll trägt Empfänger/CC/BCC/HTML direkt am
   Datensatz; Statuswechsel kommen per signiertem Webhook, Failure-Status
   wird nie durch spätere Success-Events überschrieben; ein erneut
   zugestelltes Webhook-Event (gleiche `provider_event_id`) erzeugt keine
   zweite Zeile.
5. Ein Hard-Bounce erzeugt innerhalb 1 Minute sichtbaren Fehler + Aufgabe mit
   Klartext-Erklärung (kein englischer Provider-Rohtext).
6. Der Kunde durchläuft öffnen → Option wählen → annehmen → Anzahlungs-Checkout
   ohne Login auf 390 px Breite; `accepted` + `won_at` werden beim
   Accept-Klick gestempelt — im Stripe-Pfad WIE im „vor Ort/Rechnung"-Pfad;
   ein abgebrochener Checkout startet die Zahlungs-Erinnerungs-Kadenz +
   Aufgabe, ohne den `accepted`-Status zu berühren.
7. Kundenaufrufe über den Mail-Link erhöhen `offer_view_count`
   (first/last_viewed korrekt); Team-Vorschau zählt nicht; Link-Scanner und
   Prefetcher (Outlook SafeLinks, GMX) erhöhen den Zähler nicht
   (Bot-Heuristik-Test).
8. Änderungswunsch erzeugt strukturierte Aufgabe beim Betreiber und pausiert
   die Nachfass-Kadenz; Re-Send nach neuer Version nutzt denselben Token-Link,
   setzt die gewählte Option zurück und erhöht `current_offer_version`.
9. Annahme einer veralteten Version wird abgewiesen — 409 + Reload-Prompt
   „Angebot wurde aktualisiert" (automatisierter Test); `offer_responses`
   persistiert `accepted_amount_cents` der tatsächlich angenommenen Version.
10. Annahme bei bereits gewonnenem Konkurrenz-Event am selben Slot erzeugt
    keinen `accepted`-Status ohne Freigabe (→ `accepted_pending` +
    Sofort-Aufgabe, automatisierter Test).
11. „Als angenommen markieren" stempelt `won_at`, setzt `accepted_option_id`,
    stoppt die Kadenz und protokolliert `accepted_offline` mit `sent_by`;
    „Als abgesagt markieren" erfasst den Verlustgrund analog.
12. Ein zurückgezogenes Angebot ist nicht annehmbar (Accept-RPC verweigert),
    die Public-Seite zeigt den neutralen Zustand + Kontakt-CTA, Follow-ups
    stoppen.
13. Follow-ups feuern nach T+3/T+7 nur ohne Kundenreaktion; Annahme, Absage,
    Rückzug, zugeordnete Inbound-Mail, Zahlung oder Offline-Statuswechsel
    stoppen die Kadenz sofort (automatisierter Test); über der Wert-Schwelle
    wird nie ohne Freigabe gesendet.
14. Purge-Job entfernt Webhook-Rohdaten älter als `retention_raw_days` und
    anonymisiert Sends/Responses verlorener Vorgänge nach
    `retention_lost_months` (automatisierter Test).
15. RLS-Isolationstest: Mandant A sieht keine `offer_sends`/
    `offer_send_events`/`offer_responses` von Mandant B; der Public-Zugriff
    funktioniert ausschließlich über (Subdomain-Slug + Token)-Doppel-Match via
    SECURITY-DEFINER-RPC — falscher Token, falscher Tenant und falscher
    Status sind von außen nicht unterscheidbar.
