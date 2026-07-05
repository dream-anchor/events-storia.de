# Angebots-Builder

Modul-Spec MAESTRO · Stand 2026-07-05 · Status: entscheidungsreif
Scope: Optionen A–E, Menü nach Tagen/Gängen, Positionen mit Menge/EP/MwSt je
Zeile (Satzliste des Mandanten inkl. 0 %), Rabatt, pro-Kopf vs. pauschal,
Preis-Override, Equipment/Personal je Option, Sprache DE/EN.

## A — IST im Alt-System (mit Evidenz)

Inventar (docs/MAESTRO-FEATURE-INVENTAR.md, „Angebot (Editor)" / „Angebot
(Anfrage-Editor)"): 5 Optionen (A–E) mit 5 Modi · Menü-Editor mit Gängen +
Mehrtages-Support (DayTabs) · Getränke-Sektion mit 4 Modi · Equipment &
Personal je Option · Preislogik pro Person/pauschal, Rabatt (%/€),
Preis-Override · MwSt 7/19 aus Menü-Auswahl · Restaurant-Menü-Import ·
Freitext-Import (KI) + Red-Team-Validierung · KI-Menüvorschlag ·
Paketname-Override · Option duplizieren/zurücksetzen.

Der Alt-Builder (~11.000 Zeilen in `src/components/admin/refine/InquiryEditor/
OfferBuilder/`) ist auf einem JSONB-Blob (`menu_selection`) mit drei
Struktur-Generationen gebaut. Nachweislich problematisch:

1. **Doppeldeutiges Preisfeld** — `pricingMode.ts` (Z. 18–20) dokumentiert selbst:
   „Das Feld heisst zwar budgetPerPerson, wird aber im per_event-Modus als
   Gesamtbetrag gelesen. Ein einziges Feld, zwei Interpretationen."
2. **Geld-Bug in Produktion** — `supabase/functions/repair-quotation-pricing/`
   existiert nur, weil per_event-Preise „fälschlich mit guestCount multipliziert"
   wurden → Faktor-N-Falschbeträge in echten LexOffice-Angeboten.
3. **Menge im Namen vergraben** — `pricingMode.ts: parseQuantityPrefix()` parst
   `"11 x Salat"` per Regex aus `itemName`; `detectPricingMode` rät den
   Preismodus per Regex — Heuristik statt Datenmodell.
4. **Dreifache Quelle der Wahrheit im Menü** — `types.ts` (Z. 217–224): `days[]`
   ist Wahrheit, `courses[]` wird „als Legacy-Feld gemirrort", dazu
   `freeformProgram` als dritte Parallelstruktur mit eigener Steuerlogik;
   `useOfferBuilder.ts` (Z. 499–533) migriert Legacy-Freeform on-the-fly.
5. **MwSt rückwärts geraten statt gerechnet** — `PriceBreakdown.tsx` (Z. 323–354):
   USt proportional aus Brutto-„Buckets" auf einen überschreibbaren Endpreis
   zurückgerechnet; ein „Defensive Guard" blendet die USt bei „numerischer
   Drift" aus. Steuerausweis darf nie eine Heuristik mit Silent-Fail sein.
6. **Float-Euros statt Cents** — `total_amount NUMERIC(10,2)` (Migration
   20260129000816), Einzelpreise als JS-`number` in Euro; verstößt gegen die
   MAESTRO-Leitplanke „Geld immer in Integer-Cents".
7. **Preislogik dreifach implementiert** — Client (`useOfferBuilder.ts`),
   Anzeige (`PriceBreakdown.tsx`) und Edge Function rechnen jeweils selbst;
   `totalAmount` wird persistiert statt abgeleitet → Drift strukturell möglich.

Neubau-Stand (`/home/user/maestro-cloud`): `offer_options` (tenant-RLS, Cents,
Label, Version, isChosen) + `offer_history`-Snapshots + Send-Endpoint mit
Public-Token sind live verifiziert. Der Builder (`apps/web/src/pages/builder.tsx`)
kann nur Titel/Beschreibung/Freitext-Positionen **ohne Preise** — der Gesamt-
betrag wird als Euro-Text eingetippt. Diese `menu_selection`-JSONB wird abgelöst.

## B — Der eigentliche Job (Jobs-to-be-done)

**Job:** „Baue mir in unter 5 Minuten aus Anfrage + Katalog ein preislich
korrektes, versandfertiges Angebot mit 1–3 wählbaren Varianten — egal ob
2er-Geburtstag, 3-Tages-Catering oder Exklusiv-Buchung — und garantiere, dass
Kunde, LexOffice und Stripe exakt dieselben Zahlen sehen." Der Builder ist der
Hebel der Nordstern-Metrik „Anfrage-Eingang → Angebot versendet".

**Gestrichen / zusammengelegt (mit Begründung):**
- **5 Angebots-Modi → 1 Positionsmodell.** „Paket", „Restaurant-Menü-Import" und
  „Freitext-Import" sind *Befüllungswege*, die dieselben Positionen erzeugen;
  der Modus-Zoo existierte nur, weil das Datenmodell pro Weg anders war.
- **„Nur-E-Mail"-Modus gestrichen.** Antwort ohne Angebot gehört in den
  Nachrichten-Flow (Modul Inbox), nicht als leere Angebotsoption.
- **FreeformProgram-Parallelstruktur gestrichen.** Der KI-Parser schreibt direkt
  Positionen (Tag/Sektion/Menge/EP/MwSt); keine zweite Hierarchie.
- **Red-Team-Validierung (Zweitmodell GPT-5) gestrichen.** Die Engine rechnet
  deterministisch; der Parser liefert Positionen + Textsumme. Weil der Summen-
  Check nur Endsummen-Fehler fängt (vertauschte Preise oder falsch geratene
  USt-Sätze passieren ihn bei gleichem Brutto), ersetzen ihn deterministische
  Maßnahmen: Quelltext-Diff im Draft-Review, USt-Plausibilitätsregeln
  (KI-Punkt 3), definiertes Verhalten bei nicht parsebarem Text (s. API, AC8).
- **pricingMode auf Optionsebene + budgetPerPerson gestrichen.** Preismodus wird
  Zeileneigenschaft (`per_person`|`per_unit`|`flat`); Options-Gesamtpreis ist
  immer Summe der Zeilen; Override wird explizite Anpassungszeile (s. D).
- **Getränke-4-Modi zusammengelegt.** Pauschale = Flat-Zeile, Weinbegleitung =
  per-Person-Zeile, Einzelgetränke = Zeilen in Sektion „Getränke".
- **Paketname-Override gestrichen** — Optionstitel ist freies Snapshot-Feld.
- **Angebots-Sprachen IT/FR gestrichen** — Produktsprachen DE + EN; die DE/EN-
  Wahl wird pro Angebot persistiert (`offer_language`, s. D).
- **Storia-Spezifika raus aus dem Kern:** Ristorante-Menü-Import-Heuristik,
  eSignatures.com-Kostenübernahme (eigenes Modul), Katalog „Catering+Ristorante
  kombiniert" (wird generischer Mandanten-Katalog, eigene Spec).

## C — Benchmark 2026

Table Stakes (Digest): interaktives Web-Angebot mit Branding statt PDF, mehrere
Varianten, Annahme + Anzahlung online, BEO aus dem Angebot, KI-Entwurf in
Sekunden (Event Temple, iVvy/hivr.ai, Perfect Venue „AI Reply", Univents ab
46 €), Angebots-Gültigkeit mit Auto-Expire (Tripleseat, Perfect Venue,
LexOffice `expirationDate`), kundenwählbare Add-ons als Upsell. Eventmachine
belegt den Ziel-Takt < 5 Min statt 45+; Tripleseat „Live Documents" setzt den
Standard: Angebot als lebendes Web-Dokument.

**Wo wir mindestens gleichziehen:** Positionsbasierte Optionen mit Varianten,
KI-Befüllung (Vorschlag → Mensch bestätigt), Katalog-Picker, Duplizieren,
Live-Summen, `valid_until` + Nachfass, optionale Add-ons, mobile Bedienbarkeit.
Echtzeit-Co-Editing bewusst Later — MVP-Messlatte ist Optimistic Locking ohne
stillen Datenverlust (s. D, API).

**Wo wir bewusst schlagen (DACH-Lücke, keiner der Genannten hat es):**
1. **Steuer-exakte Cents-Engine** — per-Zeile-MwSt aus der Satzliste des
   Mandanten (DE 7/19, AT 10/20, CH 2.6/8.1, jeweils inkl. 0 % für §19-UStG-
   Kleinunternehmer, Gutscheine, durchlaufende Posten); eine Server-Engine für
   UI, Public-Offer, LexOffice, Stripe. US-Tools kennen keine USt-Aufteilung.
2. **Spektrum in einem Modell** — 0 Positionen (2er-Reservierungsbestätigung)
   bis 200 Positionen über 5 Tage (Exklusiv-Buchung inkl. Mindestumsatz-
   Ausweis) — belegt durch AC12.
3. **Nordstern eingebaut** — Primär-KPI „Minuten von Anfrage-Eingang bis
   Angebot versendet" (`inquiry.created_at` → `offer_sent_at`); die Builder-
   Stempel `first_opened_at`→`sent_at` messen zusätzlich die Sekundärmetrik
   „Bauzeit". Beides im Dashboard benchmarkt; kein Wettbewerber zeigt das.

## D — Soll-Design (Neubau)

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)
1. Einstieg aus Anfrage/Event: Kontext-Leiste (Kunde, Datum, Gäste, Anlass,
   Budget, Sprache DE/EN, gültig bis) — nichts zweimal eintippen.
