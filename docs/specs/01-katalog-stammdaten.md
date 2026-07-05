# Katalog & Stammdaten

Modul-Spec MAESTRO · Speisen/Getränke, Pakete, Räume, Equipment/Personal-Posten · Stand 2026-07-05

---

## A — IST im Alt-System (mit Evidenz)

**Zugehörige Inventar-Funktionen** (docs/MAESTRO-FEATURE-INVENTAR.md):
Stammdaten (9): Speisen-/Getränkeverwaltung mit Tabs Catering/Ristorante/Archiv/Papierkorb, Pakete & Locations, Paket-Editor, Location-Editor, Equipment-Katalog mit CSV-Import, Fotoalbum mit KI-Klassifizierung. Menü/Katalog (5): Ristorante-Import aus Fremd-DB, Preis-Reparatur, Menü-PDF-Parsing per KI, KI-Übersetzung, Paket-Menü-Übersetzung. Menü-Katalog (5, DB): menus/menu_categories/menu_items, Soft-Delete+Archiv+Auto-Purge, packages + 3 Konfig-Tabellen, equipment_catalog + staff_catalog, locations. Speisekarten (7): Catering-Menü-CRUD, kombinierter Katalog, Paket-Gänge-Vollständigkeitsprüfung.

**Nachweislich unfertig / tot / Workaround:**

1. **KI-Menü-Import existiert nur als tote Edge Function.** `supabase/functions/parse-menu-pdf/index.ts` parst ein Menü-PDF per Gemini in strukturierte Kategorien/Items inkl. EN-Übersetzung — aber `grep parse-menu src/` liefert **null Treffer**: kein Screen, kein Hook ruft sie auf. Der wichtigste Time-to-Value-Hebel ist gebaut und nie angeschlossen worden.
2. **`staff_catalog` ist eine Tabelle ohne Verwaltungs-Screen.** Migration `20260513211721` legt sie an; einziger Nutzer ist lesend `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineServiceEditor.tsx:46`. `EquipmentCatalogCard.tsx` verwaltet nur `equipment_catalog`. Personal-Posten können nirgends gepflegt werden.
3. **Allergene: DB-Feld ohne Editor.** `menu_items.allergens` existiert (types.ts:3132), wird in Druck-Sheets gelesen (`print/sheetParts.tsx`), ist aber im `MenuItemEditor.tsx` **nicht editierbar** (nur vegetarisch/vegan-Switches). LMIV-Pflichtangabe faktisch unpflegbar.
4. **Geld als Float + Freitext.** `menu_items.price: numeric` plus `price_display: string` ("ab 12,90 €"); `useCombinedMenuItems.ts:20-23` parst Preise per Regex aus Freitext zurück; `supabase/functions/fix-ristorante-prices` ist ein Einmal-Reparatur-Werkzeug für kaputte Preisdaten. `staff_catalog.price_per_unit numeric`. Verstößt gegen die Cents-Leitplanke und hat nachweislich Datenschäden erzeugt.
5. **Zwei Katalog-Welten per Fremd-DB-Hack.** `fetch-ristorante-menus`/`-complete-menus` lesen die Restaurant-Karte aus einer **zweiten Supabase-DB** (env `RISTORANTE_SUPABASE_URL`, index.ts:61); `useCombinedMenuItems.ts` fusioniert Catering + Ristorante zur Laufzeit. Nicht mandantenfähig, reines Storia-Konstrukt.
6. **Multi-Tenancy nachgerüstet, nicht erzwungen:** `tenant_id` ist auf allen Katalogtabellen `string | null` (types.ts) — keine NOT-NULL-Garantie, kein FORCE RLS.
7. **Überkomplexe Paket-Konfiguration:** 4 Tabellen (`package_menu_items`, `package_course_config`, `package_drink_config`, `package_locations`, Migrationen 20260128*) plus Storia-only Gruppenreisen-Felder (`currency`, `target_groups`, `language_support`, `website_menu_key`) am Paket — deren Abnehmer (`_legacy_group_inquiries`) ist seit 2026-05 stillgelegt.
8. **Monolith-UI:** `MenuItemsList.tsx` 1.546 Zeilen, `PackageEdit.tsx` 814 Zeilen — Tabs, Papierkorb, Archiv, Drag&Drop, Übersetzung in einer Komponente.

