# KONZEPT — Geschenkkörbe im events-storia.de-Shop (zuerst), MAESTRO später

Stand: 20.11.2026 (angepasst an die Inhaber-Entscheidungen 10–16 unten) · Status: **Konzept; umgesetzt in PR #14 (Migrationen) und #15 (Shop)**. Ersetzt für die erste Stufe den Shop-Teil von
`maestro-cloud/docs/KONZEPT-geschenkkoerbe.md` (dort Umzug nach MAESTRO = spätere Stufe).
Gelesen wurde `origin/main` (Stand 11.11.2026); der lokale Branch `shop-umsatz-p9` liegt **32 Commits dahinter**
(u. a. AGB-2026-10, Checkout-RPC-Retry) — Umsetzung nur auf Basis von `origin/main`.

Vorgaben Antoine: Körbe Klein 99 € / Mittel 139 € / Groß 249 € (inkl. Wein, je 2 Weinsorten zur Wahl); Abholung Karlstraße 47a
**oder** Lieferung; Lieferpreis = Münchner Taxitarif (einfache Strecke ab Karlstr. 47a, erste 7 km je 2,70 €, jeder weitere km 2,50 €,
Minimum 5,90 €, **exakt auf den Cent, kein Aufrunden**, kein Gebietslimit) **nur für Körbe**; Bestand **standardmäßig unbegrenzt** (Körbe werden nachgemacht), der Betreiber stellt je Variante manuell auf „ausverkauft“/feste Menge; **ist der Korb (samt Weinvariante)
bestellbar, ist Abholung sofort möglich**, Lieferung mit 1 Tag Vorlauf; Sperrtage im Admin; Stripe online (vor Ort offen);
LMIV je Bestandteil; Wein ab 16. Landingpage ristorantestoria.de: Kaufen öffnet den Shop in **neuem Tab** (`target="_blank" rel="noopener"`).
Alle Bestellungen aus events-storia (Catering, Gutscheine, Körbe) sollen in MAESTRO sichtbar sein + Betreiber-Mail je Kauf.

---

## 1. Ausgangslage (mit Pfaden, `events-storia.de/`)

**Stack/Betrieb:** Vite/React, Supabase **nur über Lovable** (Migrationen und Edge Functions als Dateien, Lovable spielt ein). Shop ist **nur DE/EN**
(`src/contexts/LanguageContext.tsx`: `"de" | "en"`; `src/config/routes.ts` je Route `languages: ['de','en']`).