2. Start-Wahl als 3 Kacheln: **KI-Vorschlag**, **Vorlage/Paket**, **Leer
   beginnen**. KI erzeugt 1–3 Options-Entwürfe mit Badge „KI-Entwurf —
   prüfen"; nichts wird ohne Bestätigung persistiert.
3. Optionen A–E als Karten-Tabs (Default 1, empfohlen max 3; Duplizieren). Pro
   Option: Titel, Gästezahl (Default vom Event), Positionsliste, optional
   Mindestumsatz (Exklusiv-Buchung).
4. Positionsliste nach Sektionen (Menü/Getränke/Equipment/Personal/Sonstiges);
   Menü optional nach Gängen. Zeile = Menge × Einheit × EP (brutto) ×
   Preismodus-Chip (`/Pers.`|`/Stück`|`pauschal`) × MwSt-Chip (Chips generiert
   aus der Satzliste des Mandanten inkl. 0 %). Katalog-Picker mit Suche +
   Freitext-Zeile; Katalogpreis als Snapshot, Abweichung = Override-Badge.
5. Mehrtägig per progressive disclosure: „+ Tag" erzeugt Tages-Tabs
   (persistiert als `offer_option_days`: Label z. B. „Mo 29.06. Lunch", Datum,
   eigene Gästezahl); eintägig bleibt die Tab-Leiste unsichtbar.