**Neubau-Stand (maestro-cloud):** Schema hat tenants/customers/inquiries/events/offer_options/payments mit Cents + FORCE-RLS; `events.packageId`/`locationId` sind **uuid ohne FK** (schema.ts:256f) — Katalog ist komplettes Greenfield. `offer_options.packageNameSnapshot` zeigt: das Snapshot-Muster ist bereits vorgesehen.

---

## B — Der eigentliche Job (Jobs-to-be-done)

**Job 1 (Onboarding):** "Ich habe eine Speisekarte (Papier/PDF/Website) und keine Event-Abteilung — mach mich in unter 15 Minuten angebotsfähig." Der Katalog ist kein Selbstzweck, sondern die Zutatenbasis, damit die Nordstern-Metrik (Minuten bis Angebot) überhaupt erreichbar ist.
**Job 2 (Betrieb):** "Wenn eine Anfrage reinkommt, will ich Positionen und Pakete in Sekunden finden und einsetzen — mit korrekten Preisen, MwSt und Allergenen, ohne doppelte Pflege."
**Job 3 (Verkauf):** "Pakete sind meine vorformulierten Antworten auf die häufigsten Anfragen (Firmenfeier, Geburtstag, Aperitivo) — einmal gebaut, hundertmal verschickt."

**Gestrichen / zusammengelegt (mit Begründung):**
- **Zweite Katalog-Welt (Ristorante-Fremd-DB-Sync, fetch-ristorante-*, fix-ristorante-prices, useCombinedMenuItems):** gestrichen. EIN Katalog pro Mandant; die Restaurant-Karte kommt per KI-Import rein statt per Fremd-DB-Kopplung.
- **equipment_catalog + staff_catalog als Separattabellen:** zusammengelegt in `catalog_items` mit `kind` (food/drink/equipment/staff/other). Löst nebenbei Befund 2 (Personal ohne UI) — ein Screen für alles.
- **menus-Ebene (Karten "Lunch/Weihnachten/…"):** gestrichen. Das war Website-CMS für events-storia.de. MAESTRO braucht Kategorien + Items; Saisonales löst `archived_at` + Tags.
- **Papierkorb + Archiv + 60-Tage-Auto-Purge (3 Zustände):** vereinfacht auf `archived_at` (Archiv) + hartes Löschen nur ohne Referenzen. Angebote referenzieren Snapshots, nie live — Löschen ist damit gefahrlos.
- **Gruppenreisen-Felder am Paket + visible_on_website/website_menu_key:** gestrichen (Storia-only, Abnehmer stillgelegt). Ersatz: ein generisches `is_public` fürs spätere Lead-Widget.
- **4 Paket-Konfig-Tabellen:** ersetzt durch EIN Zeilenmodell `package_items` (Abschnitt + Auswahlregel). Deckt Pflichtgänge, Wahlgänge und Getränkegruppen ab.
- **Fotoalbum/DAM mit KI-Klassifizierung, Ordnern, Versionen:** gestrichen als Modul. Ein Bild pro Item/Paket/Raum (R2-Upload) reicht dem Job; DAM ist Oktopus.
- **DE/EN-Spaltenpaare (name_en, description_en, min_order_en …):** ersetzt durch `translations jsonb` — DE+EN heute, weitere Sprachen ohne Migration.

---

## C — Benchmark 2026

**Table Stakes (alle führenden Anbieter):** durchsuchbarer Artikel-/Positionskatalog als Quelle für Angebote und BEOs (Tripleseat Picklists, Perfect Venue Menu Items, easyBANKETT Artikelstamm); Pakete/Bundles mit pro-Person/pauschal-Preisen; Räume mit Kapazitäten als Basis für Kalender/Doppelbuchungsschutz. Das müssen wir gleichwertig können.

