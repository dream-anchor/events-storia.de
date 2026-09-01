# KONZEPT — SEO/GEO-Fixes nach dem Search-Audit vom 01.09.2026

## Ausgangslage

Vollständiger GSC-Deep-Dive am 01.09.2026 (Export: `~/Downloads/01_DOCUMENTS/SEO/events-storia.de/2026-09/2026-09-01_01`,
Artifact: `events-storia.de Search Audit`). Kernbefund: nicht Content oder Rankings sind der Flaschenhals,
sondern (a) eine Indexierungslücke über praktisch das gesamte Cluster-System inkl. beider
Kontaktformular-Seiten, (b) eine technische Vermischung der Markenentität mit ristorantestoria.de,
(c) Structured-Data-Fehler auf genau den Top-Landingpages.

**Ziel dieses Loops:** mehr qualifizierte Lead-Anfragen (Kontakt/Angebot/Checkout) über organische
Suche + GEO. Nicht Ziel: Content-Rewrites, GA4-Conversion-Tracking (spätere Phase, siehe Roadmap
im Audit-Artifact).

## Scope

Vier von Antoine freigegebene Maßnahmenblöcke, in dieser Reihenfolge (Abhängigkeiten beachten):

1. **P0 — Structured-Data-Fehler** (reine Bugfixes, keine Abwägung nötig)
2. **P1 — Markenkonzept STORIA Catering vs. Ristorante Storia** (Entity-Disambiguierung)
3. **P2 — URL-Kanonisierung** (Grundlage für P3: neue interne Links sollen kanonische URLs treffen)
4. **P3 — Interne Verlinkung stärken** (adressiert die Crawl-Budget-Ursache der Indexierungslücke)
5. **P4 — Indexierung bei Google beantragen** (erst NACHDEM P3 deployed ist — sonst wird für
   schlecht verlinkte Seiten beantragt, die dann wieder rausfallen)

Nicht in diesem Loop: GBP-Einträge (externe Kontoeinstellung, kein Code), GA4-Conversion-Tracking,
Content-Rewrites der Cluster-Seiten selbst.

---

## P0 — Structured-Data-Fehler: exakte Ursachen (bereits im Code verifiziert, 01.09.2026)

Alle drei Fehler sitzen in `src/components/StructuredData.tsx`.

### P0.1 — Review-Snippets: „Ungültiger Objekttyp für Feld parent_node"

Betroffen: `/en/catering-prices-munich/`, `/catering-lieferservice-muenchen/`,
`/en/catering-delivery-service-munich/`, `/en/trade-fair-catering-munich/`,
`/en/party-service-munich/` — die 4 Seiten `CateringPreiseMuenchen.tsx`,
`CateringLieferserviceMuenchen.tsx`, `PartyserviceMuenchen.tsx`, `MesseCateringMuenchen.tsx`,
alle mit `<StructuredData type="service" ... />`.

**Ursache:** `serviceSchema` (Zeile ~345–362) hängt `aggregateRating` direkt an einen Knoten mit
`'@type': 'Service'`. Google akzeptiert `Service` nicht als Parent-Typ für Review-Rich-Results
(nur Product/LocalBusiness/Organization u.ä.) — daher der Validierungsfehler.

**Fix:** `aggregateRating` aus `serviceSchema` entfernen. Die Business-weite Bewertung lebt bereits
korrekt auf `cateringBusinessSchema`/`organizationSchema` (type="localbusiness"), die Service-Seiten
brauchen keine eigene.

### P0.2 — Merchant Listing: „Feld brand doppelt" (25 Pizza-Artikel, `/catering/pizze-napoletane/`)

**Ursache:** Zwei unabhängige Schema-Builder feuern beide bei `type === 'product'`:
- `itemListSchema` (Zeile ~390, Bedingung `type === 'itemlist' || type === 'product'`) — jedes
  Produkt als `ListItem.item` mit `@id: #product-${sku}` und eigenem `brand`.
- `productSchemas` (Zeile ~477) — dieselben Produkte nochmal als eigenständige `<script>`-Blöcke
  mit **derselben** `@id` und ebenfalls eigenem `brand` (gerendert in Zeile ~582 bei
  `type === 'product'`).

Google sieht dasselbe Produkt (gleiche `@id`) zweimal deklariert, je mit `brand` → „doppelt".