6. Summenpanel (Desktop rechts, mobil Sticky-Bottom-Sheet): Zwischensumme,
   Rabatt (%/€, nur rabattierbare Zeilen), ggf. Anpassungszeile, Endpreis
   gesamt + pro Person (beides immer), USt-Ausweis je Satz, ggf.
   Mindestumsatz-Hinweis — live vom Server gerechnet.
7. Preis-Override: Feld „Zielpreis" — Differenz wird explizite Position
   „Preisanpassung" (sichtbar, auditierbar, LexOffice-exakt, kein Skalierungs-
   faktor). Lebenszyklus: statische Zeile, der Zielpreis wird nicht
   re-enforced; weicht der Endpreis nach späteren Änderungen ab ⇒ Inline-
   Hinweis „Endpreis weicht vom zuletzt gesetzten Zielpreis ab" mit 1-Klick-
   Neuberechnung. Keine stille Nachführung.
8. Autosave (Debounce ~1 s, Upsert mit `items_version`, s. API) mit Statuschip;
   Versionskonflikt ⇒ Dialog „neu laden / mergen" statt stillem Überschreiben.
   Inline-Hinweise: Zeile ohne Preis, Summe ≠ Importtext, Katalog-Abweichung,
   unplausibler USt-Satz.
9. Weiter zu „Vorschau & Senden" (Modul 03): Snapshot, Versand, `sent_at`.