**Wo die Besten stehen:** Perfect Venue ($59–189) hält den Katalog bewusst flach (Items + Sections, manuell gepflegt) — schnell, aber Onboarding heißt Abtippen. Tripleseat/Event Temple setzen auf Setup durch Customer Success. Eventmachine (ab 95 €) hat den reichsten Paket-Konfigurator (Event-Konfigurator auf der Website), aber mit Setup-Projekt. DACH-Legacy (Bp Event ~3.000 € + Schulung) hat Artikelstämme mit Warenwirtschaftstiefe — genau der Oktopus, den wir nicht bauen. **Kein Wettbewerber macht "Speisekarte fotografieren → Katalog steht" zum Kern-Onboarding-Flow.** Der Digest bestätigt die Lücke explizit (Empfehlung: "Onboarding mit KI-Import — Speisekarte/PDF-Angebote hochladen → Artikel+Templates fertig").

**Wo wir schlagen:** (1) KI-Import als Onboarding-Moment mit Ziel <15 Min bis erstes Angebot — niemand bietet das Self-Service. (2) Ein Katalog übers ganze Spektrum inkl. Equipment/Personal-Posten (Reservierungs- und Bankett-Welt getrennt bei allen anderen). (3) DACH-nativ: MwSt-Klasse 7/19 am Artikel, LMIV-Allergene, DE/EN per KI — US-Tools können keins davon.

---

## D — Soll-Design (Neubau)

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)

1. **Onboarding-Step "Speisekarte importieren":** Karte mit 3 großen Aktionen — Foto aufnehmen (mobil: Kamera direkt), PDF/Bild hochladen, URL einfügen — plus "Später, leer starten". Mehrere Dateien erlaubt (Speisekarte + Getränkekarte).
2. **Parsing mit Live-Feedback:** Fortschritts-Screen zeigt Zwischenstände ("3 Kategorien, 24 Gerichte erkannt…"), kein stummer Spinner. Dauer-Ziel <60 s pro Dokument.
3. **Review-Screen (der entscheidende Moment):** Tabelle je Kategorie; pro Zeile Name, Preis (Cents-Feld, vorbefüllt), MwSt-Klasse, Diät-Flags, Konfidenz-Badge (grün/gelb). Gelbe Zeilen (unsicherer Preis, unklare Kategorie) sind vorselektiert zur Prüfung. Inline-Edit, Zeilen abwählbar, Kategorie umhängbar. **Nie Auto-Commit.**
4. **Commit + Erfolgsmoment:** "47 Artikel in 3:12 Min importiert" — die Zahl zahlt sichtbar auf die Time-to-Value-Story ein. EN-Übersetzung läuft danach als Hintergrund-Job (Badge "KI-übersetzt" an Feldern).
5. **KI-Startpakete:** Direkt nach Commit schlägt die KI 3 Pakete aus dem eigenen Katalog vor (z. B. "Aperitivo 25 €/Pers.", "3-Gang-Menü", "Fingerfood-Buffet") — Entwürfe, einzeln übernehmbar/editierbar.
6. **Katalog-Hauptscreen (ein Screen statt 4):** Filterchips Speisen/Getränke/Equipment/Personal + Tag-Filter (Saison: "sommer", "weihnachten"), Suche, Kategorie-Gruppierung, Inline-Preisedit, Bulk-Aktionen (archivieren, MwSt setzen, taggen, übersetzen). Mobil: Liste + Bottom-Sheet-Editor.
7. **Paket-Editor:** Stammfelder (Name, Bild, Preis/Person oder pauschal in Cents, Min/Max-Gäste, Anzahlungs-%) + Abschnitte (Gänge/Getränke/Inklusive) mit Auswahlregeln ("Hauptgang: 1 aus 3"); Live-Preisvorschau mit MwSt-Split nach der Aufteilungsregel (s. u.): System schlägt den Split vor, Nutzer bestätigt.
8. **Räume-Screen:** schlichte Liste — Name, Bild, Kapazität sitzend/stehend, Ausstattung, Raummiete, Mindestumsatz (F&B-Minimum), Archiv. Verbraucht vom Kalender-Modul (Doppelbuchungsschutz) und Paket-Zuordnung.