| Thema | Ist-Stand |
|---|---|
| **Produkte** | Es gibt **keine Shop-Produkttabelle**. Catering-Artikel sind Menüeinträge: `menus` (`menu_type='catering'`) → `menu_categories` → `menu_items` (Preis `price numeric`, Bild, `serving_info`, `min_order`, Vegetarisch/Vegan, `deleted_at`/`archived_at`). Hook `src/hooks/useCateringMenus.ts`, Admin `CateringMenusManager.tsx`. **Keine Varianten/Optionen, kein Lager, keine LMIV-Felder, keine MwSt.-Spalte** (7 % ist hart codiert). |
| **Warenkorb** | `src/contexts/CartContext.tsx` (localStorage `storia-catering-cart`): Items `{id,name,price,quantity,category}`; Event-Pakete und Catering dürfen nicht gemischt werden. Kein Variantenfeld. UI `src/components/cart/CartSheet.tsx`, `StickyCartPanel.tsx`. |
| **Checkout** | `src/pages/Checkout.tsx` (2.237 Zeilen, 3-Stufen-Akkordeon). Bestellung wird per RPC `checkout_create_catering_order(payload)` (SECURITY DEFINER, `supabase/migrations/20260515203611_…sql`) in `catering_orders` geschrieben — das ist seit 22.04.2026 eine **View über `v2_events`** (+ `v2_payments`, `v2_customers`). **Beträge (`total_amount`, `delivery_cost`) kommen vom Client; es gibt keine serverseitige Neuberechnung.** `create-catering-payment` vergleicht nur gegen den vom Client geschriebenen DB-Wert. Für Körbe nicht übernehmbar (siehe 3.3). |
| **Stripe** | `create-catering-payment` (Checkout-Session, ein Posten „STORIA Catering #…“, `mode:payment`, optional Billie), `create-voucher-checkout`, `create-payment-session` (hat `expires_at`). Webhook `supabase/functions/handle-stripe-webhook/index.ts` (2.584 Z.): `processCheckoutPaid` verzweigt über `metadata.order_type` (`catering`, `event`, `voucher`, Maestro-Zahlungen …). `checkout.session.expired` wird nur **geloggt** (kein Freigeben). `charge.refunded`/`dispute` vorhanden. |
| **Gutschein-Shop als Muster** | `src/pages/Gutschein.tsx` + `GutscheinDanke.tsx` + `create-voucher-checkout` + `handleVoucherPayment` + Tabelle `vouchers` + Admin `VouchersList.tsx`: **eigene schlanke Seite, eigene Tabelle, eigene Edge Function, eigener Webhook-Zweig** — ohne den 2.237-Zeilen-Checkout. Genau dieses Muster passt für Körbe. |
| **Bestätigungsmail** | `send-order-notification` (Resend, SMTP-Fallback): Kundenmail „Ihre Catering-Bestellung …“ + Betriebsmail „BEZAHLT: Neue Bestellung …“ an `info@events-storia.de`, Protokoll in Email-Log. Payload `OrderNotificationRequest` kennt keine Weinwahl/Grußkarte/Altersangabe. Der Webhook löst sie nach Zahlung aus. |
| **Rechnung** | `create-lexoffice-invoice`: Positionen **fest 7 % MwSt.**, Lieferung fest 19 % (`taxRatePercentage`), Bruttopreise 1:1. Wein = 19 % → braucht Steuersatz je Position. |
| **Admin** | Refine-Admin: `src/components/admin/refine/OrdersList.tsx`, `OrdersKanbanView.tsx`, `CateringOrderEditor.tsx`, `CateringOrderDetail.tsx`, `VouchersList.tsx`. `is_test`-Flag + `TestModeContext`. |
| **Lager/Verfügbarkeit** | **Nicht vorhanden** (keine Tabelle, kein Feld). |
| **Termin** | `Checkout.tsx` ~Z. 700–745: Datum + `TimeSlotPicker` (10:00–21:30, 30-Min-Raster), Vorlauf **fest 24 h Catering / 1 h Pizza** im Client (nur Warnung). **Keine Sperrtage, keine Feiertage, keine Kapazität, keine Öffnungszeiten-Konfig** (Öffnungszeiten nur als Text/JSON-LD). |
| **Lieferpreis** | `supabase/functions/calculate-delivery/index.ts` (`verify_jwt=false`): Geocoding + Directions über **OpenRouteService** (Secret `OPENROUTE_API_KEY`), Start hart `48.1431, 11.5606`, Straßen-km. Tarif **im Code**: ≤1 km frei; ≤8 km 50 € netto je Fahrt; darüber 50 € + 1,20 €/km netto, 19 % MwSt., Hin-/Rückfahrt (×2 bei Catering), Mindestbestellwert 50/150/200 €. Aufrufer: `Checkout.tsx` (Z. 510) **und** `CateringOrderEditor.tsx` (Z. 383, Admin-Neuberechnung). Die Funktion liefert nur Anzeige; die Summe landet clientseitig in der Bestellung. |
| **Deep-Link** | **Nicht vorhanden.** `Checkout.tsx` liest nur `?payment=success&order=…`; kein „Produkt in den Warenkorb per URL“. |
| **MAESTRO-Handoff** | Outbox `maestro_handoff_outbox` (RPC `claim_maestro_handoffs`), Worker `deliver-maestro-handoff` (pg_cron minütlich, Backoff, HMAC), Helfer `_shared/maestroHandoff.ts`. **Im Stripe-Webhook wird jede bezahlte Session (jeder `order_type`) per `maestroEnqueueOrder` eingereiht** — Payload nur: Order-/Kundendaten + `amountTotalCents` (+ Transaktion). Feature-Flag `MAESTRO_HANDOFF_ENABLED` (nur `"true"` aktiv). Keine Positionen, keine Übergabeart, kein Termin. |
| **CORS** | `_shared/cors.ts` erlaubt nur `events-storia.de`/Lovable/localhost — **nicht** ristorantestoria.de. |
| **Recht** | `src/content/agb-2026-10.json` (Teil A–F). Vertragspartner Speranza GmbH. Teil C „Online-Shop“ §§ 18–24, § 8 Widerruf, Teil E Gutscheine §§ 28–33, `src/pages/Widerrufsbelehrung.tsx`, `Lebensmittelhinweise.tsx`. |

**MAESTRO (`maestro-cloud/`), Stand heute:** `POST /api/webhooks/shop-order` (`apps/api/src/routes/shop-order.ts`, `lib/shop-order.ts`,
Migration `packages/db/sql/135_shop_order_intake.sql`, SD-Funktion `ingest_shop_order`): HMAC, atomar idempotent über `shop_provider_events`, legt
Kunde (Dedup per E-Mail) + `events`-Zeile (`source='shop'`, Status `offer_chosen`, `source_system`/`source_order_id`/`source_order_number`) + `payments`-Zeile an.
Zod-Schema nimmt **nur** Name/E-Mail/Firma/Telefon/Summe/`eventDate`/`guests`/`occasion`/`message`/Transaktion; Body max. 20 KB.
**Keine Positionen, keine Übergabeart/Lieferadresse, keine eigene Bestell-Tabelle, keine Betreiber-Benachrichtigung, keine Admin-Liste „Shop-Bestellungen“**
(Bestellungen erscheinen nur als gewöhnliche Veranstaltungen). Betreibermail-Muster vorhanden: `lib/public-inquiry.ts#sendInquiryIntakeMails` (Mailer `resolveMailer`).
Letzte Migrationsnummer im Repo: 295 (808–810 laut Loop-Nacht reserviert → Nummer vor Anlage auf `origin/main` + offenen PRs prüfen).

---

## 2. Was wiederverwendet wird
- Stripe-Konto, Webhook-Endpunkt, Idempotenz-Muster, Refund-/Dispute-Pfad; Session mit `expires_at` (Muster `create-payment-session`).
- **Gutschein-Muster** (eigene Seite + Edge Function + Tabelle + Webhook-Zweig + Danke-Seite + Admin-Liste).
- OpenRouteService-Zugang (Secret, Geocoding+Directions-Aufrufmuster aus `calculate-delivery`) — **als Kopie in neuer Funktion**, `calculate-delivery` bleibt unangetastet.
- `send-order-notification`-Infrastruktur (Resend/SMTP/Log) — als Vorlage für neue Mail-Funktion.
- LexOffice-Rechnung (`create-lexoffice-invoice`) mit Erweiterung um Steuersatz je Position.
- Outbox → MAESTRO (läuft für jede bezahlte Session automatisch); `is_test`/`TestModeContext`; Refine-Admin-Gerüst; `LocalizedLink`, `SEO`, `routes.ts`.
- Rechtstexte-Gerüst (`agb-2026-10.json`, `Widerrufsbelehrung.tsx`).

## 3. Was neu/anders gebaut werden muss

**Entscheidung Architektur (empfohlen): eigener Körbe-Flow nach Gutschein-Muster, nicht im Catering-Checkout.** Gründe: Checkout.tsx
vertraut Client-Beträgen, kennt keine Varianten/Lager/Alter/Grußkarte, mischt Event/Catering; Änderungen dort riskieren den laufenden Catering-Umsatz.

### 3.1 Datenmodell (Migrationen = eigener PR, expand-only, Lovable spielt ein)
| Tabelle | Inhalt | Migration |
|---|---|---|
| `gift_baskets` | `id, slug, name_de/en, description_de/en, image_url, price_cents` (brutto, 9900/13900/24900), `vat_split jsonb` (Anteile 7 %/19 %, vom Steuerberater), `sort_order, active` | ja |
| `gift_basket_variants` | je Korb die Weinwahl (2 Zeilen): `basket_id, key, label_de/en, stock_unlimited bool` (Default **true** = unbegrenzt), `stock_qty int` (nur bei fester Menge; ausverkauft = `stock_unlimited=false`, 0; Änderung nur über `gift_set_stock_mode`), `price_delta_cents=0`, LMIV-Felder des Weins (Nettofüllmenge, Vol.-%, Abfüller, Herkunft, Allergen Sulfite), `active` | ja |
| `gift_basket_components` | Bestandteile je Korb: Name, Menge, Zutatenverzeichnis, `allergens text[]` (14 LMIV-Allergene), Nettofüllmenge, Lebensmittelunternehmer, Herkunft, `label_photo_ref` | ja |
| `gift_settings` (1 Zeile) | Startkoordinaten (Karlstr. 47a), Tarif `min_fee_cents=590`, `tiers [{from_km:0,per_km_cents:270},{from_km:7,per_km_cents:250}]`, `round_up_to_cents=100`, MwSt. Lieferung, Vorlauf `pickup_lead_days=0`, `delivery_lead_days=1`, Abholfenster je Wochentag (`pickup_hours jsonb`), Reservierungsdauer 30 Min | ja |
| `gift_blackout_dates` | `date, handover ('pickup'\|'delivery'\|'both'), reason` — Sperrtage/Betriebsferien | ja |
| `gift_orders` | Bestellnummer, Kunde (Name, E-Mail, Telefon), `handover`, Wunschdatum/-zeit, Lieferadresse, Snapshot `distance_km`, `delivery_fee_cents`, `items_total_cents`, `total_cents`, `vat_breakdown jsonb`, Grußkarte-Text, `age_confirmed_at`, `agb_accepted_at`+Version, `status` (`pending`→`paid`→`ready`→`handed_over`/`cancelled`), Stripe-Session/PaymentIntent, `is_test`, `lexoffice_*` | ja |
| `gift_order_items` | `order_id, basket_id, variant_id, qty, unit_price_cents, vat_split, Namen als Snapshot` | ja |
| `gift_stock_holds` | `order_id, variant_id, qty, expires_at, status ('held'\|'consumed'\|'released')` | ja |
| RPCs (SECURITY DEFINER) | `gift_reserve_stock(order_id, items)` — Zeile der Variante `FOR UPDATE`, verfügbar = `stock_qty − Σ aktive Holds`, sonst Fehler `sold_out`; `gift_consume_stock(order_id)` bei Zahlung (`stock_qty -= qty`, Holds `consumed`); `gift_release_stock(order_id)`; `gift_public_catalog()` (nur aktive, liefert `unlimited` und `available` = null bei unbegrenzt bzw. Zahl, **keine** Interna); Sweep für abgelaufene Holds (pg_cron oder beim nächsten Reserve) | ja |
| RLS | Öffentlich nur lesen über `gift_public_catalog()`; Schreiben ausschließlich Service-Role; Admin (`has_role admin`) alles; Staff laut `20260222_staff_role_policies.sql` prüfen | ja |

Soft-Delete (`deleted_at`) statt Löschen, wie im Repo üblich.

### 3.2 Preise, MwSt.
Körbe sind Mischware (Speisen 7 %, Wein 19 %, ggf. Verpackung/Korb). **Aufteilung `vat_split` legt der Steuerberater fest** (Offene Entscheidung 5).
Alle Beträge serverseitig in Cent (Edge Function), Anzeige im Client nur Darstellung. Lieferung 19 % (Beförderungsleistung; **Steuerberater bestätigen**, ggf. 7 % im Nahverkehr — nicht raten).

### 3.3 Edge Functions (neu, jeweils Datei + `supabase/config.toml`-Eintrag)
- `gift-delivery-quote` — nimmt Adresse, Geocoding + Directions (ORS), rechnet Taxi-Staffel: `fee = max(590, Σ Staffelanteile)`, dann **exakt auf den Cent** (kaufmännisch, kein Aufrunden; Strecke vorher auf 0,01 km gerundet); Rückgabe km, `estimatedFeeCents`, Text „voraussichtlich“. Tarif aus `gift_settings`. Kein Gebietslimit; nur Rate-Limit/Plausibilität (z. B. Luftlinie > X km → Hinweis, kein Routing-Call) gegen ORS-Kostenmissbrauch. **`calculate-delivery` und `CateringOrderEditor` bleiben unverändert** → Catering unberührt.
  Beispiele: 2,0 km → 5,40 → Minimum **5,90 €**; 2,3 km → **6,21 €**; 7 km → **18,90 €**; 10 km → 18,90 + 7,50 = **26,40 €** (Lesart „ab 7 km gilt 2,50 € für die ganze Strecke“ wäre 25 € — Entscheidung 3).
- `create-gift-order` — **einzige autoritative Stelle**: validiert Eingabe (Zod/handgeschrieben), lädt Preise/Bestände aus DB (nie Client-Beträge), prüft Termin gegen Regeln (Abholung: sofort wenn auf Lager, innerhalb Öffnungszeiten; Lieferung: ≥ Vorlauf; Sperrtage), berechnet die **endgültige** Liefergebühr **neu** (zweiter ORS-Aufruf, nicht der Quote vertrauen), reserviert Bestand (`gift_reserve_stock`), schreibt `gift_orders` (`pending`), erzeugt Stripe-Session (`expires_at` = jetzt+30 Min, Posten je Korb + Lieferposten, `metadata.order_type='gift_basket'`, `order_number`), gibt `url` zurück. Fehler `sold_out` → klare Meldung, Warenkorb anpassen.
- `handle-stripe-webhook` (Änderung): neuer Zweig `order_type === 'gift_basket'` → `handleGiftPayment` (idempotent): Order `paid`, `gift_consume_stock`, LexOffice-Rechnung, Kunden- und Betriebsmail; Zweig für `checkout.session.expired` → `gift_release_stock` (heute no-op). Außerdem Refund/Storno → Bestand zurück (manuell im Admin „Bestand wieder einbuchen“, Entscheidung 8).
- `create-lexoffice-invoice` (Änderung, rückwärtskompatibel): Position kann `taxRatePercentage` mitbringen, Default bleibt 7 → Catering unverändert. Mischkorb = Position pro Steuersatz-Anteil.
- `send-gift-order-notification` (neu, Kopie/Abwandlung von `send-order-notification`): Kunde (Bestellbestätigung nach Zahlung: Positionen inkl. Wein, Übergabeart/Termin, Preis inkl. MwSt., Lieferung, Grußkarte, Widerrufsbelehrung/AGB als Text/Link, Pflichtinfos) + Betrieb („BEZAHLT: Neuer Geschenkkorb …“ mit Abhol-/Liefertag, Adresse, Grußkarte, Altersbestätigung).

### 3.4 Frontend (events-storia)
- Routen (`src/config/routes.ts`, DE/EN): `/geschenkkoerbe` (Übersicht + Konfigurator), `/geschenkkoerbe/bestellung` (Kasse), `/geschenkkoerbe/danke`. `prerender:false` für Kasse/Danke, Übersicht prerendern (SEO sekundär — die SEO-Landingpage liegt auf ristorantestoria.de; Übersicht auf events-storia `noindex` oder Canonical dorthin, **Entscheidung 9**).
- Eigener Mini-Warenkorb (`useGiftCart`, sessionStorage) — **nicht** `CartContext` (vermeidet Misch-Regeln mit Catering).
- **Deep-Link** (neu): `/geschenkkoerbe/bestellung?korb=klein&wein=<key>&menge=2` (auch Mehrfachposten `?pos=klein.rotwein.2,gross.weiss.1`). Die URL liefert **nur Auswahl** (Slug/Key/Menge); Preise/Bestand holt die Seite aus `gift_public_catalog()`. Ungültige/ausverkaufte Werte: freundlicher Hinweis, Rest bleibt erhalten, Menge gedeckelt auf Bestand.
- Kasse: Kontakt, Übergabeart (Abholung/Lieferung), Datum+Zeit (nur freie Tage, Abholung „heute ab sofort“ wenn Bestand da), Lieferadresse mit Live-Quote („**voraussichtlich** 19 €, endgültig bei Zahlung“), Grußkarte (Textarea, Länge begrenzt), **Checkbox Alter** („Ich bin mindestens 16 Jahre alt“ + Hinweis Übergabe nur an Personen ab 16), AGB/Widerrufsbelehrung-Checkbox, Button „zahlungspflichtig bestellen“ (§ 312j BGB; bestehender Button „Sofort kaufen“ ist hierfür nicht eindeutig → eigene Beschriftung), Pflichtangaben je Korb (LMIV) aufklappfrei sichtbar.
- Admin (Refine): `GiftBasketsAdmin` (Körbe, Varianten, Bestandskorrektur, Bestandteile/LMIV), `GiftOrdersList` (Filter Heute/Morgen/Abholung/Lieferung, Status „bereit/übergeben“, Druckansicht Lieferzettel mit Grußkarte), Sperrtage-Pflege, Einstellungen (Tarif, Fenster).
- Danke-Seite (`GutscheinDanke.tsx` als Muster), Cancel → zurück zur Kasse mit erhaltenem Warenkorb; Hold läuft nach 30 Min ab.

### 3.5 Termine: Regel laut Antoine (Präzisierung)
- **Abholung:** Korb + gewählte Weinvariante auf Lager (`verfügbar ≥ Menge`) → **sofort wählbar** („heute, ab jetzt + Packzeit X Min, innerhalb Öffnungszeiten“; Zeitfenster aus `gift_settings.pickup_hours`, Sperrtage beachten). Nicht auf Lager → nicht bestellbar (Empfehlung, **Entscheidung 1**).
- **Lieferung:** Vorlauf 1 Tag (konfigurierbar, `delivery_lead_days`); Gegengrund aus dem Bestand: kein Fahrer-/Kapazitätsmodell im System, Catering arbeitet mit 24 h — **kein Grund dagegen**, 1 Tag bleibt. Fenster z. B. halbtags; jeden Tag ganzjährig, außer Sperrtage.
- Bestand wird **bei Zahlung dekrementiert**, während des Checkouts per Hold reserviert (30 Min, deckungsgleich mit Stripe-`expires_at`); Anzeige „nur noch n verfügbar“ nur bei fester Menge ≤ 3 (bei unbegrenztem Bestand nie eine Stückzahl).
- Bei Abholung „sofort“ gilt der Hold auch bis zur Zahlung, sodass der letzte Korb nicht zweimal verkauft wird.

---

## 4. Ablauf Kunde (Knopf → Bestätigungsmail)
1. **ristorantestoria.de `/geschenkkoerbe-muenchen/`** (4 Sprachen): Auswahl Korb/Wein/Menge, Knopf „Kaufen“ = Link `https://www.events-storia.de/geschenkkoerbe/bestellung?korb=…&wein=…&menge=…` mit `target="_blank" rel="noopener"`, UTM-Parameter. IT/FR-Besucher landen im EN-Shop (Shop kennt nur DE/EN; Sprache per `?lang=`-Parameter oder Pfad `/en/` übergeben).
2. Shop öffnet in neuem Tab, Auswahl vorbelegt, Lagerstand live (`gift_public_catalog`).
3. Kunde wählt Übergabe + Termin; bei Lieferung Adresse → sofortige **voraussichtliche** Liefergebühr (`gift-delivery-quote`).
4. Grußkarte, Alter bestätigen, AGB/Widerruf akzeptieren → „zahlungspflichtig bestellen“.
5. `create-gift-order`: Neuberechnung (Preis, endgültige Liefergebühr, Termin, Bestand) + Hold → Stripe Checkout (30 Min).
6. Zahlung → Webhook: Order `paid`, Bestand dekrementiert, Rechnung (LexOffice), Mails; Weiterleitung auf Danke-Seite.
7. Bestellbestätigung per E-Mail (Vertragsschluss gem. AGB § 19 analog; Textform § 312f BGB).

## 5. Ablauf Restaurant
Betriebsmail „BEZAHLT: Neuer Geschenkkorb …“ (+ MAESTRO-Benachrichtigung, siehe Einheit M) → Admin „Geschenkkorb-Bestellungen“ (Heute/Morgen) → Korb packen
(Weinvariante, Grußkarte drucken) → Status „bereit“ → Abholung (Altersprüfung 16+ bei Übergabe) bzw. Fahrer (Lieferzettel, Übergabe nur an Personen ab 16) → „übergeben“.
Bestand korrigieren/auffüllen im Admin; Sperrtage pflegen; Storno/Erstattung über Stripe + Bestand wieder einbuchen.

## 6. Recht / Pflichtangaben + Lücken
Rechtlich verbindlich nur nach Prüfung durch Anwalt/Steuerberater; hier die Lückenliste.
- **Widerruf (Lücke, wichtig):** AGB § 8 schließt das Widerrufsrecht aus (Speisen/Getränke, § 312g Abs. 2 Nr. 9 BGB, bei schnell Verderblichem Nr. 2), und der Checkout-Text sagt „bei Speisenlieferungen zu einem festen Termin kein Widerrufsrecht“. Ein Geschenkkorb mit **haltbaren Lebensmitteln und Wein ist keine schnell verderbliche Ware** → der Ausschluss trägt für Körbe **voraussichtlich nicht**; 14 Tage Widerrufsrecht plus Belehrung, Muster-Widerrufsformular, Rücksendekosten-Regelung und Rückzahlungsfrist sind einzuplanen (oder Körbe so zusammenstellen/bewerben, dass Ausschlussgrund greift — nur mit Anwalt). Teil C (§§ 18–24) ist auf Catering/Pizza zugeschnitten (§ 20 Mindestbestellwert, Hin-/Rückfahrt; § 21 Wartezeiten; § 22 Geschirr; § 23 Stornostufen; § 24 Mängel) und passt für Körbe **nicht**; nötig ist ein **neuer Teil (z. B. „Teil C2 Geschenkkörbe“)** + Anpassung § 8 und `Widerrufsbelehrung.tsx` (DE/EN), AGB-Version erhöhen (Pflicht-Checkbox speichert `agb_version`).
- **Alkohol/Jugendschutz:** Abgabe von Wein/Crémant ab 16 (§ 9 JuSchG; Spirituosen ab 18 — nicht Teil des Sortiments, sicherstellen). Pflicht: Altersbestätigung im Shop (Checkbox, gespeichert), Hinweis in AGB, Altersprüfung bei Übergabe (Abholung und Lieferung; Fahrer-Anweisung). Gesetzlich ist die reine Checkbox allein bei Fernabsatz kritisch (Prüfung bei Übergabe nötig) — im AGB-Teil regeln.
- **LMIV (Art. 14 LMIV, Fernabsatz):** Pflichtangaben (Verkehrsbezeichnung, Zutaten, **Allergene hervorgehoben**, Nettofüllmenge, Lebensmittelunternehmer, Herkunft wo vorgeschrieben, Alkoholgehalt >1,2 Vol.-%, Sulfite) **vor Vertragsschluss** im Shop sichtbar (je Bestandteil, Datenmodell 3.1); MHD/Lagerhinweis bei Lieferung. Etikettenfotos liefert Antoine → Abtippen und Gegenlesen.
- **Preisangaben (PAngV):** Gesamtpreis inkl. MwSt. + Liefergebühr vor Bestellung, Hinweis „voraussichtlich“ bis zur endgültigen Berechnung ist transparent zu formulieren; Grundpreis für Einzelbestandteile bei Zusammenstellung prüfen lassen.
- **Button-Lösung § 312j BGB:** „zahlungspflichtig bestellen“ (siehe 3.4). **Informationspflichten Fernabsatz** (Art. 246a EGBGB), **Bestätigung in Textform** (Mail erfüllt dies, wenn die Vertragsbestandteile enthalten sind).
- **Steuer:** 7 %/19 %-Aufteilung, Verpackung, Lieferleistung — Steuerberater (Entscheidung 5). Rechnung: LexOffice-Position pro Satz.
- **Verpackungsgesetz** (Registrierung/Lizenzierung der Versandverpackung) und **Pfand/Glas**: prüfen.
- **Datenschutz:** Grußkarten-/Lieferdaten, ORS-Übermittlung der Lieferadresse (Auftragsverarbeitung/Hinweis in `datenschutz.json` ergänzen — Hauptfassung dort, byte-gleich mit ristorantestoria.de), Stripe bleibt wie bisher.
- **Vertragspartner** Speranza GmbH; Landingpage-Angebot muss „Angebot von STORIA / Speranza GmbH“ und Preise inkl. MwSt. nennen.
- **Landingpage-Seite:** Preise stehen dort nur als Anzeige; **Quelle der Wahrheit = Shop** (kein Preis-Drift wie `facts.ts`): Preise per Prerender-`fetch` auf den Shop-Katalog (CORS beachten, siehe 7/Einheit R) oder bewusst statisch mit Abgleichtest.

---

## 7. Offene Entscheidungen (nur echte, mit Empfehlung)
1. **Nicht vorrätig bei Abholung:** Wenn der Korb/die Weinvariante ausverkauft ist — (a) nicht bestellbar, Hinweis „leider ausverkauft“ / (b) Vorbestellung mit Vorlauf 1 Tag. **Empfehlung: (a) nicht bestellbar** — passt zu „nur solange Vorrat“, kein Nachschub-Versprechen, einfacher.
2. **Wo ist die Bestandsführung?** *(Stand 20.11.: Standard unbegrenzt, siehe Entscheidung 13)* Pro Korb **und** Weinvariante (gepflegt als `stock_qty` je Variante, Korb-Summe abgeleitet) oder nur pro Korb. **Empfehlung: je Weinvariante** (Wein ist die knappe Ressource; Datenmodell steht, Admin-Aufwand gering).
3. **Auslegung der Taxi-Staffel:** „erste 7 km 2,70 €, jeder weitere km 2,50 €“ = nur die km ab 7 kosten 2,50 € (10 km = 26,40 → **27 €**) oder ganze Strecke 2,50 € ab 7 km (= 25 €)? **Empfehlung: Staffel anteilig (erste 7 km 2,70 €, Rest 2,50 €)** — entspricht der Antoine-Formulierung und dem Taxitarif.
4. **Zahlungsart „vor Ort bezahlen“** (bei Abholung) *(entschieden: ja, mit Double-Opt-in statt CAPTCHA, Entscheidung 10)*: zulassen? Bedeutet: keine Stripe-Vorab-Zahlung, Bestand nur per Hold/Reservierung bis zur Abholung (Verfall?), No-Show-Risiko. **Empfehlung: zunächst nur online (Stripe)**; „vor Ort“ später, wenn Bedarf messbar.
5. **MwSt.-Aufteilung je Korb** (7 % Speisen / 19 % Wein / Korb-Verpackung) und Satz für die Liefergebühr — **Steuerberater klären lassen, bevor `vat_split` befüllt wird** (Voraussetzung für Rechnung). Empfehlung: Anteile nach Warenwert der Bestandteile.
6. **Widerrufsrecht:** Körbe mit vollem 14-Tage-Widerruf anbieten (rechtssicher, Rücksendung unangenehm bei Wein/Lebensmitteln) oder Anwaltsprüfung, ob ein Ausschluss greift. **Empfehlung: Anwaltsprüfung der Teil-C2-Texte vor Livegang**, Planung mit Widerrufsrecht.
7. **IT/FR-Besucher:** Shop kennt nur DE/EN. Empfehlung: IT/FR-Knöpfe führen in den **EN**-Shop (Hinweis „Bestellung auf Deutsch/Englisch“) statt Shop-Übersetzung in IT/FR jetzt.
8. **Erstattung/Storno-Bestand:** nach Erstattung Bestand automatisch zurück oder manuell im Admin? **Empfehlung: manuell** (Ware kann beschädigt/verbraucht sein), Hinweis im Admin-Dialog.
9. **Korb-Übersichtsseite auf events-storia.de indexieren?** Empfehlung: **`noindex` + Canonical auf ristorantestoria.de**, um die Marken-Kannibalisierung (siehe `docs/KONZEPT-SEO-FIXES.md`) nicht zu verschärfen.
10. **Betreiber-Mail bei neuem Shop-Kauf (MAESTRO):** Empfänger **`info@ristorantestoria.de`** (Empfehlung) — weitere Adresse(n) z. B. info@events-storia.de möglich; gilt für **alle** Shop-Käufe (Catering, Gutscheine, Körbe). In events-storia geht die Betriebsmail bereits an `info@events-storia.de` → Doppelmail vermeiden oder bewusst beibehalten? **Empfehlung:** beides behalten, solange die MAESTRO-Mail neu ist; nach 4 Wochen Doppelung prüfen.

(Nicht mehr offen, entschieden: Preise, Lieferpreisformel, Rundung auf volle Euro, kein Gebietslimit, Taxi-Staffel nur für Körbe, Neuer-Tab-Link, Stripe online, Vorlauf 1 Tag Lieferung, Abholung sofort bei Vorrat.)

---

## 8. MAESTRO: Anzeige + Benachrichtigung für ALLE Shop-Käufe (Einheit M, Repo `maestro-cloud`)

**Befund:** Der Webhook liefert heute nur Summen; im Admin sind Shop-Käufe nicht als solche erkennbar, keine Positionen, kein Zähler, keine Betreiber-Mail.
**Erweiterung (expand-only, rückwärtskompatibel — Altpayloads bleiben gültig):**
- **Payload (events-storia, `_shared/maestroHandoff.ts` `buildOrderPayload` + Aufrufer):** optionale Felder `orderKind` (`catering|voucher|gift_basket`), `lines[]` (`name, variant, qty, unitCents, vatRate`), `handover` (`pickup|delivery`), `handoverDate/Time`, `deliveryAddress`, `deliveryFeeCents`, `paymentStatus`, `giftMessage`, `ageConfirmed`. Body-Limit 20 KB reicht (Zod `.max()` auf Zeilen, max. ~50). Handoff erst **nach** Zahlung enqueued (bestehendes Verhalten) — Quelle für Catering: `catering_orders`-Zeile im Webhook, für Gutscheine: `vouchers`, für Körbe: `gift_orders`.
- **Zod-Schema `shop-order.ts` + SD-Funktion `ingest_shop_order`:** neue optionale Felder entgegennehmen und in neue Tabelle schreiben (Migration, eigener PR, Nummer prüfen): `shop_orders` (`tenant_id, source_system, source_order_id UNIQUE, order_number, kind, event_id` (Verknüpfung zur bestehenden `events`-Zeile), `customer_*, handover, handover_date/time, delivery_address, delivery_fee_cents, total_cents, payment_status, gift_message, lines jsonb, seen_at null, created_at`) + RLS (Tenant). Idempotenz bleibt über `shop_provider_events`.
- **Admin-UI (`apps/web`):** neue Seite „Shop-Bestellungen“ (Liste, Neu-Markierung per `seen_at`, Zähler/Badge in der Navigation, Detail mit Positionen/Kunde/Übergabe/Tag/Zahlstatus, Link zur Veranstaltung, Filter nach Art/Status); Mandanten-Navigation nach bestehendem Muster (`pages/` + Router).
- **Betreiber-Mail:** im Intake nach Commit best-effort („blockiert den Eingang nie“) über den bestehenden Mailer (`resolveMailer`, Muster `lib/public-inquiry.ts#sendInquiryIntakeMails`): Betreff „Neuer Shop-Kauf: <Art> <Nr> – <Betrag>“, Inhalt Positionen, Kunde, Übergabe, Tag. **Freigabe-Regel beachten:** MAESTRO versendet keine Mail ohne Freigabe (Antoine 11.08.2026, `docs/KONZEPT-FREIGABE-VOR-VERSAND.md`); Mail an den **Betreiber selbst** ist Systembenachrichtigung (Klasse wie Betriebsbenachrichtigung der Anfrage) — **vor Umsetzung mit GATE-F1-Klassifizierung abgleichen**. Empfänger aus `tenant_settings` (neues Feld `shop_order_notify_emails`), Standard `info@ristorantestoria.de` (Entscheidung 10). Dedupe: Mail nur beim echten Insert, nicht bei `deduped`.
- Bestellungen mit Altform (nur Summen, vor dieser Erweiterung) bleiben sichtbar (`kind` unbekannt, `lines` leer).

---

## 9. Umsetzungs-Einheiten (je 3–5 Schritte; Migrationen als eigener PR; Commit je Schritt, PR am Einheitsende)
Reihenfolge: **S1 → S2 → S3 → S4 → (R parallel ab S1) → M parallel (anderes Repo) → S5**.

**Einheit S1 — Migrationen Körbe (eigener PR, events-storia, Lovable spielt ein)** · Aufwand 1 Tag
1. Tabellen `gift_*` + RLS + Soft-Delete; 2. RPCs `gift_public_catalog/reserve/consume/release` + Sweep; 3. Seed-Datei (3 Körbe, je 2 Varianten, leere LMIV-Felder, Bestand 0); 4. `supabase gen types`/`types.ts` nachziehen; 5. SQL-Tests (Überverkauf-Race: zwei parallele Reserve-Aufrufe auf letzten Korb).

**Einheit S2 — Edge Functions + Webhook** · Aufwand 2–2,5 Tage
1. `gift-delivery-quote` (ORS, Staffel + Aufrunden, Unit-Tests der Preisfunktion mit den Beispielen aus 3.3); 2. `create-gift-order` (Validierung, Neuberechnung, Hold, Stripe mit `expires_at`); 3. Webhook-Zweig `gift_basket` + `expired`-Freigabe + Idempotenz; 4. `create-lexoffice-invoice` um Satz je Position erweitern (Catering-Regressionstest); 5. `send-gift-order-notification` (Kunde + Betrieb). *Kein Eingriff in `calculate-delivery`.*

**Einheit S3 — Shop-Frontend** · Aufwand 3 Tage
1. Routen + `useGiftCart` + Übersichtsseite/Konfigurator mit Deep-Link-Parser; 2. Kasse (Kontakt, Übergabe, Terminwähler mit Sperrtagen/„sofort“, Adresse + Live-Quote „voraussichtlich“); 3. Grußkarte, Alterscheckbox, AGB/Widerruf, Button „zahlungspflichtig bestellen“, Fehlerzustände (ausverkauft, Hold abgelaufen); 4. Danke-/Abbruchseite, DE/EN-Texte, GA4-Events; 5. Browser-Test Ende-zu-Ende gegen Stripe-Testmodus (`is_test`).

**Einheit S4 — Admin events-storia** · Aufwand 1,5–2 Tage
1. Körbe/Varianten/Bestand/Bestandteile-LMIV-Editor; 2. Bestellliste + Detail + Statuswechsel + Lieferzettel/Druck; 3. Sperrtage + Einstellungen (Tarif, Fenster); 4. Bestand wieder einbuchen bei Storno.

**Einheit S5 — Recht & Livegang** · Aufwand 1–1,5 Tage (+ Wartezeit auf Antoine/Fachleute)
1. AGB-Teil „Geschenkkörbe“ + Anpassung § 8, Widerrufsbelehrung/Muster-Formular, Datenschutz (ORS), Lebensmittelhinweise; 2. LMIV-Daten aus Etikettenfotos erfassen + Gegenlesen; 3. Steuerberater-Antwort einpflegen (`vat_split`); 4. Testbestellung live (Abholung + Lieferung, Erstattung), Bestand setzen, Katalog aktivieren.

**Einheit R — Landingpage ristorantestoria.de (Repo `ristorantestoria.de`)** · Aufwand 2–3 Tage
1. Seite `/geschenkkoerbe-muenchen/` in 4 Sprachen nach Mockup (Route, `slugs.json`, Translations, eager import, SEO/hreflang/JSON-LD Product/Offer); 2. Auswahl/Anzahl-UI, Knopf = Deep-Link in neuen Tab (`target="_blank" rel="noopener"`, UTM), IT/FR → EN-Shop; 3. Preise/Verfügbarkeit: Prerender-`fetch` auf Shop-Katalog oder statisch + Abgleichtest (CORS-Eintrag `ristorantestoria.de` in `_shared/cors.ts` — Teil von S2, falls Live-Fetch); 4. KI-Bild-Register (`docs/KI-BILDER-KENNZEICHNUNG.md`), Prerender-Verify (`dist` ohne „Laden…“), Buchungswege-Regel (Körbe ab 10 Stück → MAESTRO-Anfrage); 5. Sitemap/Interne Links, GSC-Indexierung.

**Einheit M — MAESTRO Shop-Bestellungen (Repo `maestro-cloud`; Migration als eigener PR zuerst)** · Aufwand 2,5–3 Tage
1. Migration `shop_orders` (+ RLS, `tenant_settings.shop_order_notify_emails`) und Erweiterung `ingest_shop_order`; 2. Zod-Schema/Route `shop-order.ts` + Tests (Altpayload bleibt gültig, neue Felder, Idempotenz); 3. Betreiber-Mail über Mailer (Freigabe-Klassifizierung klären, best-effort, nur bei echtem Insert); 4. Admin-Seite „Shop-Bestellungen“ + Neu-Zähler/Badge; 5. Gegenstück in events-storia (`buildOrderPayload` + Aufrufer im Webhook, eigener kleiner PR dort, **nach** M-Deploy, hinter `MAESTRO_HANDOFF_ENABLED`) — wirkt für Catering, Gutscheine und Körbe.

**Gesamt:** ca. 13–16 Arbeitstage Entwicklung (S1 1 · S2 2,5 · S3 3 · S4 2 · S5 1,5 · R 2,5 · M 3), parallelisierbar auf ~9–10 Kalendertage; Engpässe außerhalb: Etikettenfotos/LMIV (Antoine), Steuerberater, Anwaltsprüfung AGB/Widerruf, Lovable-Einspielung der Migrationen/Functions.
**Spätere Stufe (nicht Teil davon):** Umzug nach MAESTRO (siehe `maestro-cloud/docs/KONZEPT-geschenkkoerbe.md`): Datenmodell `gift_*` und Preislogik sind so geschnitten, dass sie 1:1 nach `shop_products`/`shop_delivery_tariff` wandern können; die `shop_orders`-Tabelle aus Einheit M ist dann schon da.

## 10. Risiken (kurz)
- **Überverkauf:** nur über `FOR UPDATE` in der RPC + Hold-Ablauf sauber; Test mit Parallel-Aufruf (S1).
- **Client-Beträge:** im Catering-Checkout heute möglich — für Körbe ausgeschlossen (alles serverseitig); Catering-Lücke separat notieren (Folgeaufgabe, nicht Teil dieses Konzepts).
- **ORS-Ausfall:** dann Lieferung nicht bestellbar mit Hinweis „Abholung oder Anruf“ — nie einen geschätzten Preis berechnen; Tageskontingent/Preise bei ORS vor Livegang prüfen.
- **Lovable:** Migrationen/Functions nur als Dateien; Reihenfolge Migration → Functions → Frontend einhalten, jede Einheit einzeln deploybar.
- **Webhook-Zweig:** Änderung an `handle-stripe-webhook` (2.584 Zeilen, kritisch) minimal halten, Regressionstest für `catering`/`voucher`-Zweige.

## Entscheidungen Antoine (20.11.2026)
1. Ausverkauft (Korb oder Weinvariante) → nicht bestellbar, Hinweis „leider ausverkauft“.
2. Bestand je Weinvariante; IT/FR-Besucher in den EN-Shop; Bestand nach Erstattung manuell; Korb-Seite auf events-storia.de noindex + Canonical auf ristorantestoria.de (Standard-Empfehlungen, keine Einwände).
3. Bezahlung: online (Stripe) UND vor Ort bei Abholung. Bei „vor Ort“ wird der Bestand bis zur Abholung reserviert – Haltedauer noch offen.
4. Widerruf: Antoine möchte Widerruf nur bis zur Abholung. Rechtslage (§ 356 Abs. 2 BGB): Frist beginnt erst mit Erhalt der Ware → Anwalt muss klären, ob/wie ein Ausschluss für Teile (verderblich, versiegelt) greift. Bis dahin mit Widerrufsrecht planen.
5. Betreiber-Mail bei jedem neuen Shop-Kauf (MAESTRO): NUR an info@events-storia.de (keine zusätzliche Adresse).
6. Taxi-Staffel anteilig (erste 7 km 2,70 €/km, nur Mehr-km 2,50 €/km), min. 5,90 €, ~~aufrunden auf volle Euro~~ (ersetzt durch Entscheidung 11: exakt auf den Cent), einfache Strecke, kein Gebietslimit.
7. Reservierung bei „vor Ort zahlen“: bis Ende (Ladenschluss = 01:00 Uhr in der Nacht nach dem Abholtag) des gewählten Abholtags, **aber erst nach E-Mail-Bestätigung (Entscheidung 10)**; danach automatisch zurück in den Bestand + kurze Mail an den Kunden.
8. Widerruf: Antoine klärt mit dem Anwalt selbst; bis dahin mit Widerrufsrecht planen.
9. ~~Widerruf nur bis zur Abholung/Übergabe~~ — **ersetzt (Inhaber 20.11.2026, Entscheidung 17)**.
10. **Nie CAPTCHA** (Inhaber 20.11.2026): Cloudflare Turnstile ist komplett ausgebaut. „Vor Ort zahlen“ = **E-Mail-Bestätigung (Double-Opt-in)**: Bestellung `awaiting_confirmation`, Bestand nur **30 Min** gehalten; Mail mit Bestätigungslink (Token 256 Bit, nur SHA-256-Hash in der DB, einmalig einlösbar; Einlösen per Klick auf der Seite `/geschenkkoerbe/bestaetigen`, nicht schon beim Öffnen); erst danach `reserved` mit Hold bis Ladenschluss (01:00 Uhr Folgetag). Unbestätigte verfallen (pg_cron-Sweep + lazy). Die Bestätigungsmail enthält **keinen frei wählbaren Absendertext** (Name nur bereinigt und auf 20 Zeichen gekürzt, keine Notiz, keine Grußkarte, keine Adresse) — kein Spam-Relais. Zusätzlich Honeypot-Feld und Mindest-Ausfüllzeit 3 s (Client-Zeitstempel, serverseitig plausibilisiert). Limits: 14 Tage im Voraus, max. 5 Körbe, max. 2 offene Bestellungen je E-Mail und je IP (DB-gestützt, abgelaufene zählen nicht); Online-Zahlweg: max. 2 offene Checkout-Holds je E-Mail/IP, max. 10 Körbe je Bestellung. IP nur als Hash, nach Abschluss der Bestellung gelöscht.
11. **Taxitarif exakt, kein Runden** (Inhaber 20.11.2026): erste 7 km 2,70 €/km, darüber 2,50 €/km, kaufmännisch auf den Cent, Minimum 5,90 €. 2,3 km → 6,21 €; 2,0 km → 5,90 €; 10 km → 26,40 €.
12. **Stripe:** kein separater Test-Schlüssel; Testmodus nur mit `sk_test_` (bestehende Logik bleibt).
13. **Bestand standardmäßig unbegrenzt** (Inhaber 20.11.2026, Körbe werden nachgemacht). Betreiber stellt im Admin je Variante um: unbegrenzt / ausverkauft / feste Menge (`gift_set_stock_mode`); bei unbegrenzt keine Mengenprüfung, kein Abzug, keine Stückzahl im Shop.
14. **Lebensmittelangaben: Schätzungen reichen vorerst.** Kein serverseitiges Blockieren wegen `lmiv_verified_at`; der Shop zeigt die Angaben normal mit dem Hinweis „nach bestem Wissen; maßgeblich ist das Etikett“ + Kontakt für Allergen-Fragen. Freigabe-Flag nur noch als Server-Env `GIFT_LEGAL_APPROVED` (Edge Function `gift-shop-config` reicht den Status ans Frontend). Pralinen = Lindt Lindor (Milch) + Lindt Nuxor (Haselnuss-Nougat): Milch, Soja, Schalenfrüchte (Haselnüsse), Gluten (Gerstenmalz). Die rote Dose ist ein **Pandoro Antica Ricetta** (1 kg; Gluten/Weizen, Eier, Milch; Quelle https://www.brclassics.com/products/p/01808); „V&S Frutti di Bosco“ war ein KI-Bildartefakt.
15. **Ablauf-Sweep** (pg_cron): `gift_sweep_expired_holds` alle 5 Min (SQL), Edge Function `gift-expire-reservations` alle 10 Min (Mails „abgelaufen“, Wiederholung fehlgeschlagener Bestätigungs-/Rechnungsmails, max. 3 Versuche, danach Betreiber-Alarm; einmalig Vault-Secret `gift_cron_secret` + Function-Secret `GIFT_CRON_SECRET`).
16. Refund/Dispute spiegeln auf `gift_orders` (voll erstattet → `refunded` + Notiz; Teil-Erstattung/Dispute nur Notiz); Bestand wird nicht automatisch zurückgebucht (Admin „Bestand wieder einbuchen“, idempotent).
17. **Widerruf:** Bei Geschenkkörben gilt das gesetzliche Widerrufsrecht (14 Tage ab Erhalt), der Kunde trägt die Rücksendekosten; Ausnahme geöffnete versiegelte Lebensmittel (§ 312g Abs. 2 Nr. 3 BGB). Kurzhinweis im Shop/in den Mails (`GIFT_TEXTS.withdrawal`) mit Link auf Widerrufsbelehrung und AGB § 41; keine Verzichts-Checkbox.

---

## 11. Integration in den regulären Catering-Shop (Stand 21.11.2026)

Auftrag Antoine 21.11.2026: „nichts neues erfinden“ – Körbe werden ein normaler Teil des Catering-Shops
(ein Warenkorb, ein Checkout). Der getrennte Korb-Shop bleibt live, bis I1 live ist.

### 11.1 Entscheidungen Antoine (21.11.2026, verbindlich)
18. **Eigene Kategorie „Geschenkkörbe“** im Shop-Menü (Navigation, Startseiten-Raster), neben den Catering-Kategorien.
19. **Gemischter Warenkorb = „getrennt behandeln“:** Mindestbestellwert/Aufschlag und 24-h-Vorlauf gelten nur für den
    Catering-Anteil; Körbe ohne Aufschlag. **Ein** Liefertermin (Catering-Termin). **Liefergebühr = nur die normale
    Catering-Liefergebühr** (`calculate-delivery`), Körbe fahren ohne Aufpreis mit.
20. **Reine Korb-Bestellung** = unverändert wie Korb-Shop: Abholung sofort bei Vorrat, Lieferung ab Folgetag, Taxitarif
    exakt auf den Cent, „Bei Abholung vor Ort zahlen“ (Double-Opt-in) **nur** hier. Catering bleibt Vorkasse (Stripe/Billie).
21. Nach dem Umbau leitet `/geschenkkoerbe/bestellung` in den normalen Shop um; Deep-Links von ristorantestoria.de
    (`?korb=&wein=&menge=`, `?pos=`) legen den Korb in den regulären Warenkorb.

### 11.2 Architektur (Grundsatz: die Korb-Engine bleibt autoritativ)
Befund (Faktenkarte 21.11.): `checkout_create_catering_order` ist anon-aufrufbar und übernimmt **alle Beträge vom Client**;
`create-catering-payment` erzeugt einen Pauschalposten; Lexoffice-Payload für Catering ohne Satz je Position (alles 7 %);
Webhook-Zweig Catering ohne `amount_total`-Abgleich. **Körbe laufen deshalb nie über die Catering-Beträge**, sondern
immer über `gift_orders` (Serverpreis, `vat_split`, Bestand/Hold, Altersbestätigung, AGB-Version).

- **Warenkorb (`CartContext`)**: `CartItem` + `kind?: 'gift_basket'`, `variantId`, `basketSlug`, `variantKey`, `vatSplit?`
  (nur Anzeige). ID `gift-<variantId>`. Preis im Warenkorb = Anzeige aus `gift_public_catalog`; maßgeblich ist der Server.
  Mischregel: Körbe + Catering erlaubt; Körbe + Event-Paket **nicht** (wie Catering vs. Event: Hinweis + leeren).
  Mengen: max. `MAX_QTY_PER_LINE`/`MAX_QTY_PER_ORDER` (10); Standardmenge beim Hinzufügen **1** (nicht 4).
  `totalPrice` bleibt Gesamtsumme; neu `cateringSubtotal` (ohne Körbe) für Mindestbestellwert/Aufschlag.
- **Kategorie-Seite** `catering.giftBaskets` (`/catering/geschenkkoerbe`, EN `/en/catering/gift-baskets` – Slugs an
  bestehendes Muster in `routes.ts` anpassen): `GiftBasketCard` + `GiftLmiv` wiederverwenden, Knopf „In den Warenkorb“
  (CartContext), Altershinweis 16. Einträge in `routes.ts`, `App.tsx` (eager), `Navigation.tsx` `shopChildren`,
  `CateringGrid.tsx`. `noindex` + Canonical auf ristorantestoria.de wie bisher (Entscheidung 2/9).
- **Checkout, Weiche nach Warenkorb-Inhalt** (in `Checkout.tsx` ganz oben, kein Umbau des Catering-Formulars):
  - **nur Körbe** → Komponente `GiftCheckout` = der Kassen-Teil aus `GiftOrder.tsx`, herausgelöst (Kontakt, Übergabe,
    Termin, Adresse + Quote, Grußkarte, Alter, AGB, Zahlweise online/vor Ort) – Datenquelle CartContext statt
    `useGiftCart`; ruft unverändert `create-gift-order`. Danke-/Bestätigungsseiten bleiben.
  - **Catering + Körbe** → bestehendes Catering-Formular, ergänzt um: Korb-Zeilen im Überblick (Satz-Anzeige 7/19 %
    aus `vat_split`), Grußkarte, Altersbestätigung 16, Hinweis „Körbe werden mit dem Catering geliefert/abgeholt“.
    Aufschlag/Mindestbestellwert nur auf `cateringSubtotal`. Liefergebühr unverändert `calculate-delivery`.
  - **nur Catering** → unverändert (Regressionsschutz).
- **Mischbestellung serverseitig** (eine Zahlung, zwei Datensätze, verknüpft):
  1. `create-gift-order` erweitert um Modus `handover: 'with_catering'` + `catering_order_number`: Serverpreise,
     `vat_split`, Hold wie bisher; **Liefergebühr 0**, Termin = Catering-Termin (nur Sperrtage prüfen, keine
     Korb-Vorlaufregel, da Catering ≥ 24 h strenger ist); **keine eigene Stripe-Session**, kein „vor Ort“; Status
     `pending`, Spalte `catering_order_number` (Migration, expand-only). Hold-Dauer ≥ Catering-Session-Dauer.
  2. Catering-Order wie bisher per RPC (Korb-Zeilen **nicht** in `items`, nicht in `total_amount`).
  3. `create-catering-payment` (rückwärtskompatibel, optionales `giftOrderNumber`): lädt `gift_orders` serverseitig
     (gleiche E-Mail, Status `pending`, verknüpft), hängt Korb-Positionen als **eigene** Stripe-Line-Items mit
     **Serverbetrag** an, setzt `expires_at` (31 Min) nur wenn Körbe dabei, Metadaten `gift_order_id`.
     Billie bei Mischkorb: zulässig (Vorkasse-Regel Catering) – Stripe-Line-Items unverändert.
  4. Webhook `handleCateringPayment`: danach, wenn `metadata.gift_order_id` → bestehende Korb-Logik (Abgleich
     **Korb-Anteil** gegen `total_cents`, `gift_consume_stock`, Status `paid`, Korb-Mail, `ensureGiftInvoice`).
     `checkout.session.expired`/fehlgeschlagen → `gift_release_stock` wie bei reinen Körben.
  5. Rechnungen: **zwei Lexoffice-Rechnungen** (Catering 7 % wie bisher, Korb mit `vat_split`) – Empfehlung, siehe 11.4.
- **Deep-Link-Umleitung** `/geschenkkoerbe/bestellung` (+ `/en/…`): `parseDeepLink` + `resolveDeepLink` gegen den
  Katalog → Positionen in CartContext (Menge **setzen**, nicht addieren → behebt „Menge 2“-Fehler) → Weiterleitung
  auf `/checkout` (bzw. Kategorie-Seite mit offenem Warenkorb, wenn keine gültige Position). Hinweise (`notes`) als Toast.
  `/geschenkkoerbe` → Kategorie-Seite. `?cancelled=1` → Checkout mit erhaltenem Warenkorb.
- **Kleintexte:** „Online bezahlen (Karte u. a. über Stripe)“ → „Online bezahlen per Karte über Stripe“.

### 11.3 Was ausdrücklich NICHT Teil dieser Einheiten ist
- Serverseitige Neuberechnung der **Catering**-Preise (bekannte Lücke, betrifft laufenden Umsatz) → eigene Einheit I3
  nach I2, mit eigenem Gegencheck. I1/I2 verschärfen die Lücke nicht (Korb-Beträge kommen nie vom Client).
- Admin-Zusammenführung Catering-/Korb-Bestellungen (bleiben getrennt; Korb-Detail zeigt „mit Catering #…“).

### 11.4 Entscheidung Rechnung
22. **Entschieden (Antoine 21.11.2026): zwei Rechnungen** bei Mischbestellung (Catering 7 % wie bisher + Geschenkkorb
    mit `vat_split`), beide in der Bestätigung genannt; eine Zahlung.

### 11.5 Einheiten (Commit je Schritt, PR am Einheitsende; Migration eigener PR zuerst)
**I0 – Migration (eigener PR):** `gift_orders.catering_order_number text null` + Index; `handover`-Check um
`'with_catering'` erweitern; RPC-Anpassungen falls `handover` dort geprüft wird. Lovable spielt ein.
**I1 – Körbe im regulären Shop, nur-Korb-Checkout:** CartItem-Erweiterung + Mischregeln; Kategorie-Seite + Navigation/
Raster; `GiftCheckout` aus `GiftOrder.tsx` herauslösen, Checkout-Weiche „nur Körbe“; Deep-Link-Umleitung + Mengenfehler;
Text „per Karte“. Live-Test: Deep-Link → Warenkorb → Abholung vor Ort + Online bis Stripe-Seite.
**I2 – Mischwarenkorb:** `create-gift-order` Modus `with_catering`; Checkout-Ergänzungen (Korb-Zeilen, Alter, Grußkarte,
`cateringSubtotal`); `create-catering-payment` optional `giftOrderNumber`; Webhook-Zweig + expired; Deno-Tests
(Preis-/Steuer-/Abgleich-Logik als reine Funktionen). Live-Test bis Stripe-Seite (Mischkorb).
**I3 – Catering-Preise serverseitig** (separat, später).

Prüfung: Sonnet baut, unabhängige Gegenprüfung (Opus) für Zahlung/Steuer/Bestand vor jedem Merge; Regressionstest
„nur Catering“ (Payload an RPC und `create-catering-payment` byte-gleich zu vorher, wenn keine Körbe im Warenkorb).