### Datenmodell (Neon Postgres, alle Beträge Integer-Cents, Brutto)
Event (Angebots-Kopf) — Änderungen:
```
+ offer_language text not null default 'de'  -- 'de'|'en'; Vorbelegung aus Anfrage-Erkennung (KI)
+ offer_valid_until date null                -- Renderer zeigt es; Auto-Expire/Nachfass in Modul 03
```
`offer_options` (existiert) — Änderungen:
```
+ title text                          -- ersetzt packageNameSnapshot-Override
+ discount_percent_bp integer null    -- 2500 = 25 %; CHECK between 0 and 10000
+ discount_amount_cents integer null  -- CHECK >= 0; CHECK: höchstens eins von beiden gesetzt
+ minimum_spend_cents integer null    -- Mindestumsatz: Anzeige + Warn-Flag wenn Endpreis < Minimum; KEINE Auto-Zeile
+ items_version integer not null default 0   -- Optimistic Locking (s. API)
+ subtotal_cents · discount_cents · adjustment_cents  integer not null default 0  -- Server-gerechnet
  amount_total_cents                  -- bleibt; wird NUR von der Engine geschrieben
+ vat_breakdown jsonb                 -- [{rate_bp, net_cents, vat_cents, gross_cents}]
+ unique index (id, tenant_id)        -- Ziel der Composite-FKs (s. u.)
- menu_selection                      -- deprecated, nach Migration entfernen
```
`offer_option_days` (NEU — Ort der Tages-Gästezahl):
```
id uuid pk · tenant_id uuid not null → tenants (RLS wie offer_items)
option_id uuid not null · day_no smallint not null · label text · date date null
guest_count integer not null · unique (option_id, day_no)
(option_id, tenant_id) → offer_options(id, tenant_id) on delete cascade
```
`offer_items` (NEU):
```
id uuid pk                              -- client-generiert, stabil über Autosaves (s. API)
tenant_id uuid not null → tenants       -- RLS wie offer_options: crudPolicy tenantIsMember, FORCE RLS
option_id uuid not null                 -- Composite-FK (option_id, tenant_id) →
                                        --   offer_options(id, tenant_id) on delete cascade.
                                        --   Einfache FKs laufen als Owner und umgehen RLS —
                                        --   nur so sind Cross-Tenant-Referenzen ausgeschlossen
day_no smallint null                    -- (option_id, day_no) → offer_option_days;
                                        --   null = kein Tagesbezug ⇒ guest_count der Option gilt
section text not null default 'menu'    -- 'menu'|'drinks'|'equipment'|'staff'|'other'|'adjustment';
                                        --   unique partial index (option_id) where section='adjustment'
course_label text null                  -- z. B. 'Antipasto', frei
catalog_item_id uuid null               -- (catalog_item_id, tenant_id) → Katalog, gleiches Composite-
                                        --   Muster; Snapshot bleibt gültig ohne FK-Zwang
name text not null · description text
qty_milli integer not null default 1000 -- Menge in Tausendsteln (330 = 0,33); UI zeigt Dezimal, API Ganzzahl
unit text default 'Stück' · unit_price_cents integer not null   -- Brutto-EP
catalog_price_cents integer null        -- Snapshot; ≠ unit_price ⇒ Override-Badge
price_mode text not null default 'per_person'   -- 'per_person'|'per_unit'|'flat'
vat_rate_bp integer not null            -- CHECK >= 0; API validiert gegen Satzliste aus tenant_settings
is_optional boolean not null default false   -- Add-on, auf Public-Seite an-/abwählbar; Persistenz: Modul 03
discountable boolean not null default true   -- Equipment/Personal default false
sort_order integer not null default 0
index (tenant_id, option_id) · check price_mode/section
```
**Engine (`packages/pricing`, deterministisch, niemals Float):** Signatur nimmt
Items, Rabatt/Anpassung und eine Map `day_no → guest_count` (aus
`offer_option_days`; `day_no = null` ⇒ `guest_count` der Option).
1. Zeilentotal `per_person: qty×EP×Gäste(day_no) · per_unit: qty×EP · flat: EP`;
   qty rechnet als skalierte Ganzzahl (`qty_milli`, ÷1000 erst nach der
   Multiplikation); Rundung pro Zeile auf Cent. Kein IEEE-754 im Geldpfad.