### Datenmodell (Neon Postgres, Drizzle; alle Tabellen: `tenant_id uuid NOT NULL` FK tenants, crudPolicy `tenantIsMember`, FORCE RLS wie 20_force_rls.sql; Geld ausschließlich Integer-Cents)

```
catalog_categories  id, tenant_id, name, translations jsonb, kind_scope text NULL,
                    sort_order int, archived_at timestamptz NULL,
                    UNIQUE(tenant_id, id)                        -- Ziel für Tenant-FKs

catalog_items       id, tenant_id, category_id NULL, kind text CHECK
                    (food|drink|equipment|staff|other),
                    name text NOT NULL, description text, translations jsonb,
                    price_cents int NOT NULL DEFAULT 0,
                    pricing_unit text CHECK (per_person|per_piece|per_hour|flat),
                    vat_class text CHECK (food|drink|service),   -- Satz löst das Angebots-Modul
                    default_quantity int DEFAULT 1,
                    min_quantity int NULL,                       -- "ab 20 Stück"; Builder warnt, blockiert nicht
                    allergens text[] NULL,                       -- 14 LMIV-Codes; NULL = ungepflegt ≠ '{}' = geprüft: keine
                    dietary jsonb DEFAULT '{}',                  -- vegetarian/vegan/glutenfree…
                    tags text[] DEFAULT '{}',                    -- Saison/Anlass ("sommer","weihnachten"), GIN-Index
                    image_url text, price_note text,             -- Anzeigetext, rechnet NIE
                    source text (manual|ai_import|csv), ai_confidence real NULL,
                    archived_at timestamptz NULL, sort_order int, created/updated_at
                    UNIQUE(tenant_id, id)
                    FK (tenant_id, category_id) → catalog_categories(tenant_id, id)
                    UNIQUE NULLS NOT DISTINCT (tenant_id, category_id, name)
                      WHERE archived_at IS NULL                  -- Dedupe nur für Aktive; Archiv blockiert Neuanlage nicht

packages            id, tenant_id, name, description, translations jsonb,
                    price_cents int NOT NULL, pricing_unit (per_person|flat),
                    min_guests int, max_guests int NULL,
                    deposit_percent int NULL,                    -- Vorauszahlung bei Annahme
                    vat_split jsonb NULL,                        -- bestätigter Split je vat_class, z. B. {"food":60,"drink":40}
                    image_url, is_public bool DEFAULT false, archived_at, sort_order,
                    UNIQUE(tenant_id, id)

package_rooms       tenant_id, package_id, room_id               -- Junction statt uuid[]-Array
                    FK (tenant_id, package_id) → packages(tenant_id, id) CASCADE
                    FK (tenant_id, room_id) → rooms(tenant_id, id) CASCADE

package_items       id, tenant_id, package_id,
                    section text (course|drinks|included|extra), section_label text,
                    choice_mode text (fixed|choose_one|choose_many), choice_count int NULL,
                    catalog_item_id NULL, free_text text NULL,   -- eins von beiden
                    qty_per_guest numeric NULL, included_in_price bool DEFAULT true,
                    surcharge_cents int DEFAULT 0, sort_order int
                    FK (tenant_id, package_id) → packages(tenant_id, id) CASCADE
                    FK (tenant_id, catalog_item_id) → catalog_items(tenant_id, id)

rooms               id, tenant_id, name, description, translations jsonb,
                    capacity_seated int, capacity_standing int, features jsonb,
                    rental_fee_cents int NULL, min_spend_cents int NULL,  -- Raummiete, F&B-Mindestumsatz
                    image_url text, archived_at timestamptz NULL, sort_order int,
                    UNIQUE(tenant_id, id)

import_jobs         id, tenant_id, type (pdf|image|url|csv), status
                    (pending|parsing|review|committed|failed),
                    source_url text, source_file_key text NULL,  -- R2-Key der Quelldatei (Retention s. u.)
                    raw_result jsonb, error text,
                    stats jsonb ({items, categories, low_confidence,
                                  uploaded_at, parsed_at, committed_at}),
                    created_by, created/updated_at
```

