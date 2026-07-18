# 06 — Speisekarten-KI (Import, Katalog-Hebel, einbettbares Widget)

Stand: 2026-07-05 · Basis: Code-Audit ristorantestoria-Repo (nur lesen) + Kurz-Benchmark.
Kontext MAESTRO: schlankes, KI-natives Multi-Tenant-SaaS für DACH-Gastro (1–20 MA).
Nordstern-Metrik: **Minuten von Anfrage bis Angebot versendet.**

---

## A — IST-Zustand (Audit mit Evidenz)

### A.1 Wie die KI-Erkennung heute funktioniert

**Upload-Format:** Ausschließlich PDF. Der Uploader lehnt alles andere ab
(`src/components/admin/MenuUploader.tsx:81` — `if (selectedFile.type !== 'application/pdf')`).
Die Datei wird im Browser Base64-kodiert und komplett im Request-Body an die Edge
Function geschickt (`MenuUploader.tsx:94-104`, `convertToBase64`). Kein Foto-Upload,
kein Text-Paste, kein CSV, kein URL-Import, keine Mehrfachdateien. Große PDFs stoßen
an Body-Limits (Base64 = +33 % Payload), es gibt kein Chunking.

**Modell & Gateway:** `supabase/functions/parse-menu-pdf/index.ts:146-153` ruft den
**Lovable AI Gateway** (`ai.gateway.lovable.dev`) mit `google/gemini-2.5-flash` auf;
das PDF wird als `image_url` mit `data:application/pdf;base64,…` übergeben, Antwort
per erzwungenem Tool-Call `extract_menu` (JSON-Schema). Die Modell-Landschaft ist
fragmentiert:

| Function | Modell | Gateway |
|---|---|---|
| `parse-menu-pdf` | google/gemini-2.5-flash | Lovable |
| `spell-check-menu` | google/gemini-2.5-flash | Lovable |
| `translate-special-menu` | google/gemini-3-flash-preview | Lovable |
| `translate-group-menu`, `classify-seasonal-menu` | claude-haiku-4-5 | Anthropic direkt |

Vier Functions, drei Modelle, zwei Gateways, kein Kosten-Logging pro Aufruf —
Vendor-Lock auf Lovable für den kritischen Pfad.