2. Operationsreihenfolge fix: Zwischensumme → Rabatt (nur discountable-Zeilen)
   → Preisanpassung → Endpreis. Summe = Summe der Zeilen.
3. Rabatt/Anpassung werden je USt-Bucket **aggregiert** proportional verteilt;
   Rest-Cents per Largest-Remainder; Bucket-Reihenfolge deterministisch
   (Restanteil absteigend, bei Gleichstand rate_bp aufsteigend) — cent-exakter
   LexOffice-Abgleich per Golden-Test.
4. Anpassung auf einer Option ohne Positionen (kein Split-Bucket): die Zeile
   erhält den Standardsatz des Mandanten (tenant_settings).
5. USt je Satz aus Brutto: `vat = gross − round(gross/(1+rate))`, exakt gleiche
   Formel im LexOffice-Export. Kleinunternehmer-Modus (§19 UStG): alle Zeilen
   0 bp, Renderer + Export tragen den Pflichthinweis.

Alt-Migration (Storia): einmaliges ETL-Skript `menu_selection` (courses/days/
freeform/drinksEinzeln/equipment/staff, `parseQuantityPrefix`-Fälle) →
`offer_items` + `offer_option_days`, inkl. Konvertierung der `optionsSnapshot`-
JSONBs in `offer_history` ins Items-Format (s. G3), mit Abweichungsreport.

### API (Hono-Worker; bestehende offers.ts erweitert)
- `GET /api/events/:id/offers` — inkl. Items + Tage (join, ein Roundtrip).
- `POST /api/events/:id/offers` · `PATCH /api/offers/:id` — Kopf-Felder (inkl.
  `offer_language`, `offer_valid_until`, `minimum_spend_cents`); Totals
  read-only (Server rechnet); Rabatt nur als konsistentes Paar (Prozent XOR Betrag).
- `PUT /api/offers/:id/items` — transaktionaler **Upsert** statt Delete+Recreate:
  client-generierte Item-UUIDs, `insert … on conflict update`, nicht mitgesendete
  IDs löschen — IDs bleiben stabil für Audit-Diffs, BEO-/Dokument-Referenzen und
  Anpassungszeile. `If-Match: <items_version>` Pflicht; Konflikt ⇒ 409 + Server-
  Stand (UI: neu laden/mergen, s. UX 8). Server validiert (USt-Satzliste,
  Rabatt-Paar), rechnet Engine, inkrementiert `items_version`, gibt Breakdown
  zurück; Tage analog im selben Payload. Delta-Payloads für große Optionen und
  Echtzeit-Presence/Co-Editing: bewusst Later (dokumentierte Entscheidung).
- `POST /api/offers/:id/duplicate` — Option inkl. Items + Tagen kopieren.
- `POST /api/offers/:id/set-target-price {target_cents}` — erzeugt/aktualisiert
  die Anpassungszeile, identifiziert über `section='adjustment'` + Unique-
  Constraint (max. 1 pro Option); statisch, kein Re-Enforce (s. UX 7).