**Cross-Tenant-Integrität:** Postgres prüft FKs an RLS **vorbei** — ein einfacher FK ließe `package_items.catalog_item_id` auf Datensätze eines fremden Mandanten zeigen. Deshalb sind alle mandantenübergreifend missbrauchbaren FKs zusammengesetzt (`(tenant_id, ref_id) REFERENCES ziel(tenant_id, id)`, mit `UNIQUE(tenant_id, id)` am Ziel, s. o.). Dasselbe Muster gilt in Schritt 1 für `events.package_id`/`location_id` (ON DELETE SET NULL).

**Lifecycle:** genau EIN Feld — `archived_at` (NULL = aktiv), kein `is_active`. Archivierte fliegen aus Default-Listen und dem Angebots-Picker, bleiben per `?archived=true` auffindbar. Kein Rückfall ins 3-Zustands-Modell des Alt-Systems.

**MwSt-Split (Aufteilungsgebot bei Kombiangeboten):** Der Pauschal-/pro-Person-Preis eines Pakets muss für die Rechnung auf 7-%-/19-%-Anteile aufteilbar sein. Regel: Das System schlägt den Split je `vat_class` proportional zu den Listenpreisen (`price_cents` × Menge) der referenzierten `catalog_items` mit `included_in_price=true` vor; `free_text`-Zeilen gehen nicht in den Vorschlag ein. Der Nutzer bestätigt oder korrigiert → `packages.vat_split`. Beim Angebot wird der daraus berechnete Cents-Split in den Snapshot geschrieben — stabil für LexOffice (Welle 1), auch wenn sich das Paket später ändert.

**Varianten light:** Ausschankgrößen/Portionsgrößen gehören in den Namen — "Augustiner Hell 0,3l" und "Augustiner Hell 0,5l" sind zwei Items (Parser-Konvention, im Import-Prompt festgeschrieben und im Testkorpus geprüft). Kein variants-Modell in v1.

Angebote referenzieren Items **per Snapshot** in `offer_options.menu_selection` (jsonb, existiert schon) — Katalogänderungen brechen nie versendete Angebote.

### API (Hono-Worker, /api/*, tenant-scoped via withTenant)

- `GET/POST /catalog/items` · `PATCH/DELETE /catalog/items/:id` (Filter: kind, q, category, tags, archived; DELETE nur ohne Referenz, sonst 409 → archivieren)
- `POST /catalog/items/bulk` (CSV-Import, Bulk-Archiv, Bulk-MwSt)
- `GET/POST/PATCH /catalog/categories`
- `GET/POST /packages` · `PATCH/DELETE /packages/:id` · `PUT /packages/:id/items` (Abschnitte als Ganzes ersetzen — ein Save, kein Zeilen-Ping-Pong)
- `GET/POST /rooms` · `PATCH/DELETE /rooms/:id` (DELETE nur ohne Referenz, sonst 409 → archivieren — dasselbe Schutzmuster wie Items)
- `POST /catalog/import` (multipart Datei ODER {url}) → 202 + job_id · `GET /catalog/import/:id` → Status/Review-Payload · `POST /catalog/import/:id/commit` (bestätigte Zeilen; idempotent per Idempotency-Key — Doppelklick/Queue-Redelivery erzeugt keine Duplikate)
- `POST /catalog/translate` (Batch: fehlende Sprache für ausgewählte Items/Pakete)
- `POST /catalog/suggest-packages` → 3 Paket-Entwürfe aus Katalog

### Automatisierungen

- **Import-Queue:** `POST /catalog/import` legt Job an, Cloudflare Queue verarbeitet (Vision-Parse, Chunking bei Mehrseiten-PDF), Status-Polling im UI. Queues liefern **at-least-once** → Consumer und Commit-Endpoint sind idempotent (Idempotenz-Key), sonst doppelte Parse-Ergebnisse.
- **Übersetzungs-Job:** nach Commit automatisch EN-Entwürfe für alle Items ohne Übersetzung (Queue, Batch) — nur bei aktivem Modul catalog-i18n.
- **Bild-Pipeline:** Upload → R2, Resize on the fly (Cloudflare Images/Worker), keine Originale im UI.
- **Retention (DSGVO by design):** Quelldatei (R2, `source_file_key`) und `raw_result` werden 30 Tage nach `committed`/`failed` automatisch gelöscht (R2-Lifecycle-Rule + täglicher Cleanup-Cron) — Speisekarten-Fotos können beiläufig Personen zeigen. Entschieden vor Bau von Schritt 6.