**Ein-Schuss-Extraktion + Übersetzung:** Der System-Prompt verlangt Extraktion UND
Übersetzung DE→EN/IT/FR **im selben Call** (`parse-menu-pdf/index.ts:87-144`). Der
Prompt eskaliert über 16 nummerierte Regeln mit Großbuchstaben-Drohungen („NIEMALS
den deutschen Text einfach nach name_it kopieren!") — klares Indiz, dass das Modell
genau das regelmäßig tut. Bestätigt durch die eingebaute Heuristik
`validateTranslations` (`index.ts:271-307`), die deutsche Kopien in IT-Feldern nur
**loggt** und dann kommentiert: *„DB trigger will fallback to DE for empty fields"* —
d. h. italienische Besucher sehen im Zweifel deutschen Text. Der Trigger existiert
tatsächlich (Migration `20260309114217_….sql:47-48`: `NEW.name_it := NEW.name`).

**Rechtschreibprüfung:** Nach dem Parse läuft automatisch `spell-check-menu`
(JWT + Admin-Rollen-Check, vorbildlich — `spell-check-menu/index.ts:49-75`).
Die Ablehnen-Buttons im UI sind aber No-Ops: `handleRejectError` und
`handleRejectAll` haben leere Bodies (`MenuUploader.tsx:234-245`).

### A.2 Datenmodell & Publishing

Schema seit `20251202191432_….sql`: `menus` (UNIQUE(menu_type)), `menu_categories`,
`menu_items` mit `price DECIMAL`, `price_display TEXT`, `allergens`, `is_vegetarian`,
`is_vegan`. RLS: öffentliches SELECT nur auf `is_published = true`, Schreiben nur
Admin-Rolle. IT/FR-Spalten nachgerüstet (`20251211162852`), lokalisierte Slugs
nachgerüstet (`20260204_add_localized_slugs.sql` — mit REPLACE-String-Magie auf
Slugs als „basic translation - can be enhanced later").

**Publish ist destruktiv und nicht transaktional** (`MenuUploader.tsx:252-412`):
1. `is_published = false` setzen (Karte verschwindet öffentlich wegen RLS),
2. alle `menu_categories` löschen (CASCADE löscht Items),
3. Kategorien + Items in einer **clientseitigen Schleife einzeln** inserten (N+1),
4. `is_published = true`.
Bricht der Browser bei Schritt 3 ab, steht eine halbleere Karte online. Alle IDs
rotieren bei jedem Publish. Keine Versionierung, keine Historie, kein Rollback.

### A.3 Unfertig / fehlerhaft (Evidenz)

1. **Stiller Datenverlust Allergene/Vegan:** `parse-menu-pdf` extrahiert
   `allergens`, `is_vegetarian`, `is_vegan` als Pflichtfelder (Tool-Schema
   `index.ts:218-223`), aber das `ParsedItem`-Interface im Uploader kennt die
   Felder nicht (`MenuUploader.tsx:34-49`) und `handlePublish` insertet sie nicht
   (`MenuUploader.tsx:357-373`). Die extrahierten Allergene werden **weggeworfen**,
   obwohl die DB-Spalten existieren. LMIV-relevant.
2. **Reparatur-Function als Workaround-Beweis:** `cleanup-menu-data/index.ts`
   existiert nur, um Parsing-Folgeschäden zu heilen: Preise/Allergene, die in
   Beschreibungen kleben, per Regex nachträglich herausschneiden; italienische
   Namen anhand einer **hartkodierten Liste von ~60 italienischen Begriffen**
   kopieren. Im events-storia-Repo zusätzlich `fix-ristorante-prices`
   („Einmal-Werkzeug: parst price_display-Strings in numerische Preise",
   `docs/MAESTRO-FEATURE-INVENTAR.md`).
3. **`price_display_en/it/fr`** existieren in DB, Hook-Interface
   (`src/hooks/useMenu.ts`) und Seed — werden aber weder vom Parser erzeugt noch
   vom Publish gespeichert. Toter Pfad, nur vom handgebauten Oktoberfest-Seed
   befüllt (`20260701120000_seed_oktoberfest_menu.sql` — via
   `scripts/gen-oktoberfest-menu.ts` an der ganzen Upload-Pipeline vorbei gepflegt:
   der deutlichste Beleg, dass die Pipeline dem Team selbst nicht genügt).
4. **Statische Fallback-JSONs als Verfügbarkeits-Krücke:**
   `src/data/menu-food-fallback.json` u. a. werden in `useMenu.ts` und
   `prerender.js:40-57` geladen, wenn Supabase nicht erreichbar ist; Pflege manuell
   über `scripts/export-special-menus.sh`. `prerender.js:7` dokumentiert selbst:
   *„Includes manual fix for specific menu pages"*.
5. **Publish erfordert Website-Rebuild:** `handlePublish` ruft
   `triggerGitHubDeploy()` (`MenuUploader.tsx:405`) — jede Kartenänderung wartet
   auf einen kompletten GitHub-Actions-SSG-Build.
6. **Admin-UI editiert nur DE/EN:** `MenuPreview.tsx` bietet Felder nur für
   Titel/Untertitel DE+EN und Items nur DE — IT/FR sind im Review nicht
   korrigierbar, obwohl gespeichert. `syncTranslations` übersetzt bei jedem
   Speichern erneut (Kosten, Drift).
7. **Sicherheit:** In jeder Function ein **hartkodiertes `shared_secret`** fürs
   Error-Reporting inkl. hartkodierter Fremd-Projekt-URL
   (`parse-menu-pdf/index.ts:53-62`). `parse-menu-pdf` hat `verify_jwt = true`
   (`supabase/config.toml`), aber **keinen Admin-Rollen-Check** — inkonsistent zu
   `spell-check-menu`. CORS `*`.

### A.4 SEO / JSON-LD heute

`src/components/MenuStructuredData.tsx` baut `schema.org/Menu` mit
`hasMenuSection`/`hasMenuItem`/`offers` — gut gedacht, aber:
- **Client-seitig** via react-helmet injiziert; ohne den Prerender-Build ist das
  Markup für Nicht-JS-Crawler unsichtbar. SSG holt Daten zur Build-Zeit
  (`prerender.js:70-118`), danach veraltet bis zum nächsten Deploy.
- **Bug:** Ist `price` null, wird `price_display` (z. B. `"15,90 €"`) als
  `offers.price` gesetzt (`MenuStructuredData.tsx:68-74`) — ungültiger Wert,
  Validierungsfehler im Rich-Results-Test.
- Nur DE/EN (`inLanguage` de-DE/en-US); IT/FR-Daten werden ignoriert.
- Domain hartkodiert (`https://www.ristorantestoria.de`).

**Fazit IST:** Die Idee (PDF → KI → strukturierte, mehrsprachige Karte → JSON-LD)
ist richtig und validiert. Die Umsetzung ist Single-Tenant, verliert Daten auf dem
Weg, koppelt Extraktion und Übersetzung fehlerträchtig in einen Call, publisht
destruktiv ohne Version und braucht für jede Änderung einen Website-Build.

---

## B — Job to be done

**Ein Feature, zwei Nutzende:**

**(a) Intern — Onboarding-Hebel (zahlt direkt auf die Nordstern-Metrik):**
„Als neuer MAESTRO-Mandant lade ich meine bestehende Speisekarte (PDF/Foto) hoch
und habe in Minuten einen nutzbaren Artikel-Katalog — damit mein erstes Angebot
noch am selben Tag rausgeht." Der Karten-Import ist der schnellste Weg, den
Katalog (Spec `01-katalog-stammdaten.md`, noch nicht geschrieben — dieses Modul
definiert die Schnittstelle mit) zu befüllen, ohne 80 Gerichte abzutippen. Ohne
gefüllten Katalog kein Angebots-Builder, ohne Angebots-Builder keine Nordstern-Metrik.

**(b) Extern — Speisekarten-Widget:**
„Als Gastronom will ich, dass die Karte auf meiner Website (WordPress/Wix/Jimdo)
immer aktuell, allergen-korrekt (LMIV) und von Google indexierbar ist — ohne
Webdesigner und ohne PDF-Austausch." Preisänderung im MAESTRO-Admin → Website,
QR-Code am Tisch und Google sehen sie sofort. Nebeneffekt für MAESTRO: das Widget
ist ein sichtbares Logo „powered by MAESTRO" auf jeder Kundenwebsite (Akquise-Kanal).

---

## C — Benchmark (kurz)

| Anbieter | Was sie tun | Relevanz |
|---|---|---|
| [MenuTiger](https://www.menutiger.com/) ([Pricing](https://www.menutiger.com/pricing)) | QR-/Digital-Menü-SaaS, Free-Tier, $17–119/Mon., AI-Menu-Builder, Website-Embed, White-Label erst im Premium | Feature-Messlatte fürs Widget; US-zentriert, kein DACH/LMIV-Fokus |
| [Speiso](https://speiso.com/) (DACH) | „KI erkennt Gerichte, Preise & Allergene automatisch" aus Foto/PDF, QR-Karte | Direktester Wettbewerber zu unserem Import — bestätigt den Bedarf; endet aber bei der QR-Karte |
| [resmio](https://www.resmio.com/en/restaurant-marketing/digital-menu/) (DACH) | Digitale Speisekarte **gratis** als Widget/Link/Button ([Integration](https://www.resmio.com/en/help/integration/)), Bestellfunktion gegen Provision/Flat | Preisanker: Karte allein ist kein bezahlbares Produkt mehr — sie ist Zubringer für die Suite |
| [DISH (Metro)](https://www.metro.de/service/digitale-loesungen) | Plattform mit KI-Website + Menüpflege, riesige Distribution über Metro | Verdrängungsrisiko im Low-End; nicht auf Event-/Angebotsprozess ausgerichtet |
| [Gastronaut.ai](https://get.gastronaut.ai/digitales-menue-gastronomie) (DACH) | Digitales Menü per QR im Reservierungs-Ökosystem | Gleiche Logik wie resmio: Karte als Modul einer Suite |
| [Yumpingo](https://yumpingo.com/product/customer-experience-management) | **Kein** Karten-Publishing — Guest-Feedback-Analytics auf Menü-Item-Ebene (heute Black Box Intelligence) | Kein direkter Wettbewerber; ehrlich aussortiert |

**Ableitung:** QR-/Web-Speisekarten sind Commodity (resmio verschenkt sie).
Keiner der Anbieter verbindet Karten-Digitalisierung mit **Angebotserstellung für
Events**. MAESTROs Differenzierung: *eine* Quelle (Katalog) speist Angebots-Builder
UND Website-Widget. Das Widget allein rechtfertigt kein Abo — als Modul im Bundle
und als Onboarding-Beschleuniger schon.

---

## D — Soll-Design

### D.1 Prinzipien (Lehren aus dem IST)

1. **Extraktion ≠ Übersetzung.** Der Parse extrahiert nur in der Quellsprache.
   Übersetzungen sind ein separater, optionaler Pass pro Zielsprache mit eigener
   Validierung (Ziel ≠ Quelle-Kopie als harter Gate, nicht als Log-Warnung).
2. **Kein Feld geht verloren.** Ein einziges zod-Schema von Parser bis DB;
   Allergene/Diät-Flags sind Pflichtdurchlauf (IST-Bug Nr. 1).
3. **Publish = unveränderlicher Snapshot,** nie destruktives Delete+Insert.
   Rollback ist ein Pointer-Flip.
4. **Kein Website-Rebuild.** Publish invalidiert einen Edge-Cache, fertig.
5. **Ein KI-Gateway, Kosten-Log pro Tenant** (Zielgruppe preissensibel; ein
   Karten-Parse muss im Cent-Bereich bleiben und sichtbar sein).

### D.2 Datenmodell (Neon, tenant-scoped, RLS auf `tenant_id`)

Verzahnung: `catalog_items` gehört zu Spec 01 (Katalog-Stammdaten) und ist die
**Single Source of Truth**. Karten referenzieren Katalog-Artikel, statt Texte zu
duplizieren.

```sql
-- Spec 01 (hier nur die vom Modul benötigten Felder):
-- catalog_items(id, tenant_id, name jsonb /* {"de": "...", "en": "..."} */,
--   description jsonb, price numeric, price_display jsonb, allergens text[],
--   diet_flags text[] /* vegetarian, vegan, ... */, archived_at, ...)

CREATE TABLE menu_imports (            -- Parse-Jobs (Onboarding-Pipeline)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  source_files jsonb NOT NULL,         -- R2-Keys, mehrere Seiten/Fotos erlaubt
  source_kind text NOT NULL CHECK (source_kind IN ('pdf','image','text','csv')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','parsing','review','committed','failed','discarded')),
  parsed_payload jsonb,                -- zod-validiertes Extraktionsergebnis
  confidence jsonb,                    -- pro Item: {price: 0.98, allergens: 0.6}
  ai_usage jsonb,                      -- model, tokens, cost_eur
  error text,
  created_by uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz
);

CREATE TABLE menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  slug text NOT NULL,                  -- URL-Teil der Hosted Page
  kind text NOT NULL DEFAULT 'standard' -- standard | lunch | drinks | seasonal
    , title jsonb NOT NULL,            -- {"de": "Speisekarte", "en": ...}
  subtitle jsonb,
  languages text[] NOT NULL DEFAULT '{de}',  -- aktivierte Sprachen je Karte
  current_version_id uuid,             -- Pointer auf veröffentlichte Version
  created_at timestamptz DEFAULT now(), updated_at timestamptz,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  title jsonb NOT NULL, description jsonb,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE menu_entries (            -- Arbeitskopie (Draft), referenziert Katalog
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  section_id uuid NOT NULL REFERENCES menu_sections(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES catalog_items(id),  -- null = Freitext-Position
  override jsonb,                      -- optionale karten-spezifische Abweichung
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE menu_versions (           -- unveränderliche Publish-Snapshots
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,             -- vollständige denormalisierte Karte
  jsonld jsonb NOT NULL,               -- vorgerendertes schema.org/Menu
  published_by uuid, published_at timestamptz DEFAULT now(),
  UNIQUE (menu_id, version)
);

CREATE TABLE widget_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  menu_id uuid NOT NULL REFERENCES menus(id),
  public_key text NOT NULL UNIQUE,     -- im Embed-Snippet, kein Geheimnis
  theme jsonb,                         -- Farben/Typo (Stitch-Tokens), Layout
  allowed_origins text[],              -- optionales Origin-Pinning
  show_prices boolean DEFAULT true, show_allergens boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

Bewusste Entscheidungen:
- **jsonb-Locale-Maps statt Spalten-Vervierfachung** (`name`, `name_en`, `name_it`,
  `name_fr` … war im IST der Treiber für Trigger-Hacks und tote Spalten).
  DE ist Pflicht, weitere Sprachen pro Karte zuschaltbar.
- `menu_entries.catalog_item_id`: Preisänderung im Katalog schlägt automatisch in
  den nächsten Karten-Publish durch — und der Angebots-Builder nutzt dieselben
  Artikel. Genau diese Verzahnung ist der interne Nutzen.
- Öffentliche Auslieferung liest **ausschließlich `menu_versions.snapshot`**
  (über Worker mit Service-Verbindung + explizitem tenant-Filter, zusätzlich RLS).

### D.3 Import-Pipeline (intern, Onboarding)

```
Upload (PDF/Fotos/Text/CSV, Drag&Drop, mehrseitig)
  → R2 (tenant-präfixiert) → menu_imports(queued) → Cloudflare Queue
  → Worker: Parse-Call (multimodal, structured output, NUR Quellsprache,
    inkl. Allergen-Kürzel, Diät-Flags, numerischer Preis + Anzeige-Preis)
  → zod-Validierung + Sanity-Checks (Preis 0,50–500 €, Duplikate, leere Sektionen)
  → status=review: Review-UI zeigt Seitenbild NEBEN extrahierten Feldern,
    Konfidenz-Flags pro Feld (niedrige Konfidenz = gelb markiert),
    Allergene mit Pflicht-Bestätigung durch den Betrieb (LMIV, s. G)
  → Commit: legt catalog_items an (oder matcht Bestehende per Fuzzy-Name)
    und baut daraus menu/sections/entries — in EINER Transaktion
  → optional: Übersetzungs-Pass je Zielsprache (separater Call, Gate:
    Ziel ≠ Quelle bei nicht-internationalen Begriffen; italienische
    Gerichtnamen bleiben erhalten — als Regel, nicht als 60-Begriffe-Liste)
```

Modellwahl: ein multimodales Modell hinter **einem** konfigurierten Gateway
(ENV pro Umgebung, kein Lovable-Lock). Start: kostengünstiges Flash-/Haiku-Niveau
mit Fallback-Eskalation auf ein stärkeres Modell, wenn Validierung scheitert
(zweiter Versuch, dann `failed` mit Klartext-Fehler). `ai_usage` wird pro Job
gespeichert und im Admin angezeigt.

### D.4 Externes Widget — Technologie ehrlich abgewogen

| Option | SEO | Ladezeit | DSGVO | Versionierung | Integration |
|---|---|---|---|---|---|
| **iFrame** | Schwach: Inhalt wird dem Host-Dokument nicht zugerechnet, Google indexiert iFrame-Inhalte separat/unzuverlässig | Eigenes Dokument, extra Roundtrips | Sehr gut (isoliert, cookie-frei machbar) | Trivial (URL) | Trivial, überall; Höhen-Resize braucht postMessage |
| **JS-Embed (DOM-Injection)** | Mittel: Inhalt landet im Host-DOM, aber nur nach JS-Rendering; Nicht-JS-Crawler (viele AI-Crawler, Bing teils) sehen nichts | Gut, wenn klein | Gut machbar | Script-URL versionieren | CSS-Kollisionen mit Host-Themes = Support-Hölle |
| **Web Component (Custom Element + Shadow DOM)** | Wie JS-Embed: Google rendert und indexiert Shadow-DOM-Inhalte, bleibt aber JS-abhängig | Gut (~15–25 kB realistisch) | Gut machbar | Script-URL versionieren | Shadow DOM kapselt Styles — löst das CSS-Problem |
| **Server-side HTML/JSON-LD auf Host-Seite** | Ideal | Ideal | Ideal | — | **Nicht machbar:** Wir kontrollieren fremde Wix/WordPress/Jimdo-Server nicht |

Keine Option allein löst alles. Daher **Hybrid aus drei Bausteinen**:

1. **Hosted Menu Page (SEO-Anker, Pflichtbestandteil):**
   `karte.maestro.app/{tenant}/{menu-slug}` (später CNAME auf Kundendomain),
   **vollständig server-gerendert** von einem Cloudflare Worker aus
   `menu_versions.snapshot` inkl. vorgerendertem `schema.org/Menu`-JSON-LD im
   HTML. Das ist die Fläche, die garantiert von jedem Crawler (auch ohne JS)
   gelesen wird, das QR-Code-Ziel und der `hasMenu`-Link fürs
   LocalBusiness/Restaurant-Markup des Kunden. Edge-gecacht, Publish purged.
2. **Web Component als primäres Embed:**
   ```html
   <script type="module" src="https://cdn.maestro.app/widget/v1/menu.js"></script>
   <maestro-menu key="pk_live_…" lang="de"></maestro-menu>
   ```
   Shadow DOM (keine Style-Kollisionen), lädt den versionierten Snapshot als JSON
   vom Edge-Cache (`stale-while-revalidate`), injiziert zusätzlich das
   JSON-LD-`<script type="application/ld+json">` in den Host-`<head>` (JS-injiziertes
   JSON-LD wird von Google verarbeitet) **plus** `<link rel="canonical">`-freundlichen
   Verweis auf die Hosted Page. Keine Cookies, kein LocalStorage, keine Fonts/Assets
   von Dritt-Hosts, keine Requests außer an `*.maestro.app` → einwilligungsfrei
   (TDDDG/DSGVO), nur AVV + Datenschutzhinweis-Baustein für den Kunden.
3. **iFrame als dokumentierter Fallback** für Baukästen, die Fremd-Scripts
   blockieren (`karte.maestro.app/...?embed=1`). Ehrlich kommuniziert: „SEO-Wirkung
   liegt dann auf unserer Hosted Page, nicht auf Ihrer Seite."

**Erwartungsmanagement SEO (ehrlich):** `schema.org/Menu` erzeugt **kein
garantiertes Rich Result**; der Nutzen ist (a) maschinenlesbare Karte für Google,
lokale Suche und AI-Crawler/Assistenten, (b) indexierbare, immer aktuelle Inhalte
statt PDF, (c) `hasMenu`-Verknüpfung im Local-Pack-Kontext. Das IST-System hat
diese Idee bereits richtig — wir machen sie server-seitig, valide (numerischer
`offers.price` — IST-Bug behoben) und pro Sprache (`inLanguage` je aktivierter
Locale, hreflang auf der Hosted Page).

**Versionierung:** Widget-Script unter `/widget/v1/` (Breaking Changes → `/v2/`,
v1 bleibt bedienbar); Inhalt versioniert über `menu_versions` — das Embed-Snippet
des Kunden ändert sich **nie**. Publish → Cache-Purge → live in Sekunden, ohne
Website-Rebuild (direkter Kontrast zum IST-`triggerGitHubDeploy`).

---

## E — Klassifikation

**Modul** (Modul-Registry gem. Playbook B10, pro Tenant schaltbar) — mit einer
bewussten Ausnahme: Der **Karten-Import (D.3) gehört zum Onboarding jedes
Tenants**, weil er den Katalog (Kern, Spec 01) befüllt und direkt auf die
Nordstern-Metrik zahlt. Zuschnitt:

- **Kern-nah, immer aktiv:** Import-Pipeline → Katalog (begrenzt, z. B. 3 Parses/
  Monat inklusive, weitere gegen Cent-Beträge — Kostentransparenz statt Paywall).
- **Modul „Speisekarten-Widget" (buchbar):** Hosted Page, Web Component, QR-Codes,
  Mehrsprachigkeit, Themes. Server-seitig erzwungen via `assertModuleEnabled
  (tenantId, 'menu_widget')`; deaktiviertes Modul liefert 404 auf Hosted Page/JSON.

Keine Oktopus-Gefahr: kein Bestell-/Payment-Flow im Widget (das ist resmio/DISH-
Territorium und ein eigenes Produkt), keine Tisch-QR-Bestellung, kein
Feedback-Modul. Karte anzeigen, Karte importieren — mehr nicht.

---

## F — Bau-Plan (inkrementell, jede Stufe einzeln abnehmbar)

1. **F1 Datenmodell + RLS:** Tabellen aus D.2 (ohne widget_configs), RLS-Tests
   Tenant-Isolation, Modul-Flag `menu_widget` registrieren.
2. **F2 Import-Pipeline:** Upload → R2 → Queue → Parse-Worker (ein Gateway,
   structured output, nur Quellsprache) → zod + Sanity-Gates → `menu_imports`
   mit Status/Konfidenz/`ai_usage`.
3. **F3 Review-UI + Katalog-Commit:** Seitenbild-neben-Feldern-Review,
   Allergen-Bestätigung, transaktionaler Commit in `catalog_items` +
   `menus/sections/entries`; Fuzzy-Match gegen bestehende Katalog-Artikel.
   **Messung ab hier:** Zeit Upload→Commit im Onboarding-Funnel tracken.
4. **F4 Publish + Hosted Page:** `menu_versions`-Snapshot inkl. JSON-LD-Rendering,
   SSR-Worker `karte.maestro.app`, Edge-Cache + Purge-on-Publish, hreflang.
5. **F5 Web Component:** `/widget/v1/menu.js`, Shadow DOM, JSON-LD-Injection,
   Theme-Tokens (Stitch), Embed-Snippet-Generator im Admin, iFrame-Fallback,
   Doku-Seite mit WordPress/Wix/Jimdo-Anleitungen.
6. **F6 Übersetzungs-Pass (optional pro Karte):** separater Worker-Call je
   Zielsprache, Kopie-Gate, Review vor Aktivierung der Sprache.
7. **F7 Politur:** QR-Code-Generator (Ziel: Hosted Page), Angebots-Builder-
   Verzahnung sichtbar machen („12 Artikel aus Karten-Import verfügbar"),
   Kosten-Dashboard `ai_usage` pro Tenant.

Explizit **nicht** portieren aus dem IST: Ein-Schuss-4-Sprachen-Prompt,
DE-Kopier-Trigger, Delete+Insert-Publish, GitHub-Deploy-Kopplung,
Spalten-pro-Sprache-Schema, hartkodierte Secrets, cleanup-Reparatur-Function.

---

## G — Risiken & Gegenmaßnahmen

| Risiko | Einschätzung | Gegenmaßnahme |
|---|---|---|
| **Halluzinierte Preise/Items** beim Parse | Real (IST brauchte cleanup-Function + fix-prices-Tool) | Review-Schritt ist Pflicht, kein Auto-Publish; numerische Sanity-Gates; Seitenbild neben Extraktion; Konfidenz-Flags; Eskalations-Retry mit stärkerem Modell |
| **LMIV-Haftung Allergene** (KI extrahiert falsch/unvollständig) | Hoch — rechtlich beim Betrieb, reputativ bei uns | Allergene nie stillschweigend übernehmen: expliziter Bestätigungs-Schritt je Sektion im Review („vom Betrieb geprüft" + Zeitstempel); Disclaimer in AGB; Widget zeigt Allergene nur nach Bestätigung |
| **DSGVO/TDDDG des Widgets** auf fremden Websites | Mittel | Keine Cookies/Storage, keine Dritt-Requests, IP-Verarbeitung nur zur Auslieferung (Art. 6 (1) f); AVV + fertiger Datenschutz-Textbaustein für den Kunden; kein Tracking im v1 (Aufrufzahlen nur aggregiert aus Edge-Logs) |
| **Script-Blocking durch Baukästen** | Sicher bei einigen (z. B. restriktive Wix-Pläne) | iFrame-Fallback + Hosted Page als immer funktionierender Weg; Doku je Baukasten |
| **SEO-Erwartung überverkauft** („Google zeigt meine Karte!") | Mittel | Ehrliches Marketing: indexierbare Karte + strukturierte Daten, kein Rich-Result-Versprechen; Hosted Page als messbarer Indexierungs-Nachweis (GSC) |
| **KI-Kosten laufen weg** (preissensible Zielgruppe) | Niedrig bei Flash-Klasse, aber sichtbar machen | `ai_usage` pro Job/Tenant, Inklusiv-Kontingent + transparente Cent-Preise; Kill-Switch pro Tenant |
| **Widget-API-Bruch** legt Kundenwebsites lahm | Mittel, Support-teuer | Versionierter Script-Pfad `/v1/`, Snapshot-Format als stabiler Vertrag, Canary-Tenant vor Rollouts |
| **Katalog-Drift** (Karte vs. Angebots-Builder divergieren) | Mittel | `menu_entries` referenzieren `catalog_items` (keine Textkopien); Override nur als bewusste Ausnahme mit UI-Kennzeichnung |
| **Fuzzy-Match legt Duplikate im Katalog an** | Mittel | Match-Vorschau im Review („existiert bereits als …"), Mensch entscheidet; Duplikat-Report im Katalog |

---

## H — Akzeptanzkriterien

**Import (intern):**
1. 3-seitiges Speisekarten-PDF (~60 Positionen) → geprüfter, committeter Katalog
   in **≤ 10 Minuten** Gesamtzeit (Upload bis Commit), davon Parse ≤ 90 s.
2. ≥ 95 % der Preise numerisch korrekt vor Review (gemessen an 5 realen
   DACH-Karten inkl. der Storia-Karte als Regressionsfall); kein Preis und kein
   Allergen-Kürzel verbleibt im Beschreibungstext.
3. `allergens` und `diet_flags` überleben die gesamte Pipeline bis in
   `catalog_items` (Regressionstest gegen IST-Bug MenuUploader/handlePublish).
4. Abbruch mitten im Commit hinterlässt **keinen** Teilzustand (eine Transaktion);
   öffentlich sichtbare Karte bleibt während des gesamten Vorgangs unverändert.
5. Fehlerhafter Parse endet als `failed` mit verständlicher Meldung —
   nie mit leerem Katalog-Commit.
6. Importierte Artikel sind unmittelbar im Angebots-Builder-DishPicker auffindbar.

**Publish & Widget (extern):**
7. Publish → neue Version auf Hosted Page **und** im Widget in ≤ 60 s,
   ohne Deploy/Build irgendeiner Website; Rollback auf Vorversion in ≤ 60 s.
8. Hosted Page liefert vollständiges HTML + valides JSON-LD **ohne JavaScript**
   (curl-Test); JSON-LD besteht Schema-Validierung, `offers.price` ist immer
   numerisch (Regressionstest gegen IST-Bug MenuStructuredData).
9. Web Component rendert auf WordPress-, Wix- und Jimdo-Testseite ohne
   CSS-Kollision; Netzwerk-Panel zeigt ausschließlich Requests an
   `*.maestro.app`; keine Cookies/kein Storage (automatisierter Check).
10. Widget-Bundle ≤ 30 kB gzipped; Embed verschlechtert LCP der Host-Seite um
    < 200 ms (Lab-Messung).
11. Tenant-Isolation: Snapshot/JSON von Tenant A ist unter keinem public_key/Slug
    von Tenant B abrufbar (RLS- + Worker-Test); deaktiviertes Modul `menu_widget`
    → Hosted Page/JSON/Widget-Load liefern 404, serverseitig erzwungen.
12. Mehrsprachigkeit: Sprache erst öffentlich nach bestätigtem Übersetzungs-Review;
    automatisierter Gate-Test weist Quellsprachen-Kopien als Übersetzung ab;
    hreflang-Paare auf der Hosted Page konsistent.
13. Kosten: `ai_usage` je Import im Admin sichtbar; Parse einer Standardkarte
    kostet nachweislich < 0,50 € (Log-Auswertung über 10 Testkarten).
