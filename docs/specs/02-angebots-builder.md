# Angebots-Builder

Modul-Spec MAESTRO · Stand 2026-07-05 · Status: entscheidungsreif
Scope: Optionen A–E, Menü nach Tagen/Gängen, Positionen mit Menge/EP/MwSt 7/19 %,
Rabatt, pro-Kopf vs. pauschal, Preis-Override, Equipment/Personal je Option.

## A — IST im Alt-System (mit Evidenz)

Zugehörige Inventar-Funktionen (docs/MAESTRO-FEATURE-INVENTAR.md, Abschnitte
„Angebot (Editor)" und „Angebot (Anfrage-Editor)"): Bis zu 5 Optionen (A–E) mit
5 Modi · Menü-Editor mit Gängen + Mehrtages-Support (DayTabs) · Getränke-Sektion
mit 4 Modi · Equipment & Personal je Option · Preislogik pro Person/pauschal,
Rabatt (%/€), Preis-Override · MwSt 7/19 aus Menü-Auswahl · Restaurant-Menü-Import ·
Freitext-Angebots-Import (KI) + Red-Team-Validierung · KI-Menüvorschlag (3 Varianten) ·
Paketname-Override · Option duplizieren/zurücksetzen.

Der Alt-Builder ist funktional mächtig (~11.000 Zeilen in
`src/components/admin/refine/InquiryEditor/OfferBuilder/`), aber auf einem
JSONB-Blob (`menu_selection`) gebaut, der drei Generationen von Strukturen
gleichzeitig trägt. Nachweislich problematisch:

1. **Doppeldeutiges Preisfeld** — `pricingMode.ts` (Z. 18–20) dokumentiert selbst:
   „Das Feld heisst zwar budgetPerPerson, wird aber im per_event-Modus als
   Gesamtbetrag gelesen. Ein einziges Feld, zwei Interpretationen."
2. **Geld-Bug in Produktion** — `supabase/functions/repair-quotation-pricing/index.ts`
   existiert nur, weil per_event-Preise „fälschlich mit guestCount multipliziert"
   wurden → Faktor-N-Falschbeträge in echten LexOffice-Angeboten. Ein eigenes
   Repair-Skript für einen Preisfehler ist der stärkste Beleg gegen das Datenmodell.
3. **Menge im Namen vergraben** — `pricingMode.ts: parseQuantityPrefix()` parst
   `"11 x Salat"` per Regex aus `itemName`, „bei Legacy-Daten einmalig beim Laden",
   weil es kein Mengenfeld gab. Auto-Detection des Preismodus per Regex auf Namen
   (`detectPricingMode`) ist Heuristik statt Datenmodell.
4. **Dreifache Quelle der Wahrheit im Menü** — `types.ts` (Z. 217–224): `days[]`
   ist Quelle der Wahrheit, `courses[]` „bleibt als Legacy-Feld erhalten und wird
   gemirrort", damit E-Mail/PDF/Public-Offer-Renderer weiterlaufen; dazu
   `freeformProgram` als dritte Parallelstruktur mit eigener Tages/Mahlzeit/
   Sektions-Hierarchie und eigener Steuerlogik. `useOfferBuilder.ts` (Z. 499–533)
   migriert Legacy-Freeform beim Laden on-the-fly.
5. **MwSt rückwärts geraten statt gerechnet** — `PriceBreakdown.tsx` (Z. 323–354):
   USt wird proportional aus Brutto-„Buckets" mit Skalierungsfaktor auf einen
   überschreibbaren Endpreis zurückgerechnet; ein „Defensive Guard" blendet die
   USt aus, wenn „numerische Drift" sie größer als den Endpreis macht. Steuer-
   ausweis darf nie eine Heuristik mit Silent-Fail sein.
6. **Float-Euros statt Cents** — `total_amount NUMERIC(10,2)` (Migration
   20260129000816), alle Einzelpreise als JS-`number` in Euro. Verstößt gegen
   die MAESTRO-Leitplanke „Geld immer in Integer-Cents".