### Telemetrie (Messung der Nordstern-Metrik)

Import-Funnel-Events mit tenant_id, job_id, Timestamp und Item-Zahlen: `import_upload_started` → `import_parse_done` → `import_review_opened` → `import_commit_done` (Timestamps liegen in `import_jobs.stats` teils schon vor), dazu `catalog_item_created` und `package_created`. Daraus messbar: Time-to-Value (Upload→Commit), Funnel-Drop-off, Katalog-Nutzung. AK 1 wird gegen diese Events gemessen — ohne sie wäre die ≤10-Minuten-Behauptung nicht prüfbar.

### KI-Punkte (Input → Vorschlag → Bestätigung)

1. **Menü-Import:** Foto/PDF/URL → strukturierte Kategorien+Items mit Preis, MwSt-Klasse, Diät-Flags, Konfidenz je Zeile → Review-Screen, Mensch committet. (Prompt-Basis: parse-menu-pdf, aber generisch statt "italienisches Restaurant", plus Cents-Normalisierung, LMIV-Allergen-Erkennung und Varianten-light-Konvention: Größen in den Namen.)
2. **Übersetzung:** fehlende Sprache → Entwurf mit "KI-übersetzt"-Badge → editierbar, Badge verschwindet bei manueller Änderung.
3. **Allergen-/Diät-Vorschlag:** aus Name+Beschreibung → gelbe Vorschlags-Chips → Klick bestätigt. KI schreibt Allergene **nie** direkt (Risiko 4).
4. **Startpaket-Vorschlag:** Katalog → 3 Paket-Entwürfe mit Begründung → einzeln übernehmen.

### Integrations-Berührungen

- **LexOffice:** Angebots-/Rechnungspositionen entstehen aus Katalog-Snapshots inkl. vat_class → korrekter Steuersatz je Position (Welle 1).
- **Stripe:** deposit_percent am Paket steuert die Anzahlungsaufforderung des Angebots-Moduls.
- **Lead-Widget/Website (Welle 2):** `is_public`-Pakete als anfragbare Karten.
- **POS (Welle 3):** catalog_items.id als Matching-Anker für Umsatzrückspielung — jetzt nur ID-Stabilität garantieren, nichts bauen.

---

## E — Klassifikation

- **Kern:** catalog_categories, catalog_items (alle kinds), packages, package_items, package_rooms, rooms — der Angebots-Builder (Kernmodul) hängt hart daran. Rooms bleiben Kern-Tabelle (Kalender braucht sie), UI blendet den Screen aus, wenn der Mandant keine eigenen Räume pflegt (reine Caterer).
- **Modul (Registry B10, abschaltbar):** KI-Import + Startpaket-Vorschlag ("catalog-ai-import") — im Onboarding default an; Übersetzungs-KI ("catalog-i18n") für rein deutschsprachige Betriebe abschaltbar.
- **Storia-only (nicht in MAESTRO):** Ristorante-Fremd-DB-Sync, Gruppenreisen-Paketfelder, Website-Sichtbarkeits-Sync zu ristorantestoria.de, Fotoalbum-DAM. Migration der Storia-Daten per einmaligem Import-Skript in den Storia-Mandanten.

Kriterien: Kern = ohne das Ding kein Angebot in Minuten; Modul = beschleunigt, aber ersetzbar durch Handarbeit; Storia-only = genau ein Abnehmer.

---

## F — Bau-Plan