**Fix:** Bedingung von `itemListSchema` auf `type === 'itemlist'` verengen (Zeile 390), damit bei
`type === 'product'` nur noch `productSchemas` feuert. Alternative (falls `itemlist` nirgends mehr
gebraucht wird): `productSchemas` als einzige Quelle behalten, `itemListSchema` nur noch für echte
Übersichtsseiten ohne Einzelprodukt-Schema nutzen. **Vor dem Fix prüfen**, ob eine Seite `type="itemlist"`
tatsächlich verwendet (`grep -rn 'type="itemlist"' src/pages`) — falls nicht, ist die Verengung
gefahrlos.

### P0.3 — Merchant Listing: fehlende Offer-Felder (dieselben 25 Artikel)

`hasMerchantReturnPolicy`, `shippingDetails`, `validFrom` fehlen im `offers`-Objekt von
`productSchemas` (Zeile ~488–500). Pflichtfelder für Google Merchant Listings ohne die keine
Produkt-Rich-Snippets erscheinen.

**Fix:** in `offers` ergänzen — Rückgaberecht/Versand/Gültigkeit spiegeln, was auf der Website und
in den AGB (`AGBCatering.tsx`) ohnehin steht (keine neuen Geschäftsentscheidungen, nur Schema
nachziehen).

---

## P1 — Markenkonzept: STORIA Catering vs. Ristorante Storia

### Der Befund, der die Kannibalisierung technisch erklärt

`Index.tsx` (Homepage, `/` — die mit Abstand klickstärkste Seite: 106 Klicks/5.533 Impr.) rendert
`<StructuredData type="restaurant" faqItems={faqItems} />`. Das lädt `restaurantSchema`
(Zeile ~118–150): `'@type': 'Restaurant'`, `'@id': '#restaurant'`, **`sameAs` verweist auf
`instagram.com/storia_ristorante`** (der Instagram-Account des Restaurants!), plus eine geteilte
`AggregateRating` (4.8★/890 Bewertungen). `Kontakt.tsx` dagegen nutzt bereits die saubere Variante
`<StructuredData type="localbusiness" />` → `cateringBusinessSchema` (`'@type': 'CateringBusiness'`,
kein Restaurant-Bezug, kein geteiltes Instagram).

**events-storia.de erklärt sich also auf der eigenen Homepage strukturiert als „Restaurant" und
verlinkt dort auf den Instagram-Account des Restaurants.** Für Google ist das ein starkes Signal,
beide Domains als (teilweise) dieselbe Entität zu behandeln — deckt sich exakt mit dem
Audit-Befund „storia münchen": 977 Impressionen, Position 7,19, 1 Klick.

### Konzept: Intent-Segmentierung (Antoines Vorgabe, präzisiert)

„storia münchen" / „storia" / „ristorante storia" / „storia restaurant münchen" (nackte
Marken-Suche, i.d.R. Tisch/Standort/Öffnungszeiten-Intent) → **ristorantestoria.de soll gewinnen.**
„storia catering" / „storia events" (Marke + Catering-Zusatz, bereits stark: 70,6% / 38,1% CTR)
→ **events-storia.de soll gewinnen.** Reine Catering-Keywords ohne Marke → ausschließlich
events-storia.de (unstrittig, kein Overlap).

**Wichtig:** ristorantestoria.de ist ein separates Repo/Projekt — dieser Loop fasst dort keinen
Code an. Alle Hebel hier wirken nur auf events-storia.de: das Ziel ist, dass events-storia.de
aufhört, sich selbst als Restaurant-Entität zu präsentieren, nicht ristorantestoria.de zu verändern.

### P1.1 — Homepage-Schema auf CateringBusiness umstellen

`Index.tsx`: `type="restaurant"` → `type="localbusiness"` (analog `Kontakt.tsx`), FAQ-Schema separat
über `type="faq"` nachziehen (Kontakt.tsx macht exakt das als Vorbild: drei `<StructuredData>`-Aufrufe
nacheinander). **Vorher `localBusinessSchema` (Zeile ~230, `'@type': ['LocalBusiness',
'CateringBusiness', 'Restaurant']`) mit `cateringBusinessSchema` (Zeile ~269) vergleichen** — beide
tragen ähnliche Business-Daten, aber nur `localBusinessSchema` hat `'Restaurant'` explizit im
Type-Array. Falls `restaurantSchema` und `localBusinessSchema` nach dem Umbau nirgends mehr referenziert
werden, als toten Code markieren (nicht in diesem Loop löschen, nur vermerken).

### P1.2 — `sameAs`-Verweis auf das Restaurant-Instagram prüfen

