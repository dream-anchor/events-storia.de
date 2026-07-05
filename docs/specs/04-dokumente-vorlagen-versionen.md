# Dokumente, Vorlagen & Versionen

Modul-Spec MAESTRO · Stand 2026-07-05 · Status: entscheidungsreif
Scope: Angebots-PDF, E-Mail-/Text-Vorlagen mit {{Variablen}} und bedingter
Logik, Textbausteine, Signaturen je Teammitglied, unveränderliches
Versionsarchiv, Klonen alter Versionen, DE/EN-Übersetzung der Kundendokumente.
NICHT-Scope (Owner Spec 03): Composer-UI, Send-Endpoint, Zustellprotokoll —
s. Ownership-Matrix in D.

## A — IST im Alt-System (mit Evidenz)

Inventar-Funktionen (docs/MAESTRO-FEATURE-INVENTAR.md): E-Mail-Vorlagen,
Textbausteine & Signatur (email_templates, 6 STORIA-Formate) · Vorlagen mit
bedingter Logik · universeller Template-Renderer ({{Variablen}}) · persönliche
Absender-Signaturen · versionierte Angebots-Historie (unveränderlich) · Klonen
als Entwurf · Kundensprache & KI-Übersetzung (de/en/it/fr) · Angebots-PDF auf
der öffentlichen Angebotsseite · Anschreiben-Composer (Vorlagen/Bausteine/KI).

Nachweislich unfertig/fehlerhaft/tot:

1. **Schema-Drift bei email_templates** — zwei konkurrierende CREATE TABLE:
   `20260128201058_…` mit `content`/`content_en`, `20260203140000_…` erneut
   (ohne IF NOT EXISTS) mit `body`; Migrationen inserten mal `body`
   (`20260219_000002_…`), mal `content` (`20260221_000001_…`); die UI
   (`refine/Settings.tsx`) nutzt `content`. Neubau statt Portierung.
2. **Totes Feld `content_en`** — in DB und Typen (`…/InquiryEditor/types.ts`
   Z. 134–136), null Verwendung in `.tsx` — EN-Vorlagen nie gebaut.
3. **Signaturen hardcodiert** — `SENDER_INFO`-Map mit privaten Adressen/
   Handynummern (`generate-inquiry-email/index.ts` Z. 9–16); `buildSignatur()`
   fest verdrahtet (`emailTemplateRenderer.ts` Z. 49–67). Nicht mandanten-
   fähig; jede Personaländerung braucht ein Deployment.
4. **Bedingte Logik ist Code, nicht Template** — `tafelhinweis` (Schwellen
   12/24), `checkliste`, `eventdetails_satz` fest einprogrammiert
   (`emailTemplates.ts`, `emailTemplateRenderer.ts`); Schwellen/Texte nicht
   änderbar, EN existiert nicht.
5. **„Angebots-PDF" = LexOffice-Quotation-PDF** — `download-public-offer-pdf`
   mit Retry gegen 429/500 (MAX_RETRIES=3), Kommentar „Kein Auth erforderlich
   — nur per Inquiry-ID (UUID)". Nicht brandbar, LexOffice-Rate-Limit,
   Public-Endpoint ohne Token-Schutz.
6. **Zweite PDF-Welt clientseitig** — `@react-pdf/renderer`: `QuotePDF.tsx`
   (491 Z.), `LivePDFPreview.tsx`, Print-Sheets. Zwei Layout-Systeme laufen
   auseinander; clientseitig ≠ beweissicher archivierbar.
7. **Empfänger per Zeitmatching** — `useOfferHistory.ts` Z. 92: „matche per
   nächstgelegener Sendezeit (±5 Minuten)" gegen das Mail-Log; Beweiswert
   geratener Empfänger ist fragwürdig.
8. **Klonen mutiert den Live-Datensatz** — `useCloneOfferVersion.ts`
   Z. 87–107 schreibt Snapshots ungefragt in die Live-Inquiry zurück;
   Restore überschreibt ggf. neuere Daten kommentarlos.