| # | Schritt | Abh. | Aufwand | Neu |
|---|---------|------|---------|-----|
| 1 | Schema + RLS + Drizzle (6 Tabellen, zusammengesetzte Tenant-FKs, FKs auf events, Seeds für Dev) | — | M | packages/db: 30_catalog.sql |
| 2 | CRUD-API items/categories/packages/rooms inkl. 409-Löschschutz | 1 | M | apps/api routes/catalog.ts, packages.ts, rooms.ts |
| 3 | Katalog-Hauptscreen (Filterchips, Suche, Inline-Edit, Archiv, Bottom-Sheet mobil) | 2 | M | apps/web pages/catalog.tsx |
| 4 | Paket-Editor mit package_items-Abschnitten + Live-Preisvorschau (MwSt-Split) | 2 | M | pages/package-edit.tsx |
| 5 | Räume-Screen | 2 | S | pages/rooms.tsx |
| 6 | Import-Pipeline: import_jobs, Queue-Consumer (idempotent), KI-Parse (PDF/Bild/URL), CSV-Pfad, Retention-Cron | 1 | L | Worker-Queue + lib/menu-parse.ts |
| 7 | Review-&-Commit-UI mit Konfidenz-Badges | 6,3 | M | pages/catalog-import.tsx |
| 8 | Onboarding-Einbindung + Erfolgsmoment + Startpaket-Vorschlag | 7,4 | M | Onboarding-Step |
| 9 | Übersetzungs-Batch + Allergen-Vorschlag | 3 | S | /catalog/translate |
| 10 | Angebots-Builder-Anbindung: DishPicker/PackagePicker auf neue API, Snapshot-Write | 2 | M | im Modul Angebot |
| 11 | Storia-Datenmigration (Alt-Supabase → Storia-Mandant, Preise → Cents) | 1 | M | einmaliges Skript |

Kritischer Pfad für Time-to-Value: 1 → 2 → 6 → 7 → 8. Schritte 3–5 parallelisierbar.

---

## G — Risiken & Lösungen (Top 5)

1. **KI-Parse-Qualität bricht den Onboarding-Moment** (mehrspaltige Karten, Fotos schräg, Weinkarten mit Jahrgängen). → Review-Gate ist Pflicht (nie Auto-Commit), Konfidenz je Zeile, gelbe Zeilen zuerst; Mehrseiten-PDF seitenweise chunken; Fallbacks URL-Scrape und CSV; Testkorpus aus 20 echten DACH-Speise- und Getränkekarten (inkl. Mehrfachgrößen 0,3l/0,5l) vor Launch, Ziel ≥95 % korrekte Preise.
2. **Paketmodell wächst zurück zum Alt-Monster** (4 Konfig-Tabellen, Overrides überall). → Hartes Limit: EIN Zeilenmodell package_items; alles, was das nicht abbildet (Tagesfolgen, Sonderwünsche), lebt im Angebot (menu_selection-Snapshot), nicht im Stammdatum. Review-Regel: neue Katalog-Tabelle nur mit Spec-Änderung.
3. **MwSt-Fehlklassifikation (7 % vs. 19 % hängt am Servicekontext, nicht nur am Artikel).** → Bewusste Trennung: Artikel trägt nur `vat_class` (food/drink/service); den effektiven Satz löst das Angebots-Modul aus Kontext (Lieferung/Abholung vs. im Haus) inkl. BMF-70/30-Pauschalregel; Satz im Angebot pro Position überschreibbar; Disclaimer "Steuersätze mit Steuerberater prüfen" im Onboarding.
4. **Ungepflegte Allergene maskieren sich als "allergenfrei"** — LMIV-Pflichtangabe, also Gesundheits- und Haftungsrisiko, kein Datenqualitätsproblem. → `allergens NULL` = ungepflegt ist strikt von `'{}'` = geprüft-keine unterschieden; Function-Sheets und Angebots-Snapshots rendern NULL sichtbar als **"Allergene nicht erfasst"**, nie als leer; die KI setzt Allergene nie automatisch (nur Vorschlags-Chips + Klick-Bestätigung, KI-Punkt 3); Disclaimer im Onboarding analog Steuersatz.
5. **LLM-/Queue-Ausfall im Onboarding-Moment + KI-Kosten/Missbrauch.** Die ersten 15 Minuten eines Neukunden sind die einzige Chance auf den ersten Eindruck; ungeschützt wäre der Import-Endpoint Gratis-OCR für jeden Trial-Tenant. → (a) Fallback bei Parse-Timeout > 120 s: "Wir benachrichtigen dich" + E-Mail-Link zurück in den Review — das Onboarding läuft derweil weiter (z. B. Räume anlegen); (b) Quota pro Tenant/Tag für Import- und Übersetzungs-Jobs; (c) Cloudflare Queues liefern at-least-once → Idempotenz-Key am Queue-Consumer und am Commit-Endpoint.

