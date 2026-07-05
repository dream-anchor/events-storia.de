# Dokumente, Vorlagen & Versionen

Modul-Spec MAESTRO · Stand 2026-07-05 · Status: entscheidungsreif
Scope: Angebots-PDF, E-Mail-/Text-Vorlagen mit {{Variablen}} und bedingter Logik,
Textbausteine, Signaturen je Teammitglied, unveränderliches Versionsarchiv,
Klonen alter Versionen, DE/EN-Übersetzung der Kundendokumente.

## A — IST im Alt-System (mit Evidenz)

Zugehörige Inventar-Funktionen (docs/MAESTRO-FEATURE-INVENTAR.md): E-Mail-Vorlagen,
Textbausteine & Signatur (email_templates, 6 STORIA-Formate) · Vorlagen mit bedingter
Logik (Tafelhinweis, Checkliste) · Universeller Template-Renderer ({{Variablen}}) ·
Persönliche Absender-Signaturen je Teammitglied · Versionierte Angebots-Historie
(unveränderlich) · Alte Version als Entwurf klonen · Kundensprache & KI-Übersetzung
(de/en/it/fr) · Angebots-PDF auf der öffentlichen Angebotsseite · Anschreiben-Composer
mit Vorlagen, Bausteinen und KI.

Nachweislich unfertig/fehlerhaft/tot:

1. **Schema-Drift bei email_templates** — zwei konkurrierende CREATE TABLE in der
   Migrationskette: `20260128201058_…` legt die Tabelle mit `content`/`content_en` an,
   `20260203140000_email_templates.sql` legt dieselbe Tabelle erneut an (ohne
   IF NOT EXISTS) mit `body`. Spätere Migrationen inserten mal in `body`
   (`20260219_000002_…`), mal in `content` (`20260221_000001_email_signature.sql`);
   die UI (`src/components/admin/refine/Settings.tsx`) nutzt `content`. Kein sauberer
   Migrationspfad — Neubau statt Portierung.