- `POST /api/events/:id/offers/ai-suggest` — Draft-Payload, kein DB-Write.
- `POST /api/events/:id/offers/parse-freeform {text}` — Items-Draft +
  `totals_from_text` für den deterministischen Summen-Check; Draft-Review zeigt
  Diff Zeile ↔ Quelltext-Fundstelle; nicht parsebarer Text ⇒ leerer Draft +
  Meldung, kein Halluzinieren.
- Pricing-Engine als pures Paket `packages/pricing` (Worker + Web importieren
  dieselbe Funktion; Web nur optimistische Anzeige, Server ist autoritativ).

### Automatisierungen (Cron/Queue)
- Nordstern-Messstrecke: Primär-KPI `inquiry.created_at` → `offer_sent_at`
  („Minuten bis Angebot"); Builder stempelt zusätzlich `offer_first_opened_at`
  → Sekundärmetrik „Bauzeit" (`sent_at − first_opened_at`).
- Queue-Job „Angebot hängt": Anfrage > 4 h ohne versendetes Angebot — Trigger
  ab Anfrage-Eingang, nicht ab Entwurfs-Erstellung (sonst feuert er nie für
  liegengebliebene Anfragen ohne Entwurf) → Push/Badge (PWA), konfigurierbar.
- Nightly-Konsistenzcheck: Engine-Recompute vs. gespeicherte Totals; Drift ⇒
  Alert (nie wieder ein „repair-quotation-pricing").

### KI-Punkte (Input → Vorschlag → Bestätigung)
1. **Options-Vorschlag:** Anfragetext + Katalog + Anlass/Budget → 1–3 Optionen
   (Low/Mid/High) als Draft mit Begründung; erkennt zudem die Angebotssprache
   (DE/EN) aus der Anfrage und belegt `offer_language` vor.
2. **Freitext/PDF-Import:** Alt-Angebote/Word-Vorlagen → Items-Draft; Preise
   1:1, deterministischer Endsummen-Abgleich + Quelltext-Diff statt Zweitmodell.
3. **Preis- & USt-Sanity (deterministisch):** Warn-Chip bei EP-Abweichung > x %
   vom Katalog-Snapshot, ungewöhnlichem Pro-Kopf-Preis fürs Segment und
   unplausiblen USt-Sätzen (z. B. Sektion `drinks` + 700 bp). Nur Hinweis,
   nie Auto-Änderung.

### Integrations-Berührungen
- **LexOffice:** `offer_items` mappen 1:1 auf Quotation-Line-Items (per-Zeile
  MwSt, Rabatt/Anpassung als eigene Zeilen, `expirationDate` aus
  `offer_valid_until`, §19-Pflichthinweis im Kleinunternehmer-Modus, Labels
  nach `offer_language`) — Parität per Golden-Tests.
- **Stripe Connect:** Anzahlung = Prozent/Betrag vom `amount_total_cents` der
  gewählten Option (Modul Zahlungen).
- **Katalog-Modul (Spec 0x):** Picker liest Katalog; Items bleiben Snapshot-fest.
- **Public-Offer/BEO:** rendern ausschließlich aus `offer_items` + Breakdown
  (Alt-History-Snapshots werden per ETL konvertiert, s. G3); Sektions-/Summen-
  Labels lokalisiert nach `offer_language`, Positionsnamen bleiben Freitext in
  Kundensprache; `valid_until` sichtbar; `is_optional`-Add-ons an-/abwählbar,
  Auswahl-Persistenz bei Annahme in Modul 03.

## E — Klassifikation

**Kern.** Der Builder ist der Kern des Abschluss-Flows (Nordstern) und nicht
abschaltbar. Innerhalb des Kerns per Registry (B10) zuschaltbar: Mehrtages-Tabs
(nur Catering-Mandanten), Equipment/Personal-Sektionen, KI-Freitext-Import,
Kleinunternehmer-Modus. **Backlog (bewusst Later):** Echtzeit-Presence/
Co-Editing, Delta-Payloads, Live-Neuberechnung der Add-ons auf der Public-Seite.
**Storia-only (nicht in den Kern):** Ristorante-Menü-Import-Heuristik,
IT/FR-Übersetzungen, eSignatures.com-Kostenübernahme, kombinierter
Catering+Ristorante-Katalog. Kriterium: brauchen < 30 % der Zielmandanten es
am Tag 1? Nein ⇒ Registry-Modul oder Storia-Fork.

## F — Bau-Plan

| # | Schritt | Abhängig von | Aufwand | Neu |
|---|---------|--------------|---------|-----|
| 1 | `packages/pricing`: Engine (Cents, qty_milli-Ganzzahl-Arithmetik, Zeilenmodi, MwSt-bp inkl. 0, Rabatt/Anpassung mit Largest-Remainder, leerer-Option-Fall) + Property-Tests (Mengen 0,1/0,33/0,07; gemischte Sätze; Rest-Cent-Verteilung) + Golden-Tests | — | M | Paket |
| 2 | Migration: `offer_items` + `offer_option_days` + Kopf-/Rabatt-/Versions-Felder, Composite-FKs, RLS + FORCE, Indexe | 1 | S | Tabellen |
| 3 | API: Items-Upsert-PUT mit If-Match/409 + Recompute, days, duplicate, set-target-price; Totals read-only | 1,2 | M | Endpunkte |
| 4 | Web: Positions-Editor (Sektionen, Zeilen, Chips aus Satzliste, Summenpanel, Autosave + Konflikt-Dialog, mobil) | 3 | XL | UI |
| 5 | Tages-Tabs (progressive disclosure) + Gästezahl je Tag (`offer_option_days`) | 4 | M | UI |
| 6 | Katalog-Picker (gegen Katalog-Modul; interimistisch Freitext) | 4, Katalog-Spec | M | UI |
| 7 | Public-Offer-Seite + Send-Snapshot auf Items/Breakdown umstellen (inkl. DE/EN-Labels, valid_until, Add-ons) | 3 | M | Renderer |
| 8 | LexOffice-Export-Mapping (inkl. §19, expirationDate) + Paritäts-Golden-Tests | 1,3 | M | Adapter |
| 9 | KI: ai-suggest + parse-freeform (Quelltext-Diff, USt-Plausibilität), Draft-UX | 3,4 | L | Endpunkte |
| 10 | Nordstern-Messstrecke (ab Anfrage-Eingang) + „Angebot hängt"-Queue + Nightly-Konsistenzcheck | 3 | S | Cron/Queue |
| 11 | Storia-ETL `menu_selection` → `offer_items`/`offer_option_days` inkl. `offer_history`-Snapshots, mit Abweichungsreport | 2 | M | Skript |

Reihenfolge 1→4 ist der kritische Pfad; 5–11 parallelisierbar.

## G — Risiken & Lösungen (Top 3)

1. **Rundungs-/Steuer-Drift zu LexOffice** (Alt-System hatte reale Geld-Bugs).
   → Eine Engine, Integer-Cents + Ganzzahl-Mengen, festgeschriebene Largest-
   Remainder-Verteilung, identische Brutto-USt-Formel im Export, Golden-Tests
   gegen echte LexOffice-Responses, Nightly-Recompute-Alert.
2. **Komplexitäts-Rückfall:** Das Positionsmodell könnte zur zweiten
   10.000-Zeilen-UI wuchern. → Hartes UX-Budget: 1 Zeilentyp, 3 Preismodi,
   progressive disclosure für Tage/Sektionen; jede neue Zeileneigenschaft
   braucht einen Job-Beleg. „2er-Reservierung in < 60 s" als ständiger Testfall.
3. **Storia-Migration der JSONB-Varianten** (courses/days-Mirror, freeform,
   Mengen im Namen). → ETL mit Abweichungsreport pro Angebot. Entscheidung:
   Auch die `optionsSnapshot`-JSONBs in `offer_history` werden ins Items-Format
   konvertiert — kein eingefrorener Legacy-Renderer nötig, „rendern
   ausschließlich aus offer_items" (D) bleibt wahr. Nur offene Vorgänge werden
   aktiv migriert; abgeschlossene bleiben Archiv, im neuen Format lesbar.

## H — Akzeptanzkriterien

1. Nordstern-Messstrecke: Für ein Test-Fixture (Anfrage mit `created_at`) gilt
   KPI = `offer_sent_at − inquiry.created_at`; `sent_at` stempelt Modul 03
   (Abhängigkeit ausgewiesen). Sekundär „Bauzeit" = `sent_at − first_opened_at`.
   Ziel-Demo: KI-Vorschlag → 2-Options-Angebot, korrekte Summen, < 5 Min Bauzeit.
2. 2er-Reservierungsbestätigung ohne Positionen: Checkliste „Option anlegen →
   Titel setzen → ‚Vorschau & Senden' erreichen" in unter 60 Sekunden.
3. Jede Position trägt Menge (`qty_milli`), Einheit, Brutto-EP in Cents,
   Preismodus und MwSt-Satz; `amount_total_cents` ist ausschließlich server-
   gerechnet — ein direkter PATCH auf Totals wird abgelehnt.
4. per_person-, per_unit- und flat-Zeilen ergeben bei Gästezahl-Änderung
   deterministisch neue Summen; kein Feld wird kontextabhängig uminterpretiert;
   Mengen 0,1/0,33/0,07 rechnen cent-exakt (Property-Test, kein Float).
5. Preis-Override erzeugt eine sichtbare, persistierte Anpassungszeile;
   Summe(gross je USt-Satz) == Endpreis, vat je Satz exakt nach Formel;
   Drift ⇒ Fehler, niemals Ausblenden (kein Silent-Fail).
6. Rabatt (%/€) wirkt nur auf `discountable`-Zeilen; USt-Split über gemischte
   Sätze per Largest-Remainder (Testfall: 10 % Rabatt über 7 %- + 19 %-Zeilen);
   LexOffice-Export == Builder-Betrag auf den Cent (Golden-Test).
7. Ein 3-Tages-Programm mit tagesweise abweichender Gästezahl
   (`offer_option_days`) rechnet pro Tag korrekt; eine per_person-Zeile mit
   `day_no = null` nutzt die Options-Gästezahl.
8. KI-Entwürfe schreiben nie ohne explizite Bestätigung in die DB;
   parse-freeform zeigt Differenz zur Textsumme, markiert unplausibel
   zugeordnete USt-Sätze im Draft und liefert bei nicht parsebarem Text einen
   leeren Draft + Meldung (kein Halluzinieren).
9. RLS: Mandant A kann `offer_items` von Mandant B weder lesen noch schreiben;
   ein Item mit eigenem `tenant_id`, aber fremder `option_id` (oder
   `catalog_item_id`) wird per Composite-FK abgelehnt (automatisierter
   Isolationstest, hartes Gate).
10. Builder auf 390 px voll bedienbar — Checkliste: Zeile anlegen, Preis
    ändern, Summen-Sheet öffnen, Senden erreichbar — je ohne horizontales
    Scrollen (PWA-Smoke-Test).
11. Konkurrenz: Zwei parallele Editoren (bzw. ein staler Offline-Tab) verlieren
    keine Zeilen unbemerkt — Save mit veralteter `items_version` ⇒ 409 +
    Konflikt-Dialog; Item-IDs bleiben über Autosaves stabil.
12. 200-Positionen-Option über 5 Tage: Server-Recompute < 500 ms, Builder
    bleibt bedienbar, Golden-Test rechnet cent-exakt.
13. EN-Angebot (`offer_language='en'`): Public-Seite und LexOffice-Dokument
    vollständig auf Englisch (Sektions- und Summen-Labels).
14. Kleinunternehmer-Mandant (§19 UStG): alle Zeilen 0 bp; Renderer und
    LexOffice-Export tragen den Pflichthinweis.
15. Zeile hinzufügen nach set-target-price ⇒ Inline-Hinweis „Endpreis weicht
    vom Zielpreis ab", keine stille Nachführung; 1-Klick-Neuberechnung
    aktualisiert die Anpassungszeile.