9. **Übersetzungs-Cache fehleranfällig** — `translate-offer-letter` cached in
   `v2_events.email_content_translations` (public-callable, ohne Auth);
   `20260605232240_…backfill.sql` wipte alle Caches — Invalidierung kaputt.
   it/fr nie über die Storia-Praxis hinaus gebraucht.

## B — Der eigentliche Job (Jobs-to-be-done)

**Job 1 (Nordstern):** „Wenn eine Anfrage reinkommt, will ich in Sekunden ein
fertig formuliertes, korrekt personalisiertes Anschreiben — ohne zu tippen."
→ Vorlagen + Variablen + KI-Entwurf.
**Job 2 (Beweis):** „Wenn der Kunde annimmt oder streitet, will ich lückenlos
belegen, was er wann in welcher Version bekommen hat — Text, Zahlen, PDF,
Empfänger." → unveränderliches Versionsarchiv.
**Job 3 (Reichweite):** „Internationale Firmenkunden erwarten das Angebot auf
Englisch — ohne dass ich übersetze." → DE/EN auf Knopfdruck, KI-gestützt.

Gestrichen/zusammengelegt (mit Begründung):
- **LexOffice-PDF als Angebots-PDF → gestrichen.** MAESTRO rendert selbst
  (Web = Quelle, PDF = Ausdruck); LexOffice bleibt für Belege (Rechnungen).
  Löst Befund 5+6 (eine Layout-Welt). Spec 03 verweist fürs PDF hierher.
- **SENDER_INFO-Hardcode → gestrichen:** Signaturdaten werden Profilfelder
  (tenant-scoped), Firmensignatur eine Vorlage vom Typ `signature`.
- **it/fr → gestrichen:** Produktumfang DE+EN; Architektur bleibt sprachoffen.
- **Bedingte Logik als Code → ersetzt** durch deklarative Smart-Blocks (D);
  keine freie Template-Skriptsprache (Sicherheit, Supportbarkeit).
- **Empfänger-Zeitmatching → ersetzt:** Empfänger/Betreff/Versand-HTML liegen
  genau EINMAL in `offer_sends` (Spec 03); jede Archiv-Version referenziert
  ihren Versand per `send_id`. Kein Raten, keine zweite Kopie.
- **eSignatures.com-Templates → nicht hier** (eigenes Modul); hier nur das
  Archiv, in dem signierte PDFs landen. **Foto-Versionierung → Medien-Modul.**

## C — Benchmark 2026

Table stakes (Digest): Angebot als interaktiver Web-Link mit Branding — „PDF
ist out" (Tripleseat Live Documents, Perfect Venue, Proposales); E-Mail-
Vorlagen mit Auto-Eventdaten + KI-Antwortentwurf (Perfect Venue AI Reply);
automatische BEO/Function-Sheets aus dem Angebot — MAESTRO deckt das minimal
via Küchenzettel-PDF ab (s. D). CaterSmart: Landingpage-Angebote „in Sekunden"
+ eIDAS; Univents: KI-Angebote ab 46 €/Monat. Konsequenz: Das PDF ist 2026
(a) Archiv-/Beweisformat und (b) Format für Einkaufsabteilungen — beides
Pflicht inkl. referenzierbarer Angebotsnummer, dem Web-Angebot nachgelagert.

Wo wir sie schlagen:
1. **Beweissicheres Versionsarchiv mit Ein-Klick-Klon** — Snapshot inkl.
   verknüpftem Versand-Beleg (`send_id`) und PDF-Hash; kein Wettbewerber
   macht das Archiv zum Feature.
2. **KI-Vorlagen-Import beim Onboarding** — Word-/PDF-Bestand hochladen →
   Vorlagen + Textbausteine fertig (Time-to-Value < 15 Min).
3. **DE/EN des kompletten Kundendokuments** (Anschreiben + Seite + PDF) mit
   Sync-Erkennung — US-Tools einsprachig, DACH-Tools übersetzen nicht.