7. **Preislogik dreifach implementiert** — Client (`useOfferBuilder.ts`, 1.801 Z.),
   Anzeige (`PriceBreakdown.tsx`, 689 Z.) und Edge Function
   (`create-event-quotation`) rechnen jeweils selbst; `totalAmount` wird
   persistiert statt abgeleitet → Drift ist strukturell möglich (siehe Punkt 2).

Neubau-Stand (`/home/user/maestro-cloud`): `offer_options` (tenant-RLS, Cents,
Label, Version, isChosen) + `offer_history`-Snapshots + Send-Endpoint mit
Public-Token existieren und sind live verifiziert. Der Builder (`apps/web/src/
pages/builder.tsx`) kann aber nur Titel/Beschreibung/Freitext-Positionen
(`menuSelection.items: {section, name}`) **ohne Preise** — der Gesamtbetrag wird
als Euro-Text von Hand eingetippt. Genau diese `menu_selection`-JSONB wird abgelöst.

## B — Der eigentliche Job (Jobs-to-be-done)

**Job:** „Baue mir in unter 5 Minuten aus Anfrage + Katalog ein preislich
korrektes, versandfertiges Angebot mit 1–3 wählbaren Varianten — egal ob
2er-Geburtstag, 3-Tages-Catering oder Exklusiv-Buchung — und garantiere, dass
Kunde, LexOffice und Stripe exakt dieselben Zahlen sehen." Der Builder ist der
Hebel der Nordstern-Metrik: Jede Minute im Builder ist eine Minute „Anfrage →
Angebot".

**Gestrichen / zusammengelegt (mit Begründung):**
- **5 Angebots-Modi → 1 Positionsmodell.** „Paket", „Restaurant-Menü-Import" und
  „Freitext-Import" sind keine Modi, sondern *Befüllungswege*, die alle dieselben
  Positionen erzeugen. Der Modus-Zoo existierte nur, weil das Datenmodell pro
  Weg eine andere Struktur hatte.
- **„Nur-E-Mail"-Modus gestrichen.** Eine Antwort ohne Angebot gehört in den
  Nachrichten-Flow (Modul Inbox), nicht als leere Angebotsoption.
- **FreeformProgram-Parallelstruktur gestrichen.** Der KI-Parser schreibt direkt
  Positionen (Tag/Sektion/Menge/EP/MwSt); keine zweite Hierarchie, keine eigene
  Steuerlogik mehr.
- **Red-Team-Validierung (Zweitmodell GPT-5) gestrichen.** Im neuen Modell rechnet
  die Engine deterministisch; der Parser liefert nur Positionen + die im Text
  genannte Endsumme, die Differenz wird deterministisch angezeigt. Ein zweites
  LLM zur Preiskontrolle war Symptombekämpfung.
- **pricingMode auf Optionsebene + budgetPerPerson gestrichen.** Preismodus wird
  Zeileneigenschaft (`per_person` | `per_unit` | `flat`); der Options-Gesamtpreis
  ist immer Summe der Zeilen. Override wird explizite Anpassungszeile (s. D).
- **Getränke-4-Modi zusammengelegt.** Pauschale = Flat-Zeile, Weinbegleitung =
  per-Person-Zeile, Einzelgetränke = normale Zeilen in Sektion „Getränke".
- **Paketname-Override gestrichen** — Optionstitel ist ohnehin freies Snapshot-Feld.
- **Angebots-Sprachen IT/FR gestrichen** — Produktsprachen sind DE + EN.
- **Storia-Spezifika raus aus dem Kern:** Ristorante-Menü-Import-Heuristik,
  eSignatures.com-Kostenübernahme (eigenes Modul), Katalog „Catering+Ristorante
  kombiniert" (wird generischer Mandanten-Katalog, eigene Spec).

## C — Benchmark 2026