---

## H — Akzeptanzkriterien

1. Ein neuer Mandant kommt mit einem Speisekarten-Foto (Smartphone) in ≤10 Minuten zu einem committeten Katalog mit ≥20 Artikeln inkl. Preisen in Cents — gemessen über die Telemetrie-Events `import_upload_started` → `import_commit_done` (Abschnitt D), ohne Support.
2. Kein KI-Import-Ergebnis landet ohne expliziten Nutzer-Commit im Katalog; der Review-Screen zeigt für jede Zeile eine Konfidenz und erlaubt Inline-Korrektur. Ein doppelt ausgelöster Commit (Doppelklick, Queue-Redelivery) erzeugt keine doppelten Items.
3. Alle Preisfelder in Katalog und Paketen sind Integer-Cents; es existiert kein numerisches Float-Preisfeld und kein Freitextfeld, das in Berechnungen einfließt.
4. Jede Katalog-Tabelle hat `tenant_id NOT NULL` mit FORCE RLS; ein Mandant kann per API nachweislich keine Items, Pakete oder Räume eines anderen Mandanten lesen oder schreiben. Zusätzlich: Ein Insert von `package_items` mit `catalog_item_id` eines anderen Tenants schlägt am zusammengesetzten FK fehl — gleiches gilt für Kategorie-, Raum- und Paket-Referenzen (Test mit zwei Tenants).
5. Equipment- und Personal-Posten werden im selben Katalog-Screen wie Speisen/Getränke angelegt, gesucht und archiviert (kein separater Screen, keine Tabelle ohne UI).
6. Ein Paket mit "Hauptgang: 1 aus 3" und Getränke-Abschnitt ist ausschließlich über package_items abgebildet; der Paket-Editor rendert eine Live-Preisvorschau mit MwSt-Split nach der Aufteilungsregel (Abschnitt D). Rechenweg-Beispiel: Paket 5000 Cents/Person, referenzierte Items mit Listenpreisen 3600 Cents (vat_class food) + 2400 Cents (vat_class drink) → Vorschlag 60/40; nach Bestätigung weist die Vorschau 3000 Cents food-Anteil und 2000 Cents drink-Anteil aus, und exakt dieser Split steht im Angebots-Snapshot.
7. Das Löschen eines Katalog-Items, das in einem versendeten Angebot vorkommt, verändert dieses Angebot nicht (Snapshot-Beweis) und die API antwortet bei Referenzen mit 409 + Archiv-Hinweis.
8. Allergene (14 LMIV-Codes) und Diät-Flags sind am Artikel editierbar; "ungepflegt" (NULL) und "geprüft: keine" ('{}') sind unterscheidbar, und Angebots-Snapshot wie Function-Sheet rendern ungepflegte Allergene sichtbar als "Allergene nicht erfasst" — nie als leer.
9. Bei aktivem Modul catalog-i18n liegen innerhalb von 10 Minuten nach Katalog-Commit für alle Items EN-Übersetzungsentwürfe vor (Badge "KI-übersetzt"), ohne dass der Nutzer sie angefordert hat; manuelle Änderung entfernt das Badge.
10. Der Katalog-Hauptscreen ist auf einem 390-px-Viewport voll bedienbar (Suche, Anlegen, Preis ändern, Archivieren) — PWA-tauglich.
11. Ein Raum ist mit Kapazitäten, Bild, Raummiete (`rental_fee_cents`) und Mindestumsatz (`min_spend_cents`) anleg-, editier- und archivierbar; DELETE eines referenzierten Raums antwortet mit 409 + Archiv-Hinweis.
12. Archivierte Items, Pakete und Räume erscheinen weder in Default-Listen noch im Angebots-Picker, bleiben über den Archiv-Filter auffindbar; ein archiviertes Item blockiert die Neuanlage gleichen Namens nicht (partieller Unique-Index).