Wo immer `instagram.com/storia_ristorante` auf events-storia.de-Seiten als `sameAs` auftaucht:
entfernen oder durch den eigenen Catering-Account ersetzen, falls vorhanden — sonst weglassen statt
falsch verlinken. `grep -rn "storia_ristorante" src`.

### P1.3 — Title/Meta/Schema-Namen konsistent „STORIA Catering"

`llm-de.html`/`llm-en.html` nutzen bereits „STORIA Catering" korrekt. Stichprobe der übrigen
SEO-Landingpages (`src/pages/seo/*.tsx`) und `organizationSchema`/`websiteSchema` in
`StructuredData.tsx`: wo nur „STORIA" ohne Zusatz als `name` steht, auf „STORIA Catering" bzw.
„STORIA Events & Catering München" vereinheitlichen — Entity-Disambiguierung für Google.

### Nicht in diesem Loop (Prüfaufträge an Antoine, kein Code)

- **GBP-Insights** für „storia münchen" gegenprüfen: klären, welches Google-Business-Profil dort
  tatsächlich erscheint und ob es korrekt auf ristorantestoria.de zeigt.
- Falls zwei GBP-Profile existieren: Kategorien/Website-Links gegenprüfen (Restaurant-Profil →
  ristorantestoria.de, Catering-Profil → events-storia.de).

---

## P2 — URL-Kanonisierung

10 URLs als „Seite mit Weiterleitung" erfasst (größtenteils erwartbare Normalisierung), 3 als
„Alternative Seite mit richtigem kanonischen Tag" (Duplicate-Content-Signal), 1×403 auf
`/catering/`. Vor P3 klären, damit neue interne Links nicht auf Wegwerf-URLs zeigen.

- **P2.1** Trailing-Slash-Konsistenz: `scripts/generate-sitemap.ts` und interne `<Link>`/`<a>`-Ziele
  auf eine einzige Form (mit Slash, wie in der Sitemap) prüfen.
- **P2.2** `/catering/` (403 „Wegen Zugriffsverbot blockiert"): klären ob Absicht (Kategorieseite
  ohne eigenen Content, bewusst geblockt) oder Bug. Falls Bug: Route/Redirect korrigieren.

## P3 — Interne Verlinkung stärken

Startseite aktuell 8 interne Links, Unterseiten 3–4 — zu dünn für 33 Seiten Content-System.
Ziel-URLs (aus P2 kanonisiert): Anlass-Cluster (6 DE + EN-Pendants), Kulinarik-Cluster (6 DE + EN),
`/kontakt/`, `/en/contact/`, `/events/`, `/en/events/`. Sinnvolle Linkquellen: Footer (systemweit),
Homepage-Sektion „Anlässe"/„Küche", Cross-Links zwischen verwandten Cluster-Seiten (z. B.
Weihnachtsfeier-Seite verlinkt auf Buffet/Fingerfood).

## P4 — Indexierung bei Google beantragen

Tool: `~/Developer/Websites/seo.schrittmacher.ai/scripts/google-index-submit.mjs` (universelles
Cross-Projekt-Script, unterstützt `--url <einzelne-URL>` mehrfach). **Blockiert**: `scripts/service-account.json`
fehlt lokal in diesem Repo-Checkout des Tools (korrekt .gitignored, sensibles Credential). Erst
ausführbar, wenn Antoine die Datei bereitstellt oder `GOOGLE_APPLICATION_CREDENTIALS` setzt — siehe
hartes Gate in `docs/LOOP-SEO-FIXES.md`. Erst NACH P3-Deploy ausführen.

---

## Deploy-Modell dieses Repos (wichtig für die Loop-Disziplin)

`.github/workflows/deploy-ionos.yml` deployt bei **jedem Push auf `main`** automatisch per SFTP auf
die Live-Seite — es gibt **keine PR-gated CI** (kein Test-Suite-Gate). Das heißt: jeder Merge nach
`main` ist ein sofortiges Live-Deployment. Genau deshalb gilt die Bündelung aus
`~/.claude/CLAUDE.md` § „Loop-Arbeit" hier besonders streng — Beweis vor jedem Merge ist
**lokal** `bun run build` (inkl. Sitemap-Generierung) und `bun run lint`, beide grün, plus wo möglich
eine Sichtprüfung des generierten JSON-LD (z. B. via Google Rich Results Test URL-Prüfung nach Deploy,
nicht Teil des lokalen Beweises).