Table Stakes (Digest): interaktives Web-Angebot mit Branding statt PDF, mehrere
Varianten, Annahme + Anzahlung online, BEO aus dem Angebot, KI-Entwurf in
Sekunden (Event Temple „Smart Proposal Builder", iVvy/hivr.ai „Instant Proposal",
Perfect Venue „AI Reply", Univents ab 46 €). Eventmachine belegt den Ziel-Takt:
komplette Angebote in < 5 Min statt 45+. Tripleseat „Live Documents" setzt den
Standard: Angebot ist ein lebendes Web-Dokument, Änderungen sofort sichtbar.

**Wo wir mindestens gleichziehen:** Positionsbasierte Optionen mit Varianten,
KI-Befüllung (Vorschlag → Mensch bestätigt), Katalog-Picker, Duplizieren,
Live-Summen, mobile Bedienbarkeit.

**Wo wir bewusst schlagen (DACH-Lücke, keiner der Genannten hat es):**
1. **Steuer-exakte Cents-Engine** — per-Zeile-MwSt (DE 7/19, AT 10/20, CH 2.6/8.1
   konfigurierbar), eine einzige Server-Engine für UI, Public-Offer, LexOffice
   und Stripe. US-Tools kennen keine deutsche USt-Aufteilung; DACH-Legacy
   (Bp Event) kann sie, aber ohne Web-Abschluss-Flow.
2. **Spektrum in einem Modell** — eine Option darf 0 Positionen haben (2er-
   Reservierungsbestätigung) bis 200 Positionen über 5 Tage (Exklusiv-Buchung).
   Reservierungs- und Bankettwelt trennen das heute.
3. **Nordstern eingebaut** — der Builder stempelt `first_opened_at` /
   `sent_at`; „Minuten bis Angebot" wird pro Vorgang gemessen und im Dashboard
   benchmarkt. Kein Wettbewerber zeigt das.

## D — Soll-Design (Neubau)

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)
1. Einstieg aus Anfrage/Event: Builder öffnet mit Kontext-Leiste (Kunde, Datum,
   Gäste, Anlass, Budget) — nichts zweimal eintippen.
2. Start-Wahl als 3 Kacheln: **KI-Vorschlag** (aus Anfrage + Katalog),
   **Vorlage/Paket**, **Leer beginnen**. KI erzeugt 1–3 Options-Entwürfe mit
   Badge „KI-Entwurf — prüfen"; nichts wird ohne Bestätigung persistiert.
3. Optionen A–E als Karten-Tabs (Default 1, empfohlen max 3; Duplizieren-Button).
   Pro Option: Titel, Gästezahl (Default vom Event), Positionsliste.
4. Positionsliste gruppiert nach Sektionen (Menü/Getränke/Equipment/Personal/
   Sonstiges); Menü-Sektion optional nach Gängen benannt. Zeile = Menge ×
   Einheit × EP (brutto) × Preismodus-Chip (`/Pers.` | `/Stück` | `pauschal`) ×
   MwSt-Chip (7/19). Katalog-Picker mit Suche + Freitext-Zeile; Katalogpreis als
   Snapshot, Abweichung = markierter Override.