2. **Totes Feld `content_en`** — bilinguale Vorlagen-Spalte existiert in DB und Typen
   (`src/components/admin/refine/InquiryEditor/types.ts` Z. 134–136, kommentiert als
   „Legacy compatibility"), aber null Verwendung in irgendeiner `.tsx` — EN-Vorlagen
   wurden nie gebaut.
3. **Signaturen hardcodiert statt Daten** — `SENDER_INFO`-Map mit privaten E-Mail-
   Adressen und Handynummern direkt im Code
   (`supabase/functions/generate-inquiry-email/index.ts` Z. 9–16); zusätzlich
   `buildSignatur()` mit fest verdrahteten Namen/Nummern/Adresse in
   `src/lib/emailTemplateRenderer.ts` Z. 49–67. Nicht mandantenfähig; jede
   Personaländerung braucht ein Deployment.
4. **Bedingte Logik ist Code, nicht Template** — `tafelhinweis` (Gästezahl-Schwellen
   12/24), `checkliste`, `eventdetails_satz` sind fest einprogrammierte deutsche
   Textblöcke (`src/lib/emailTemplates.ts`, `emailTemplateRenderer.ts`). Ein Mandant
   kann weder Schwellen noch Texte ändern; EN existiert nicht.
5. **Das „Angebots-PDF" ist gar kein eigenes Dokument** — es ist das LexOffice-
   Quotation-PDF: `supabase/functions/download-public-offer-pdf/index.ts` lädt es mit
   Retry-Logik gegen 429/500 (MAX_RETRIES=3) und ist laut eigenem Kommentar „Kein Auth
   erforderlich — nur per Inquiry-ID (UUID) aufrufbar". Layout nicht brandbar,
   Verfügbarkeit hängt am LexOffice-Rate-Limit, Public-Endpoint ohne Token-Schutz.
6. **Zweite, parallele PDF-Welt clientseitig** — `@react-pdf/renderer` (package.json)
   rendert `QuotePDF.tsx` (491 Z., eigene Font-Registrierung, eigenes Farbschema),
   `MultiOffer/LivePDFPreview.tsx` und die Print-Sheets. Zwei Layout-Systeme
   (LexOffice + react-pdf), die zwangsläufig auseinanderlaufen; clientseitiges PDF ist
   nicht beweissicher archivierbar.
7. **Empfänger per Zeitmatching rekonstruiert** — das Versionsarchiv speichert die
   Empfänger nicht; `src/hooks/useOfferHistory.ts` Z. 92: „matche per nächstgelegener
   Sendezeit (Toleranz: ±5 Minuten)" gegen das Mail-Log. Beweiswert eines Archivs,
   dessen Empfänger geraten werden, ist fragwürdig.
8. **Klonen mutiert den Live-Datensatz** — `src/hooks/useCloneOfferVersion.ts`
   Z. 87–107 schreibt Snapshot-Adressen/Zahlungsbedingungen ungefragt in die Live-
   Inquiry zurück (Spread dreier Snapshots in ein UPDATE). Historie bleibt korrekt
   unangetastet, aber der Restore überschreibt ggf. neuere Live-Daten kommentarlos.
9. **Übersetzungs-Cache fehleranfällig** — `translate-offer-letter` cached in
   `v2_events.email_content_translations` (public-callable, ohne Auth); die Migration
   `20260605232240_sync_public_offer_anschreiben_backfill.sql` musste alle Caches
   wipen — Invalidierung war kaputt. it/fr sind angelegt, wurden aber nie über die
   Storia-Praxis hinaus gebraucht.

## B — Der eigentliche Job (Jobs-to-be-done)

**Job 1 (Nordstern):** „Wenn eine Anfrage reinkommt, will ich in Sekunden ein fertig
formuliertes, korrekt personalisiertes Anschreiben — ohne zu tippen und ohne zweimal
dasselbe zu schreiben." → Vorlagen + Variablen + KI-Entwurf.
**Job 2 (Beweis):** „Wenn der Kunde annimmt oder streitet, will ich lückenlos belegen,
was er wann in welcher Version bekommen hat — Text, Zahlen, PDF, Empfänger." →
unveränderliches Versionsarchiv.
**Job 3 (Reichweite):** „Internationale Firmenkunden erwarten das Angebot auf
Englisch — ohne dass ich übersetze." → DE/EN auf Knopfdruck, KI-gestützt.

Gestrichen/zusammengelegt (mit Begründung):

- **LexOffice-PDF als Angebots-PDF → gestrichen.** Das Angebot wird von MAESTRO selbst
  gerendert (Web = Quelle, PDF = Ausdruck davon). LexOffice bleibt zuständig für
  Belege (Rechnungen) in der Buchhaltungs-Integration. Löst Befund 5+6 (eine
  Layout-Welt statt zwei).
- **SENDER_INFO-Hardcode → gestrichen.** Signaturdaten werden Profilfelder des
  Teammitglieds (tenant-scoped), Firmensignatur eine Vorlage vom Typ `signatur`.
- **it/fr-Übersetzung → gestrichen.** Produktumfang ist DE+EN; it/fr war Storia-
  Spezialbedarf mit minimaler Nutzung. Architektur bleibt sprachoffen (locale-Key).
- **Bedingte Logik als Code → ersetzt** durch deklarative Smart-Blocks (siehe D);
  keine freie Template-Skriptsprache (Sicherheit, Supportbarkeit).
- **Empfänger-Zeitmatching → ersetzt:** Empfänger, Betreff und Versand-HTML werden
  Teil des Snapshots. Kein Raten mehr.
- **eSignatures.com-Template-Verwaltung → nicht hier:** E-Signatur ist eigenes Modul
  (Abschluss-Flow); dieses Modul liefert nur das unveränderliche Dokumentarchiv, in
  dem signierte PDFs landen.
- **Foto-Versionierung → nicht hier** (Medien-Modul; anderes Problem).

## C — Benchmark 2026

Table stakes (Digest): Angebot als interaktiver Web-Link mit Branding — „PDF ist out"
(Tripleseat Live Documents, Perfect Venue, Proposales); E-Mail-Vorlagen, die
Eventdaten automatisch einsetzen + KI-Antwortentwurf in allen Tiers (Perfect Venue
AI Reply); automatische BEO/Function-Sheets aus dem Angebot. CaterSmart liefert
Landingpage-Angebote „in Sekunden" mit eIDAS-E-Signatur und KI-Texten; Univents
unbegrenzte KI-Angebote ab 46 €/Monat. Konsequenz: Das PDF ist 2026 nicht mehr das
Angebot, sondern (a) Archiv-/Beweisformat und (b) Format für Einkaufsabteilungen,
die „ein PDF für den Vorgang" verlangen — beides bleibt Pflicht, ist aber dem
Web-Angebot nachgelagert.

Wo wir sie schlagen:
1. **Beweissicheres Versionsarchiv mit Ein-Klick-Klon** — Snapshot inkl. Empfänger,
   HTML, PDF-Hash; kein Wettbewerber macht das Archiv zum Feature.
2. **KI-Vorlagen-Import beim Onboarding** — bestehende Word-/PDF-Angebote und Mails
   hochladen → Vorlagen + Textbausteine fertig (Time-to-Value < 15 Min; Digest-
   Empfehlung „KI-Import").
3. **DE/EN des kompletten Kundendokuments** (Anschreiben + Angebotsseite + PDF) mit
   Sync-Erkennung — US-Tools sind einsprachig, DACH-Tools übersetzen nicht.

## D — Soll-Design (Neubau)

Aufbauen auf Neubau-Stand (`/home/user/maestro-cloud`): `offer_history` existiert
bereits mit `version`, `sent_at`, `sent_by`, `email_content`, `pdf_url`,
`options_snapshot` (packages/db/src/schema.ts Z. 334 ff.); `POST
/api/events/:id/offers/send` friert Optionen ein und vergibt `public_token`
(apps/api/src/routes/offers.ts). Templates, Dokumente, PDF und Übersetzung fehlen
komplett — dieses Modul liefert sie.

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)
1. Betreiber öffnet Anfrage → Composer zeigt KI-Anschreiben-Entwurf, vorbelegt mit
   der zur Eventart passenden Vorlage (Badge „KI-Entwurf — prüfen").
2. Vorlagen-Dropdown (ersetzt Text), Textbaustein-Chips (hängen an), klickbare
   Variablen-Chips ({{kundenname}}, {{eventdatum}}, …) mit Live-Werten im Tooltip.
3. Live-Vorschau als zweite Spalte (mobil: Bottom-Sheet) — gerendert mit echten
   Anfrage-/Optionsdaten, inkl. persönlicher Signatur des angemeldeten Absenders.
4. Sprachumschalter DE/EN im Header: KI übersetzt Anschreiben + Dokumenttexte;
   ändert sich die Quelle danach, erscheint ein Sync-Banner mit „Neu übersetzen".
5. Senden → Version N wird eingefroren: Betreff, Text, Versand-HTML, Empfänger
   (to/cc/bcc), Sprache, Options-Snapshot; PDF-Job startet asynchron.
6. Kunde öffnet Web-Angebot (public_token) und lädt bei Bedarf „Angebot als PDF" —
   serverseitig gerendert, gebrandet, in seiner Sprache.
7. Archiv-Tab am Vorgang: Versionsliste mit Zeit/Absender/Summe, Read-only-Ansicht
   identisch zum Versand, Diff-Hinweis zur Vorversion, Aktion „Als Entwurf klonen"
   (mit Bestätigungsdialog, der zeigt, welche Live-Felder überschrieben würden —
   behebt Befund 8).
8. Einstellungen → Vorlagen-Studio: Vorlagen/Textbausteine/Signaturen CRUD mit
   Live-Preview auf Beispieldaten; Button „Aus Bestand importieren" (KI, Schritt im
   Onboarding-Wizard).

### Datenmodell (Neon, alle Tabellen tenant_id + RLS FORCE wie 20_force_rls.sql)
```
templates
  id uuid PK · tenant_id uuid FK → RLS
  kind enum('email','snippet','signature','doc_theme')
  name text · event_types text[] (Auto-Vorschlag im Composer)
  subject text · body_md text            -- DE = Quelle
  translations jsonb DEFAULT '{}'        -- { "en": {subject, body_md}, … }
  smart_blocks jsonb DEFAULT '{}'        -- Konfiguration der Blöcke (s.u.)
  is_active bool · sort_order int · created_by text · timestamps

tenant_users (erweitern)
  display_name text · mobile_phone text · signature_block_md text
  -- ersetzt SENDER_INFO; Firmensignatur = templates.kind='signature'

documents  -- unveränderliches Dateiarchiv (WORM)
  id uuid PK · tenant_id uuid FK → RLS
  event_id uuid FK · kind enum('offer_pdf','signed_pdf','beo','attachment')
  offer_version int NULL · language text
  storage_key text (R2) · sha256 text · size_bytes int · created_at
  -- RLS: SELECT/INSERT ja, UPDATE/DELETE nein (keine Policy + REVOKE);
  -- zusätzlich BEFORE UPDATE/DELETE-Trigger als zweite Sperre.

offer_history (erweitern)
  subject text · email_html text · language text
  recipients jsonb                        -- {to:[],cc:[],bcc:[]}  (Befund 7)
  document_id uuid NULL FK documents      -- das Versand-PDF
  pdf_status enum('pending','ready','failed') DEFAULT 'pending'
  inquiry_snapshot jsonb · payment_terms_snapshot jsonb
  -- UPDATE nur auf document_id/pdf_status via SECURITY-DEFINER-Funktion,
  -- alle anderen Spalten unveränderlich (Trigger).
```
Geldbeträge in Snapshots ausschließlich als Integer-Cents (`amount_total_cents`),
identisch zur Pricing-Engine aus Spec 02.

**Template-Sprache (bewusst begrenzt):** `{{variable}}` aus Whitelist (kundenname,
firma, eventdatum, gaeste, eventart, raum, zeitfenster, optionen, gesamtpreis,
preis_pro_person, signatur, …), HTML-escaped. Bedingte Logik über zwei Mechanismen:
(a) `{{#if feld}}…{{/if}}` nur als Existenz-Check auf Whitelist-Felder,
(b) **Smart-Blocks**: `{{block:tafelhinweis}}`, `{{block:checkliste}}`,
`{{block:eventdetails}}` — vordefinierte Blöcke, deren Schwellen und Texte der
Mandant im Studio konfiguriert (JSON in `templates.smart_blocks` bzw. Tenant-
Settings), DE+EN. Keine Schleifen, keine Ausdrücke, keine freie Skriptsprache —
das macht Befund 4 konfigurierbar, ohne ein Injection-/Support-Monster zu bauen.
Renderer als pures Paket `packages/templating` (Worker + Web nutzen denselben Code).

### API (Hono-Worker, alle Endpunkte tenant-scoped via withTenant)
- `GET/POST/PATCH/DELETE /api/templates` · `POST /api/templates/:id/preview`
  (event_id optional → gerenderter subject/body)
- `POST /api/templates/import` (Dateien → KI → Vorlagen-Drafts, status=inactive)
- `POST /api/events/:id/composer/render` (template_id + Kontext → Text)
- `POST /api/events/:id/composer/translate` (target='en' → Übersetzung + Quell-Hash)
- `POST /api/events/:id/offers/send` (erweitert: subject, body, recipients,
  language; schreibt Snapshot, enqueued PDF-Job)
- `GET /api/events/:id/offers/history` · `POST …/history/:version/clone`
  (liefert Konflikt-Preview; Bestätigung nötig)
- `GET /api/documents/:id/url` (kurzlebige signierte R2-URL, 5 Min)
- Public: `GET /api/public/offers/:token/pdf?lang=de|en` (public_token statt
  roher UUID — behebt Befund 5; Rate-Limit pro Token)

### PDF-Erzeugung im Cloudflare-Kontext (ehrlich)
Kein Puppeteer-Prozess im Worker. Entscheidung:
- **Gewählt: Cloudflare Browser Rendering, REST-Endpoint `/pdf`.** Der Worker rendert
  die öffentliche Angebotsseite (`?print=1`, Print-CSS, gleiche React-App) zu PDF —
  ein einziges Layout für Web und PDF. Konditionen 2026: Workers Paid inkludiert
  10 Browser-Stunden/Monat, danach $0,09/Browser-Stunde; Free-Tier 10 Min/Tag;
  Request-Body max. 50 MB. Ein Angebots-PDF kostet ~5–10 s Browser-Zeit → hunderte
  PDFs/Monat liegen im Inklusivvolumen.
- **Ausführung asynchron:** Versand wartet NIE aufs PDF (Nordstern!). Snapshot sofort,
  PDF-Job in Cloudflare Queue, Ergebnis → R2 → `documents` + `pdf_status='ready'`.
  Kunden-Download vor Fertigstellung: on-demand-Render mit Spinner (~5 s), danach
  aus R2-Cache.
- **Fallback-Port:** `PdfRenderer`-Interface im Adapter-Muster (Modul-Registry B10);
  Zweitimplementierung externe HTML-to-PDF-API (z. B. Gotenberg self-hosted oder
  DocRaptor) falls Limits/Latenz drücken. Kein Code außerhalb des Adapters kennt
  den Provider.
- **Verworfen:** `@react-pdf/renderer` clientseitig (kein beweissicheres Server-
  Artefakt, zweite Layout-Welt — exakt Alt-Fehler 6); `pdf-lib` im Worker (nur
  Low-Level-Zeichnen, mehrseitige gebrandete Layouts unwirtschaftlich).
- Interne Drucksachen (BEO/Küchenzettel, Ops-Modul) nutzen später dieselbe Pipeline.

### Automatisierungen
- **Queue `pdf-render`:** Render → R2 → documents; 3 Retries, dann
  `pdf_status='failed'` + Hinweis im Vorgang (Versand bleibt gültig, Web-Link zählt).
- **Nightly Cron:** Konsistenz (jede gesendete Version hat ready/failed-PDF),
  Orphan-Cleanup in R2, Alert bei failed > 0.
- **Übersetzungs-Sync:** SHA über Quelltext beim Übersetzen gespeichert; weicht die
  aktuelle Quelle ab → Banner im Composer und auf der EN-Angebotsseite (intern).

### KI-Punkte (Input → Vorschlag → Bestätigung)
1. Anschreiben-Entwurf: Anfrage + Optionen + gewählte Vorlage → Entwurf im Composer;
   nie Auto-Versand.
2. DE→EN-Übersetzung: Anschreiben + Positionstexte + Smart-Block-Texte → Diff-artige
   Gegenüberstellung → Bestätigen speichert.
3. Vorlagen-Import (Onboarding): Word/PDF/Mail-Bestand → erkannte Vorlagen,
   Textbausteine, Signatur als inaktive Drafts → Nutzer aktiviert einzeln.
4. Textbaustein-Tonalität: Du/Sie, formell/locker pro Mandant umformulieren lassen.

### Integrations-Berührungen
R2 (Dokumentarchiv) · Browser Rendering (PDF) · Cloudflare Queues · LexOffice: nur
noch Belege (Rechnung/Storno) — Angebots-PDF kommt von MAESTRO · E-Mail-Versand
(Modul Kommunikation) konsumiert gerenderte Vorlagen · E-Signatur-Modul schreibt
`documents.kind='signed_pdf'` · Stripe: Zahlungslink erscheint im Web-Angebot/PDF,
kommt aus Modul Zahlungen.

## E — Klassifikation

**Kern:** Vorlagen + Renderer, Signaturen, Versionsarchiv, PDF-Export — ohne sie
funktioniert der Abschluss-Flow (Nordstern + Beweispflicht) nicht; nicht abschaltbar.
**Modul (Registry B10, abschaltbar):** EN-Übersetzung der Kundendokumente,
KI-Vorlagen-Import, Smart-Block „Tafelhinweis" (gastro-spezifisch, Default an).
**Storia-only (Fork/Seed, nicht Kern):** it/fr-Übersetzungen, die 6 STORIA-
Vorlagentexte (werden Seed-Daten des Storia-Mandanten), eSignatures.com-Altbestand.
Kriterium wie Spec 02: brauchen < 30 % der Zielmandanten es am Tag 1 → Registry/Fork.

## F — Bau-Plan

| # | Schritt | Abhängig von | Aufwand | Neu |
|---|---------|--------------|---------|-----|
| 1 | Migration: `templates`, `documents` (WORM-Trigger), `offer_history`-Erweiterung, `tenant_users`-Signaturfelder; RLS FORCE + Isolationstests | — | S | Tabellen |
| 2 | `packages/templating`: Renderer (Whitelist-Variablen, #if, Smart-Blocks, Escaping) + Golden-Tests DE/EN | — | M | Paket |
| 3 | API: Templates CRUD + Preview; Composer render | 1,2 | S | Endpunkte |
| 4 | Vorlagen-Studio UI (CRUD, Live-Preview, Signaturen) | 3 | M | UI |
| 5 | Composer im Angebots-Editor (Vorlage/Bausteine/Chips/Preview, mobil) | 3 | M | UI |
| 6 | PDF-Pipeline: Print-CSS auf Public-Offer, Browser-Rendering-Adapter, Queue, R2, `documents` | 1 | L | Adapter+Queue |
| 7 | Send-Flow erweitern: subject/html/recipients/language im Snapshot, PDF-Job, public `/pdf` | 3,6 | S | Endpunkt |
| 8 | Archiv-UI: Versionsliste, Read-only-Ansicht, Diff-Hinweis, Klonen mit Konflikt-Preview | 7 | M | UI |
| 9 | Übersetzung DE/EN: translate-Endpoint, Quell-Hash, Sync-Banner, EN-PDF | 2,6 | M | Endpunkt+UI |
| 10 | KI-Vorlagen-Import (Onboarding-Wizard-Schritt) | 3,4 | L | Endpunkt+UI |
| 11 | Storia-Migration: `email_templates`(body/content-Drift bereinigen) → `templates`; `inquiry_offer_history` → `offer_history` inkl. Empfänger-Backfill per Mail-Log (letztmalig Zeitmatching, danach nie wieder) | 1 | M | ETL |

Kritischer Pfad 1→2→3→5→7; 4, 6, 8–11 parallelisierbar.

## G — Risiken & Lösungen (Top 3)

1. **PDF-Pipeline-Abhängigkeit von Browser Rendering** (Limits, Kaltstart-Latenz,
   Preisänderung). → PDF nie blockierend (Web-Angebot ist der primäre Kanal),
   Queue mit Retry + `pdf_status`, `PdfRenderer`-Port mit Zweitprovider hinter der
   Registry; Kosten-Monitoring als Dashboard-Metrik.
2. **Template-Injection / PII-Leak** durch nutzererstellte Vorlagen, die in
   Kunden-Mails und öffentliche PDFs rendern. → keine freie Skriptsprache,
   Whitelist-Variablen, HTML-Escaping im Renderer-Paket, Preview = exakt derselbe
   Renderer wie Versand; Fuzz-Tests auf `{{`-Payloads.
3. **Immutability vs. DSGVO-Löschbegehren** (Art. 17 gegen Beweis-/GoBD-Archiv).
   → Aufbewahrung auf Art. 17(3) b/e + AO/GoBD stützen und in AVV/ADV dokumentieren;
   technisch: Lösch-Workflow anonymisiert Live-Daten, Archiv-Dokumente erhalten
   Legal-Hold-Flag mit Ablaufdatum; danach Hard-Delete aus R2 + Zeilenlöschung
   per SECURITY-DEFINER-Job (einziger erlaubter Löschpfad).

## H — Akzeptanzkriterien

1. Ein neuer Mandant lädt im Onboarding zwei alte Word-/PDF-Angebote hoch und hat
   in < 15 Minuten aktivierbare Vorlagen + Signatur im Studio (KI-Import).
2. Der Composer rendert jede aktive Vorlage mit echten Anfragedaten; nicht
   ersetzbare Variablen verschwinden rückstandsfrei, Preview == Versand (identischer
   Renderer, Golden-Test).
3. Smart-Blocks (Tafelhinweis, Checkliste, Eventdetails) sind pro Mandant in Text
   und Schwellen konfigurierbar — ohne Deployment, in DE und EN.
4. Ausgehende Mails tragen automatisch die persönliche Signatur des angemeldeten
   Teammitglieds aus dessen Profil; kein Personendatum ist im Code hinterlegt.
5. Jeder Versand erzeugt eine Version mit Betreff, Text, Versand-HTML, Empfängern
   (to/cc/bcc), Sprache, Options-Snapshot (Cents) und PDF-Referenz; UPDATE/DELETE
   auf diese Version und auf `documents` schlagen auf DB-Ebene fehl (Trigger-Test).
6. „Als Entwurf klonen" zeigt vor dem Restore, welche Live-Felder überschrieben
   würden, und fasst die Archiv-Version nachweislich nicht an.
7. Der Kunde lädt das Angebots-PDF über den public_token in DE oder EN; das PDF
   entsteht serverseitig, landet mit SHA-256 in R2/`documents` und ist byte-stabil
   reproduzierbar referenziert; ein roher UUID-Zugriff funktioniert nicht.
8. Der Angebotsversand dauert mit ausstehendem PDF nicht länger als ohne
   (PDF asynchron); ein fehlgeschlagener PDF-Job invalidiert den Versand nicht,
   sondern erscheint als behebbarer Hinweis am Vorgang.
9. Nach Änderung des DE-Anschreibens zeigt die EN-Fassung einen Sync-Hinweis;
   „Neu übersetzen" (KI, mit Bestätigung) hebt ihn auf.
10. RLS-Isolationstest: Mandant A kann Templates, Dokumente und Versionen von
    Mandant B weder lesen noch schreiben (automatisiert, hartes Gate).