## D — Soll-Design (Neubau)

Aufbauen auf Neubau-Stand (`/home/user/maestro-cloud`): `offer_history` hat
`version`, `sent_at`, `sent_by`, `email_content`, `pdf_url`, `options_snapshot`
(packages/db/src/schema.ts Z. 334 ff.); `POST /api/events/:id/offers/send`
friert Optionen ein und vergibt `public_token` (offers.ts — Re-Sends behalten
denselben Token, Z. 203). Templates, Dokumente, PDF, Übersetzung fehlen —
dieses Modul liefert sie.

### Ownership-Matrix Spec 03 ↔ Spec 04 (genau EINE Quelle je Artefakt)
| Artefakt | Owner |
|---|---|
| Composer-UI, Testmail, `POST /api/events/:id/offers/send`, Zustellprotokoll `offer_sends` (Empfänger/Betreff/HTML/Status) | Spec 03 |
| Vorlagen + Renderer (`packages/templating`), Vorlagen-Studio, Dokument-Theme, Versionsarchiv (`offer_history`-Erweiterung), `documents`/PDF-Pipeline, DE/EN-Übersetzung | Spec 04 |

Der Versand-Beleg liegt ausschließlich in `offer_sends`; `offer_history`
referenziert ihn per `send_id` FK statt Empfänger/Betreff/HTML zu duplizieren
— zwei Wahrheiten wären Alt-Befund 1 auf Spec-Ebene. Spec 04 liefert dem
Spec-03-Composer nur Bausteine; die Composer-UI budgetiert allein Spec 03.

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)
1. Anfrage öffnen → Composer (UI: Spec 03) zeigt KI-Anschreiben-Entwurf,
   vorbelegt mit der Eventart-Vorlage (Badge „KI-Entwurf — prüfen").
2. Vorlagen-Dropdown (ersetzt Text), Textbaustein-Chips, Variablen-Chips mit
   Live-Werten; **unaufgelöste Variablen erscheinen inline als rote Chips**.
   Editor WYSIWYG (TipTap), gespeichert wird Markdown.
3. Live-Vorschau (mobil: Bottom-Sheet) mit echten Anfrage-/Optionsdaten,
   inkl. persönlicher Signatur des angemeldeten Absenders.
4. Sprachumschalter DE/EN: KI übersetzt Anschreiben + Dokumenttexte; ändert
   sich die Quelle danach, erscheint ein Sync-Banner „Neu übersetzen".
5. Senden (Endpoint: Spec 03) friert Version N ein: Sprache, Options-/
   Anfrage-/Zahlungsbedingungs-Snapshot, `send_id`; Erstversand vergibt die
   Angebotsnummer; PDF-Job asynchron. Unaufgelöste Pflicht-Variablen blocken
   den Versand mit klarer Fehlermeldung.
6. Kunde öffnet Web-Angebot (public_token) — gebrandet, mit Angebotsnummer +
   Gültigkeitsdatum — und lädt „Angebot als PDF", serverseitig aus dem
   Versions-Snapshot, in seiner Sprache.
7. Archiv-Tab: Versionsliste (Zeit/Absender/Summe), Read-only-Ansicht wie
   versendet, Diff-Hinweis, „Als Entwurf klonen" mit Bestätigungsdialog, der
   zu überschreibende Live-Felder zeigt (behebt Befund 8).
8. Vorlagen-Studio: Vorlagen/Textbausteine/Signaturen CRUD (WYSIWYG) mit
   Live-Preview; Theme-Editor mit Live-PDF-Preview; „Aus Bestand importieren"
   (KI, Onboarding-Wizard-Schritt).

### Datenmodell (Neon, alle Tabellen tenant_id + RLS FORCE wie 20_force_rls.sql)
```
templates
  id uuid PK · tenant_id FK → RLS
  kind enum('email','snippet','signature','doc_theme')
  name text · event_types text[] · subject text · body_md text  -- DE = Quelle
  translations jsonb '{}'   -- { "en": {subject, body_md, source_sha256,
                            --   translated_at} }
  theme jsonb NULL          -- nur kind='doc_theme' (s. u.)
  is_active bool · sort_order int · created_by text · timestamps
  -- Smart-Block-Konfig liegt NICHT hier (einzige Quelle: tenant_settings)

tenant_users (erweitern): display_name · mobile_phone · signature_block_md
  -- ersetzt SENDER_INFO; Firmensignatur = templates.kind='signature'
tenant_settings (erweitern):
  smart_blocks jsonb        -- einzige Quelle: Schwellen + Texte DE/EN je Block
  offer_number_format text DEFAULT 'A-{YYYY}-{NNNN}'  -- + Sequenz je Mandant
events (erweitern): offer_no text NULL   -- vergeben beim Erstversand

documents  -- unveränderliches Dateiarchiv (WORM)
  id uuid PK · tenant_id FK → RLS · event_id FK
  kind enum('offer_pdf','signed_pdf','beo','attachment')
  offer_version int NULL · language text
  storage_key text (R2) · sha256 text · size_bytes int · created_at
  UNIQUE(event_id, offer_version, language) WHERE kind='offer_pdf'
  -- RLS: SELECT/INSERT ja, UPDATE/DELETE nein (keine Policy + REVOKE);
  -- zusätzlich BEFORE UPDATE/DELETE-Trigger als zweite Sperre.

offer_history (erweitern)
  language text · send_id uuid FK offer_sends  -- Beleg (Spec 03): Empfänger/
                                               -- Betreff/HTML NUR dort (B7)
  document_id uuid NULL FK documents
  pdf_status enum('pending','ready','failed') DEFAULT 'pending'
  inquiry_snapshot jsonb · payment_terms_snapshot jsonb
  UNIQUE(tenant_id, event_id, version)  -- parallele Sends: Konflikt = Retry
  -- pdf_url wird in derselben Migration GEDROPPT (im Neubau unbenutzt);
  -- document_id + pdf_status = einzige PDF-Referenz (Grep-Check als Abnahme)
  -- UPDATE nur auf document_id/pdf_status via SECURITY-DEFINER-Funktion,
  -- alle anderen Spalten unveränderlich (Trigger).
```
Geldbeträge in Snapshots ausschließlich Integer-Cents (`amount_total_cents`),
identisch zur Pricing-Engine aus Spec 02.

**Angebotsnummer:** fortlaufende Sequenz pro Mandant, Format konfigurierbar
(`A-2026-0042`), vergeben beim Erstversand; Versionen als Suffix
(`A-2026-0042-v2`). Nummer + `offer_valid_until` (Spec 03) stehen auf
Web-Angebot und PDF — Einkauf/GoBD brauchen eine referenzierbare Nummer.

**Dokument-Theme (`kind='doc_theme'`):** `theme jsonb` mit `logo_storage_key`
(R2), `primary_color`, `footer_md` (Pflichtfelder: Firmenname, Anschrift,
USt-IdNr./Steuernummer — Impressumspflicht auf Geschäftsdokumenten). Genau EIN
aktives Theme pro Mandant (Partial-Unique); Default-Theme im Onboarding aus
den NAP-Daten; Editor im Studio mit Live-PDF-Preview. Web-Angebot und PDF
ziehen Branding ausschließlich von hier.

**Template-Sprache (bewusst begrenzt):** `{{variable}}` aus Whitelist
(kundenname, firma, eventdatum, gaeste, eventart, raum, zeitfenster, optionen,
gesamtpreis, preis_pro_person, signatur, …), HTML-escaped. Die Whitelist
klassifiziert jede Variable als **pflicht** (kundenname, eventdatum,
gesamtpreis) oder **optional**: Optionale ohne Wert werden inkl. umgebender
Leerzeichen/Satzfragmente entfernt (Smart-Trim), fehlende Pflicht-Variablen
blocken den Versand (UX 5). Bedingte Logik: (a) `{{#if feld}}…{{/if}}` nur
als Existenz-Check, (b) **Smart-Blocks** `{{block:tafelhinweis|checkliste|
eventdetails}}` — Templates referenzieren nur per Name; Schwellen/Texte
(DE+EN) leben ausschließlich in `tenant_settings.smart_blocks` (AK 3). Keine
Schleifen, Ausdrücke oder freie Skriptsprache. Renderer als pures Paket
`packages/templating` (Worker + Web) mit zwei Render-Targets: `email_html`
(tabellenbasiert, inline styles, MJML-artig — Outlook rendert mit Word-Engine,
Print-CSS hilft dort nicht) und `print` (Angebotsseite/PDF).

### API (Hono-Worker, alle Endpunkte tenant-scoped via withTenant)
- `GET/POST/PATCH/DELETE /api/templates` · `POST /api/templates/:id/preview`
- `POST /api/templates/import` (Dateien → KI → Drafts, status=inactive)
- `POST /api/events/:id/composer/render` (template_id + Kontext → Text +
  Report unaufgelöster Variablen mit pflicht/optional-Flag)
- `POST /api/events/:id/composer/translate` (target='en' → Übersetzung + Hash)
- `POST /api/events/:id/offers/send` — **Owner: Spec 03.** Dieses Modul steuert
  bei: Pflicht-Variablen-Gate (422), Snapshot-Erweiterung (send_id, language,
  inquiry/payment), Angebotsnummern-Vergabe, PDF-Enqueue.
- `GET /api/events/:id/offers/history` · `POST …/history/:version/clone`
  (liefert Konflikt-Preview; Bestätigung nötig)
- `GET /api/documents/:id/url` (kurzlebige signierte R2-URL, 5 Min)
- Public: `GET /api/public/offers/:token/pdf?lang=de|en` (Token statt roher
  UUID — behebt Befund 5; Rate-Limit pro Token)
- Intern (nur PDF-Renderer): Print-Route `?token=…&version=N&lang=…` — liest
  NUR `offer_history`-Snapshots + `send_id`-Beleg, nie Live-Daten.

### PDF-Erzeugung im Cloudflare-Kontext (ehrlich)
Kein Puppeteer-Prozess im Worker. Entscheidung:
- **Gewählt: Cloudflare Browser Rendering, REST `/pdf`.** Gerendert wird die
  interne Print-Route `?token&version=N&print=1` aus dem **eingefrorenen
  Snapshot** — nie die Live-Seite: Re-Sends teilen den public_token (offers.ts
  Z. 203), die Live-Seite zeigt immer die aktuelle Version; ein asynchroner
  Job für Version N würde sonst den Inhalt von N+1 archivieren. Konditionen
  2026: Workers Paid inkl. 10 Browser-Std./Monat, dann $0,09/h; ein PDF
  ~5–10 s → hunderte PDFs/Monat im Inklusivvolumen.
- **Asynchron + idempotent:** Versand wartet NIE aufs PDF (Nordstern!). Queue
  ist at-least-once: Consumer prüft zuerst `pdf_status='ready'` (No-Op) und
  schreibt `documents` per ON CONFLICT DO NOTHING gegen den Unique-Constraint
  — keine Doppel-Zeilen im WORM-Archiv. **Kunden-Download vor Fertigstellung
  = First-Writer:** der on-demand-Render (Spinner ~5 s) persistiert sofort
  als `documents`-Zeile; der spätere Queue-Job wird No-Op. Je Version+Sprache
  existiert genau EIN PDF; das ausgelieferte ist byte-identisch mit dem
  archivierten (AK 7).
- **PDF-Inhalt:** Dokument-Theme (Logo/Farben/Impressums-Fußzeile), Angebots-
  nummer inkl. Versions-Suffix, `offer_valid_until`, Optionen/Preise (Cents).
- **Fallback-Port:** `PdfRenderer`-Adapter (Registry B10); Zweitprovider
  (Gotenberg/DocRaptor) falls Limits/Latenz drücken; nur der Adapter kennt
  den Provider. **Verworfen:** `@react-pdf/renderer` clientseitig (nicht
  beweissicher, zweite Layout-Welt — Alt-Fehler 6); `pdf-lib` (Low-Level).
- **Minimal-BEO (Table Stakes, s. C):** `documents.kind='beo'` + Print-
  Template „Küchenzettel" (Optionen, Gästezahl, Zeitfenster, Allergene) über
  dieselbe Pipeline — Aufwand S auf Basis Bau-Plan #6; das volle Ops-Modul
  (Function-Sheets, Schichten) folgt als eigene Spec nach Modul 06.

### Automatisierungen
- **Queue `pdf-render`:** idempotenter Consumer (s. o.) → R2 → documents;
  3 Retries, dann `pdf_status='failed'` + Hinweis (Versand bleibt gültig).
- **Nightly Cron:** Konsistenz (jede Version hat ready/failed-PDF),
  R2-Orphan-Cleanup, Alert bei failed > 0.
- **Übersetzungs-Sync:** `source_sha256` der Quelle wird beim Übersetzen in
  `translations` gespeichert; weicht die aktuelle Quelle ab → Banner im
  Composer und auf der EN-Angebotsseite (intern).

### KI-Punkte (Input → Vorschlag → Bestätigung)
1. Anschreiben-Entwurf: Anfrage + Optionen + Vorlage → Entwurf im Composer;
   nie Auto-Versand.
2. DE→EN-Übersetzung: Anschreiben + Positions- + Smart-Block-Texte — Zahlen,
   Beträge, Daten und {{Variablen}} werden maskiert und unverändert
   re-injiziert (Risiko 4) → Diff-Ansicht mit farblich hervorgehobenen
   Zahlen → Bestätigen speichert.
3. Vorlagen-Import (Onboarding): Word/PDF/Mail-Bestand → Vorlagen/Bausteine/
   Signatur als inaktive Drafts → Nutzer aktiviert einzeln.
4. Textbaustein-Tonalität: Du/Sie, formell/locker pro Mandant umformulieren.

### Integrations-Berührungen
R2 (Archiv) · Browser Rendering (PDF) · Cloudflare Queues · LexOffice: nur
Belege (Rechnung/Storno) — Angebots-PDF kommt von MAESTRO · Spec 03 (Versand)
konsumiert Renderer + liefert `offer_sends`-Beleg · E-Signatur-Modul schreibt
`documents.kind='signed_pdf'` · Stripe: Zahlungslink im Web-Angebot/PDF
(Modul Zahlungen).

## E — Klassifikation

**Kern:** Vorlagen + Renderer, Signaturen, Versionsarchiv, PDF-Export inkl.
Angebotsnummer + Theme — ohne sie kein Abschluss-Flow; nicht abschaltbar.
**Modul (Registry B10, abschaltbar):** EN-Übersetzung, KI-Vorlagen-Import,
Smart-Block „Tafelhinweis" (Default an), Minimal-BEO „Küchenzettel"
(Default an).
**Storia-only (Fork/Seed):** it/fr, die 6 STORIA-Vorlagentexte (Seed-Daten
des Storia-Mandanten), eSignatures.com-Altbestand. Kriterium wie Spec 02:
brauchen < 30 % der Zielmandanten es am Tag 1 → Registry/Fork.

## F — Bau-Plan

| # | Schritt | Abhängig von | Aufwand | Neu |
|---|---------|--------------|---------|-----|
| 1 | Migration: `templates` (inkl. theme), `documents` (WORM-Trigger, Unique offer_pdf), `offer_history`-Erweiterung (send_id, Unique(tenant_id,event_id,version), **DROP pdf_url** — Grep-Check als Abnahme), `events.offer_no`, `tenant_users`-/`tenant_settings`-Felder; RLS FORCE + Isolationstests | Spec 03 #1 (offer_sends) | S | Tabellen |
| 2 | `packages/templating`: Renderer (Whitelist pflicht/optional, Smart-Trim, #if, Smart-Blocks aus tenant_settings, Escaping), Render-Targets email_html (Outlook-tauglich) + print, Übersetzungs-Maskierung; Golden-Tests DE/EN | — | M | Paket |
| 3 | API: Templates CRUD + Preview; composer/render (inkl. Unresolved-Report), translate | 1,2 | S | Endpunkte |
| 4 | Vorlagen-Studio UI (WYSIWYG/TipTap, CRUD, Live-Preview, Signaturen, Theme-Editor mit Live-PDF-Preview) | 3 | M | UI |
| 5 | Composer-Integration (UI-Owner: Spec 03 #4 — hier nicht doppelt budgetiert): Vorlagen-Dropdown, Baustein-/Variablen-Chips inkl. Rot-Markierung, Preview-Anbindung | 3, Spec 03 #4 | S | Komponenten |
| 6 | PDF-Pipeline: interne Print-Route aus Snapshot, Browser-Rendering-Adapter, idempotente Queue, R2, `documents`, Theme + Angebotsnummer im Layout | 1 | L | Adapter+Queue |
| 7 | Send-Hook im Spec-03-Endpoint: Pflicht-Variablen-Gate, Snapshot-Erweiterung (send_id/language/inquiry/payment), Nummern-Vergabe, PDF-Job, public `/pdf` | 3,6, Spec 03 #3 | S | Endpunkt |
| 8 | Archiv-UI: Versionsliste, Read-only-Ansicht, Diff-Hinweis, Klonen mit Konflikt-Preview | 7 | M | UI |
| 9 | Übersetzung DE/EN: translate-Endpoint mit Maskierung, Quell-Hash, Sync-Banner, EN-PDF | 2,6 | M | Endpunkt+UI |
| 10 | KI-Vorlagen-Import (Onboarding-Wizard-Schritt) | 3,4 | L | Endpunkt+UI |
| 11 | Minimal-BEO „Küchenzettel": Print-Template + `documents.kind='beo'` über Pipeline #6 | 6 | S | Template |
| 12 | Storia-Migration: `email_templates` (body/content-Drift bereinigen) → `templates`; `inquiry_offer_history` → `offer_history` + Empfänger-Backfill als `offer_sends`-Belege (letztmalig Zeitmatching, danach nie wieder) | 1, Spec 03 #1 | M | ETL |

Kritischer Pfad 1→2→3→5→7 (7 gemeinsam mit Spec 03 #3); Rest parallelisierbar.

## G — Risiken & Lösungen (Top 4)

1. **PDF-Pipeline-Abhängigkeit von Browser Rendering** (Limits, Latenz,
   Preise). → PDF nie blockierend (Web-Angebot ist der primäre Kanal), Queue
   mit Retry + `pdf_status`, `PdfRenderer`-Port mit Zweitprovider hinter der
   Registry; Kosten-Monitoring als Dashboard-Metrik.
2. **Template-Injection / PII-Leak** durch nutzererstellte Vorlagen in
   Kunden-Mails und öffentlichen PDFs. → keine freie Skriptsprache,
   Whitelist-Variablen, HTML-Escaping im Renderer-Paket, Preview = derselbe
   Renderer wie Versand; Fuzz-Tests auf `{{`-Payloads.
3. **Immutability vs. DSGVO-Löschbegehren** (Art. 17 vs. Beweis-/GoBD-Archiv).
   → Aufbewahrung auf Art. 17(3) b/e + AO/GoBD stützen, in AVV dokumentieren;
   Lösch-Workflow anonymisiert Live-Daten, Archiv-Dokumente erhalten Legal-
   Hold-Flag mit Ablaufdatum; danach Hard-Delete aus R2 + Zeilenlöschung per
   SECURITY-DEFINER-Job (einziger erlaubter Löschpfad).
4. **KI-Übersetzung verfälscht rechtlich bindende Werte** — das Angebot ist
   Vertragsgrundlage; eine Halluzination („50 guests" statt 15, falsches
   Datum) erzeugt ein bindendes Falschangebot. → Zahlen, Beträge (Cents),
   Daten und {{Variablen}} werden vor der Übersetzung maskiert und danach
   unverändert re-injiziert — die KI übersetzt ausschließlich Prosa.
   Golden-Test in `packages/templating`: „Kein numerischer Wert ändert sich
   durch Übersetzung"; die Diff-Ansicht hebt Zahlen farblich hervor.

## H — Akzeptanzkriterien

1. Ein neuer Mandant lädt im Onboarding zwei alte Word-/PDF-Angebote hoch und
   hat in < 15 Min aktivierbare Vorlagen + Signatur im Studio (KI-Import).
2. Der Composer markiert unaufgelöste Variablen inline (rote Chips); Versand
   mit unaufgelösten **Pflicht**-Variablen (kundenname, eventdatum,
   gesamtpreis) wird mit klarer Fehlermeldung geblockt; **optionale** ohne
   Wert werden inkl. umgebender Leerzeichen/Satzfragmente entfernt (Smart-
   Trim, Golden-Test); Preview == Versand (identischer Renderer).
3. Smart-Blocks sind pro Mandant in Text und Schwellen konfigurierbar
   (`tenant_settings.smart_blocks`) — ohne Deployment, in DE und EN.
4. Ausgehende Mails tragen automatisch die persönliche Signatur des
   angemeldeten Teammitglieds aus dessen Profil; kein Personendatum im Code.
5. Jeder Versand erzeugt genau eine Version mit Sprache, Snapshots (Cents),
   `send_id`-Referenz (Empfänger/Betreff/HTML nur in `offer_sends`) und
   PDF-Referenz; parallele Sends kollidieren am Unique-Constraint (Test);
   UPDATE/DELETE auf Versionen und `documents` schlagen auf DB-Ebene fehl
   (Trigger-Test); eine doppelt zugestellte Queue-Message erzeugt keine
   zweite `documents`-Zeile (Idempotenz-Test).
6. „Als Entwurf klonen" zeigt vor dem Restore die zu überschreibenden
   Live-Felder und fasst die Archiv-Version nachweislich nicht an.
7. Das Kunden-PDF (public_token, DE/EN) entsteht serverseitig aus dem
   eingefrorenen Versions-Snapshot (nie aus Live-Daten); das ausgelieferte
   PDF ist byte-identisch mit dem in R2 archivierten Dokument (SHA-256-
   Vergleich im Test); je Version+Sprache existiert genau ein Dokument;
   roher UUID-Zugriff funktioniert nicht.
8. Der Versand dauert mit ausstehendem PDF nicht länger als ohne (asynchron);
   ein fehlgeschlagener PDF-Job invalidiert den Versand nicht, sondern
   erscheint als behebbarer Hinweis am Vorgang.
9. Nach Änderung des DE-Anschreibens zeigt die EN-Fassung einen Sync-Hinweis;
   „Neu übersetzen" (KI, mit Bestätigung) hebt ihn auf.
10. Der Erstversand vergibt eine fortlaufende mandantenspezifische Angebots-
    nummer (Format konfigurierbar, z. B. A-2026-0042); Web-Angebot und PDF
    weisen Nummer (Versionen mit Suffix -v2) und Gültigkeitsdatum aus.
11. PDF und Web-Angebot tragen Logo, Farben und Impressums-Fußzeile des
    Mandanten (Dokument-Theme) ohne Deployment; Firmenname, Anschrift und
    USt-IdNr. sind im Theme-Editor Pflichtfelder.
12. `email_html` besteht die E-Mail-Client-Matrix (Outlook/Word-Engine,
    Gmail, Apple Mail — Litmus o. ä.) ohne Layout-Brüche.
13. RLS-Isolationstest: Mandant A kann Templates, Dokumente und Versionen von
    Mandant B weder lesen noch schreiben (automatisiert, hartes Gate).