5. Mehrtägig per progressive disclosure: Button „+ Tag" erzeugt Tages-Tabs
   (Label z. B. „Mo 29.06. Lunch", eigene Gästezahl möglich); eintägig bleibt
   die Tab-Leiste unsichtbar.
6. Summenpanel (Desktop rechts, mobil Sticky-Bottom-Sheet): Zwischensumme,
   Rabatt (%/€, wirkt auf rabattierbare Zeilen), ggf. Preisanpassungs-Zeile,
   Endpreis gesamt + pro Person (beides immer, keine Modus-Wahl mehr),
   USt-Ausweis je Satz — live vom Server gerechnet.
7. Preis-Override: Feld „Zielpreis" — Differenz wird als explizite Position
   „Preisanpassung" (± Cents, eigener USt-Split proportional, persistiert)
   eingefügt. Sichtbar, auditierbar, LexOffice-exakt. Kein Skalierungsfaktor.
8. Autosave (Debounce ~1 s) mit Statuschip; Validierungs-Hinweise inline
   (Zeile ohne Preis, Summe ≠ Importtext, Katalog-Abweichung).
9. Weiter zu „Vorschau & Senden" (eigenes Modul 03): Snapshot, Versand,
   `sent_at`-Stempel für die Nordstern-Metrik.

### Datenmodell (Neon Postgres, alle Beträge Integer-Cents, Brutto)
`offer_options` (existiert) — Änderungen:
```
+ title text                       -- ersetzt packageNameSnapshot-Override
+ discount_mode text               -- 'percent' | 'amount' | null
+ discount_value integer           -- Basispunkte (percent, 2500 = 25%) bzw. Cents
+ subtotal_cents integer not null default 0     -- vom Server gerechnet
+ discount_cents integer not null default 0     -- vom Server gerechnet
+ adjustment_cents integer not null default 0   -- Preisanpassung (±)
  amount_total_cents               -- bleibt; wird NUR von der Engine geschrieben
+ vat_breakdown jsonb              -- [{rate_bp, net_cents, vat_cents, gross_cents}]
- menu_selection                   -- deprecated, nach Migration entfernen
```
`offer_items` (NEU):
```
id uuid pk · tenant_id uuid not null → tenants (RLS wie offer_options:
  crudPolicy read/modify = tenantIsMember(tenant_id), FORCE RLS)
option_id uuid not null → offer_options on delete cascade
day_no smallint null · day_label text · day_date date null   -- null = eintägig
section text not null default 'menu'   -- 'menu'|'drinks'|'equipment'|'staff'|'other'|'adjustment'
course_label text null                  -- z. B. 'Antipasto', frei
catalog_item_id uuid null               -- → Katalog-Modul (Snapshot bleibt gültig ohne FK-Zwang)
name text not null · description text
qty numeric(9,2) not null default 1 · unit text default 'Stück'  -- 'Stück'|'h'|'Pers.'|frei
unit_price_cents integer not null       -- Brutto-EP
catalog_price_cents integer null        -- Snapshot; ≠ unit_price ⇒ Override-Badge
price_mode text not null default 'per_person'   -- 'per_person'|'per_unit'|'flat'
vat_rate_bp integer not null default 1900       -- 700/1900; Sätze aus tenant_settings
discountable boolean not null default true      -- Equipment/Personal default false
sort_order integer not null default 0
index (tenant_id, option_id) · check price_mode/section
```
Zeilentotal (Engine, deterministisch): `per_person: qty×EP×Gäste(Tag) ·
per_unit: qty×EP · flat: EP`. Rundung: pro Zeile auf Cent, Summe = Summe der
Zeilen; USt je Satz aus Brutto: `vat = gross − round(gross/(1+rate))`, exakt
gleiche Formel in LexOffice-Export. Alt-Migration (Storia): einmaliges
ETL-Skript `menu_selection` (courses/days/freeform/drinksEinzeln/equipment/
staff, `parseQuantityPrefix`-Fälle) → `offer_items`, mit Abweichungsreport.

### API (Hono-Worker; bestehende offers.ts erweitert)
- `GET /api/events/:id/offers` — inkl. Items (join, ein Roundtrip).
- `POST /api/events/:id/offers` · `PATCH /api/offers/:id` — Kopf-Felder;
  Totals-Felder sind read-only (Server rechnet).
- `PUT /api/offers/:id/items` — Bulk-Replace aller Items transaktional;
  Server validiert, rechnet Engine, schreibt Totals, gibt Breakdown zurück
  (eine Quelle der Wahrheit, ideal für Autosave).
- `POST /api/offers/:id/duplicate` — Option inkl. Items kopieren.
- `POST /api/offers/:id/set-target-price {target_cents}` — erzeugt/aktualisiert
  Anpassungszeile.
- `POST /api/events/:id/offers/ai-suggest` — KI-Entwurf (s. u.), Rückgabe als
  Draft-Payload, kein DB-Write.
- `POST /api/events/:id/offers/parse-freeform {text}` — Freitext/PDF → Items-
  Draft + `totals_from_text` für den deterministischen Summen-Check.
- Pricing-Engine als pures Paket `packages/pricing` (Worker + Web importieren
  dieselbe Funktion; Web nur für optimistische Anzeige, Server ist autoritativ).

### Automatisierungen (Cron/Queue)
- Beim ersten Öffnen des Builders: `offer_first_opened_at` am Event stempeln;
  bei Versand `offer_sent_at` (existiert) → Kennzahl „Minuten bis Angebot".
- Queue-Job „Angebot hängt": Entwurf > 4 h nicht versendet → Push/Badge an
  Betreiber (PWA), konfigurierbar. Direkter Nordstern-Hebel.
- Nightly-Konsistenzcheck: Engine-Recompute vs. gespeicherte Totals; Drift ⇒
  Alert (nie wieder ein „repair-quotation-pricing").

### KI-Punkte (Input → Vorschlag → Bestätigung)
1. **Options-Vorschlag:** Anfragetext + Katalog + Anlass/Budget → 1–3 Optionen
   (Low/Mid/High) als Draft mit Begründung; Betreiber übernimmt pro Option.
2. **Freitext/PDF-Import:** Alt-Angebote/Word-Vorlagen → Items-Draft; Preise 1:1,
   deterministischer Abgleich der Endsumme statt Zweitmodell.
3. **Preis-Sanity:** Warn-Chip bei EP-Abweichung > x % vom Katalog-Snapshot und
   bei ungewöhnlichem Pro-Kopf-Preis fürs Segment. Nur Hinweis, nie Auto-Änderung.

### Integrations-Berührungen
- **LexOffice:** `offer_items` mappen 1:1 auf Quotation-Line-Items (per-Zeile
  MwSt, Rabatt/Anpassung als eigene Zeilen) — Parität per Golden-Tests.
- **Stripe Connect:** Anzahlung = Prozent/Betrag vom `amount_total_cents` der
  gewählten Option (Modul Zahlungen).
- **Katalog-Modul (Spec 0x):** Picker liest Katalog; Items bleiben Snapshot-fest.
- **Public-Offer/BEO:** rendern ausschließlich aus `offer_items` + Breakdown.

## E — Klassifikation

**Kern.** Der Builder ist der Kern des Abschluss-Flows (Nordstern) und nicht
abschaltbar. Innerhalb des Kerns per Registry (B10) zuschaltbar: Mehrtages-Tabs
(nur Catering-Mandanten), Equipment/Personal-Sektionen, KI-Freitext-Import.
**Storia-only (nicht in den Kern):** Ristorante-Menü-Import-Heuristik,
IT/FR-Übersetzungen, eSignatures.com-Kostenübernahme, kombinierter
Catering+Ristorante-Katalog. Kriterium: brauchen < 30 % der Zielmandanten es
am Tag 1? Nein ⇒ Registry-Modul oder Storia-Fork.

## F — Bau-Plan

| # | Schritt | Abhängig von | Aufwand | Neu |
|---|---------|--------------|---------|-----|
| 1 | `packages/pricing`: Engine (Cents, Zeilenmodi, MwSt-bp, Rabatt, Anpassung) + Property-/Golden-Tests | — | M | Paket |
| 2 | Migration: `offer_items` + Totals-/Rabatt-Felder auf `offer_options`, RLS + FORCE, Indexe | 1 | S | Tabelle |
| 3 | API: Items-Bulk-PUT + Recompute, duplicate, set-target-price; Totals read-only | 1,2 | M | Endpunkte |
| 4 | Web: Positions-Editor (Sektionen, Zeilen, Chips, Summenpanel, Autosave, mobil) | 3 | XL | UI |
| 5 | Tages-Tabs (progressive disclosure) + Gästezahl je Tag | 4 | M | UI |
| 6 | Katalog-Picker (gegen Katalog-Modul; interimistisch Freitext) | 4, Katalog-Spec | M | UI |
| 7 | Public-Offer-Seite + Send-Snapshot auf Items/Breakdown umstellen | 3 | M | Renderer |
| 8 | LexOffice-Export-Mapping + Paritäts-Golden-Tests | 1,3 | M | Adapter |
| 9 | KI: ai-suggest + parse-freeform Worker-Endpunkte, Draft-UX | 3,4 | L | Endpunkte |
| 10 | Nordstern-Stempel + „Angebot hängt"-Queue + Nightly-Konsistenzcheck | 3 | S | Cron/Queue |
| 11 | Storia-ETL `menu_selection` → `offer_items` mit Abweichungsreport | 2 | M | Skript |

Reihenfolge 1→4 ist der kritische Pfad; 5–11 parallelisierbar.

## G — Risiken & Lösungen (Top 3)

1. **Rundungs-/Steuer-Drift zu LexOffice** (Alt-System hatte reale Geld-Bugs).
   → Eine Engine, Integer-Cents, identische Brutto-USt-Formel im Export,
   Golden-Tests gegen echte LexOffice-Responses, Nightly-Recompute-Alert.
2. **Komplexitäts-Rückfall**: Das Positionsmodell könnte zur zweiten
   10.000-Zeilen-UI wuchern. → Hartes UX-Budget: 1 Zeilentyp, 3 Preismodi,
   progressive disclosure für Tage/Sektionen; jede neue Zeileneigenschaft
   braucht einen Job-Beleg. „2er-Reservierung in < 60 s" als ständiger Testfall.
3. **Storia-Migration der JSONB-Varianten** (courses/days-Mirror, freeform,
   Mengen im Namen). → ETL mit Abweichungsreport pro Angebot, Alt-Snapshots in
   `offer_history` bleiben unverändert lesbar; nur offene Vorgänge werden
   migriert, abgeschlossene bleiben Archiv.

## H — Akzeptanzkriterien

1. Ein Betreiber erstellt aus einer Anfrage per KI-Vorschlag ein 2-Options-
   Angebot mit korrekten Summen in unter 5 Minuten (gemessen via Stempel).
2. Eine 2er-Reservierungsbestätigung (Option ohne Positionen) ist in unter
   60 Sekunden versandfertig.
3. Jede Position trägt Menge, Einheit, Brutto-EP in Cents, Preismodus und
   MwSt-Satz; `amount_total_cents` ist ausschließlich servergerechnet — ein
   direkter PATCH auf Totals wird abgelehnt.
4. per_person-, per_unit- und flat-Zeilen ergeben bei Gästezahl-Änderung
   deterministisch neue Summen; kein Feld wird kontextabhängig uminterpretiert.
5. Preis-Override erzeugt eine sichtbare, persistierte Anpassungszeile;
   USt-Ausweis bleibt exakt (Summe USt-Sätze = Endpreis-Differenzrechnung,
   kein Silent-Fail).
6. Rabatt (%/€) wirkt nur auf `discountable`-Zeilen und erscheint im
   LexOffice-Export als eigene Zeilen mit korrektem USt-Split; Export-Betrag
   == Builder-Betrag auf den Cent (Golden-Test).
7. Ein 3-Tages-Programm mit tagesweise abweichender Gästezahl ist abbildbar
   und rechnet pro Tag korrekt.
8. KI-Entwürfe (Vorschlag & Freitext-Import) schreiben nie ohne explizite
   Bestätigung in die DB; Freitext-Import zeigt Differenz zur Textsumme an.
9. RLS: Ein Mitglied von Mandant A kann `offer_items` von Mandant B weder
   lesen noch schreiben (automatisierter Isolationstest, hartes Gate).
10. Builder ist auf 390 px Breite voll bedienbar (Positionszeile, Summen-Sheet,
    Senden) — PWA-Smoke-Test.
