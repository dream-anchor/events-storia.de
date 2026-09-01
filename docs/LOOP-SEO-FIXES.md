# LOOP — SEO/GEO-Fixes nach Search-Audit

Bauplan: `docs/KONZEPT-SEO-FIXES.md` (dort stehen die exakten Code-Ursachen — vor jedem Kriterium
lesen). Zustand hier ist der Zeiger, nicht die zweite Wahrheit: weicht dieser Log vom Konzept ab,
gilt das Konzept.

**Ziel:** mehr qualifizierte Lead-Anfragen über organische Suche + GEO, nach dem GSC-Audit vom
01.09.2026 (Artifact „events-storia.de Search Audit").

**Deploy-Modell:** Push auf `main` = sofortiges Live-Deployment (SFTP, kein CI-Gate). Bündelung
„ein PR je Einheit" gilt deshalb strikt — siehe Konzept, Abschnitt „Deploy-Modell".

---

## P0 — Structured-Data-Fehler (Bugfixes, keine Rückfrage nötig)

- [x] **P0.1** Review-Snippet-Fehler beheben: `aggregateRating` aus `serviceSchema` in
      `StructuredData.tsx` entfernen (Details: KONZEPT § P0.1).
      Beweis: `bun run build` grün + `bun run lint` grün + Diff zeigt `aggregateRating` nur noch in
      `restaurantSchema`/`cateringBusinessSchema`/`productSchemas`, nicht mehr in `serviceSchema`.
      ✓ 2026-09-01 · `bun run build` → `✓ built in 1m 14s` (Exit 0, kein Prerender-Fehler) ·
      `bun run lint` → `599 problems (512 errors, 87 warnings)` identisch zu main (Baseline-Debt,
      0 Findings in `StructuredData.tsx` – Repo-Lint war vor diesem Loop schon nicht grün, siehe
      Anmerkung unten) · `grep -n "aggregateRating" src/components/StructuredData.tsx` →
      Zeilen 137 (restaurantSchema), 264 (localBusinessSchema), 278 (cateringBusinessSchema),
      502 (productSchemas) — nicht mehr in serviceSchema (vorher Zeile 361).
- [x] **P0.2** Merchant-Duplikat beheben: `itemListSchema`-Bedingung auf `type === 'itemlist'`
      verengen, nachdem geprüft ist, ob `type="itemlist"` irgendwo verwendet wird (KONZEPT § P0.2).
      Beweis: `grep -rn 'type="itemlist"' src/pages` Ergebnis dokumentiert + `bun run build`/`lint`
      grün + generiertes JSON-LD auf `/catering/pizze-napoletane/` zeigt jede Produkt-`@id` nur
      noch einmal (manuell im Build-Output/`dist` geprüft).
      ✓ 2026-09-01 · `grep -rn 'type="itemlist"' src/pages` → **kein Treffer** (Verengung
      gefahrlos) · `bun run build` → `✓ built in 1m 0s` (Exit 0) · `bun run lint` →
      `599 problems (512 errors, 87 warnings)` identisch zur P0.1-Baseline, 0 Findings in
      `StructuredData.tsx` · Dist-Check auf `/catering/pizze-napoletane/` war in diesem
      Build-Sandbox mehrfach nicht aussagekräftig (Prerender-Puppeteer racet mit dem
      Supabase-Fetch aus `useCateringMenuBySlug`; in mehreren Läufen — auch mit unverändertem
      Code via `git stash` reproduziert — blieb `allItems` leer und die Seite fiel auf den
      generischen Homepage-`<title>` zurück, 0 Produkt-`@id`s im Snapshot; **ein Lauf mit
      Fix** traf einen Moment mit geladenen Daten (`dist/catering/buffet-fingerfood/index.html`:
      32 `ld+json`-Blöcke, 30 eindeutige Produkt-`@id`s, **keine Duplikate**). Da die Flakiness
      auch im unveränderten Code (`git stash`) auftrat, ist sie build-umgebungsbedingt, nicht
      durch diesen Fix verursacht. Stattdessen Beweis über Code-Inspektion geführt (deterministisch,
      unabhängig vom Datenfetch): `productSchemas` (Zeile ~478) und `itemListSchema` (Zeile ~389)
      erzeugen für dasselbe Produkt identisches `@id`-Format
      (`https://events-storia.de/#product-${product.sku || index}`) — vor dem Fix feuerten bei
      `type === 'product'` beide Builder parallel (exakt der in KONZEPT § P0.2 beschriebene
      „Feld brand doppelt"-Bug), nach dem Fix ist `itemListSchema` für `type === 'product'`
      strukturell `null` (Bedingung erlaubt nur noch `type === 'itemlist'`, das nirgends
      verwendet wird) — die Kollision ist damit unabhängig vom Prerender-Timing ausgeschlossen.
- [x] **P0.3** Fehlende Offer-Felder ergänzen: `hasMerchantReturnPolicy`, `shippingDetails`,
      `validFrom` im `offers`-Objekt von `productSchemas` (KONZEPT § P0.3).
      Beweis: `bun run build`/`lint` grün + Diff zeigt alle drei Felder im `offers`-Objekt.
      ✓ 2026-09-01 · `bun run build` → `✓ built in 56.90s` (Exit 0, `build` enthält laut
      `package.json` nur `sitemap`+`prebuild`+`vite build`, kein Prerender — die aus P0.2 bekannte
      Puppeteer-Flakiness betrifft `bun run prerender`, nicht diesen Beweis) · `bun run lint` →
      `599 problems (512 errors, 87 warnings)` identisch zur P0.1/P0.2-Baseline, 0 Findings in
      `StructuredData.tsx` · `git diff -- src/components/StructuredData.tsx` zeigt alle drei
      Felder neu im `offers`-Objekt von `productSchemas`: `validFrom` (heutiges Datum),
      `hasMerchantReturnPolicy` (`returnPolicyCategory: MerchantReturnNotPermitted`, da AGBCatering
      § 10 / § 312g Abs. 2 Nr. 2 BGB für leicht verderbliche Speiselieferungen kein Widerrufsrecht
      vorsieht — keine neue Geschäftsentscheidung, nur die AGB gespiegelt) und `shippingDetails`
      (`OfferShippingDetails` mit `shippingRate` 25 € — Münchner-Stadtgebiet-Satz aus AGBCatering
      § 4 —, `shippingDestination: DE`, `deliveryTime` mit `handlingTime`/`transitTime` passend zum
      bestehenden `deliveryLeadTime` von 1–3 Tagen).

## P1 — Markenkonzept STORIA Catering vs. Ristorante Storia

- [x] **P1.1** `Index.tsx`: `type="restaurant"` → `type="localbusiness"` + separater
      `type="faq"`-Aufruf (Vorbild `Kontakt.tsx`). Prüfen ob `restaurantSchema`/`localBusinessSchema`
      danach noch anderswo referenziert werden (KONZEPT § P1.1).
      Beweis: `bun run build`/`lint` grün + Diff + Vermerk, ob `restaurantSchema` toter Code wurde.
      ✓ 2026-09-01 · `bun run build` → `✓ built in 57.06s` (Exit 0) · `bun run lint` →
      `599 problems (512 errors, 87 warnings)` identisch zur P0.1–P0.3-Baseline, 0 Findings in
      `Index.tsx`/`StructuredData.tsx` · `git diff -- src/pages/Index.tsx` zeigt
      `<StructuredData type="restaurant" faqItems={faqItems} />` ersetzt durch
      `<StructuredData type="localbusiness" />` + `<StructuredData type="faq" faqItems={faqItems} />`
      (exakt Kontakt.tsx-Muster, Zeilen 61+69) · Vorab-Check StructuredData.tsx: der
      `type === 'localbusiness'`-Zweig (Zeile 555–559) rendert `cateringBusinessSchema`
      (`@type: 'CateringBusiness'`, kein Restaurant-Bezug), NICHT die gleichnamige Konstante
      `localBusinessSchema` (Zeile 228, `@type`-Array enthält `'Restaurant'`) — die wird nur vom
      `type === 'restaurant'`-Zweig (Zeile 545–553) mitgerendert. Passend zum Ziel „kein
      Restaurant-Bezug mehr auf der Homepage".
      **Toter-Code-Vermerk:** `grep -rn 'type="restaurant"' src/pages` → kein Treffer mehr (0/28
      `<StructuredData>`-Aufrufe in `src/pages` nutzen noch `type="restaurant"`, Verteilung:
      `localbusiness` ×2 [Kontakt, Index], `faq` ×3, `menu` ×3, `service` ×11, `product` ×5,
      `breadcrumb` ×1, `event` ×1). Damit ist der `if (type === 'restaurant')`-Zweig in
      `StructuredData.tsx` (Zeile 545–553) unerreichbar geworden, und die beiden Konstanten
      `restaurantSchema` (Zeile 118) und `localBusinessSchema` (Zeile 228) sind toter Code —
      **nicht gelöscht in dieser Iteration**, nur vermerkt wie im Protokoll vorgegeben.
      Nebenbefund: `bun run build` hat wie erwartet `public/sitemap.xml` und
      `src/data/static-menus.json` aus Live-Supabase-Daten neu geschrieben; beide vor dem Commit
      mit `git checkout -- public/sitemap.xml src/data/static-menus.json` zurückgesetzt
      (nicht Teil dieses Kriteriums).
- [x] **P1.2** `sameAs`-Verweis auf `instagram.com/storia_ristorante` entfernt oder durch eigenen
      Account ersetzt (KONZEPT § P1.2).
      Beweis: `grep -rn "storia_ristorante" src` Ergebnis vorher/nachher + `bun run build` grün.
      ✓ 2026-09-01 · `grep -rn "storia_ristorante" src` vorher → 2 Treffer (`StructuredData.tsx:130`
      in `restaurantSchema.sameAs`, `StructuredData.tsx:192` in `organizationSchema.sameAs`) ·
      nachher → **kein Treffer** (Exit 1) · Ersatz-Account-Prüfung: `Header.tsx`/`Footer.tsx`
      verlinken bereits `instagram.com/ristorante_storia` (anderer Handle, ebenfalls das Restaurant
      — kein Ersatz), einzig `supabase/functions/send-review-requests/index.ts` nennt
      `instagram.com/storia_muenchen` als mögliches Catering-Konto, per `WebFetch` aber nicht
      verifizierbar (Instagram liefert kein lesbares Profil ohne JS) → gemäß KONZEPT § P1.2
      „sonst weglassen statt falsch verlinken" beide `sameAs`-Arrays auf nur noch
      `facebook.com/STORIAMunich` reduziert, kein Ersatzlink geraten · `bun run build` →
      `✓ built in 49.96s` (Exit 0) · `bun run lint` → `599 problems (512 errors, 87 warnings)`
      identisch zur Baseline, 0 Findings in `StructuredData.tsx` · Nebenbefund (nicht in diesem
      Kriterium behoben, da Beweis-Scope laut Protokoll auf `src` beschränkt ist):
      `public/llm-de.html:106` und `public/llm-en.html:106` sowie `public/llm.html:488/661`
      tragen ebenfalls falsche/uneinheitliche Instagram-`sameAs`-Werte
      (`storia_ristorante` bzw. `ristorante_storia`) — Kandidat für P1.3 oder eine eigene
      Nachfolge-Iteration.
- [x] **P1.3** Title/Meta/Schema-Namen auf „STORIA Catering" vereinheitlicht, Stichprobe
      `src/pages/seo/*.tsx` + `organizationSchema`/`websiteSchema` (KONZEPT § P1.3).
      Beweis: Liste der geänderten Dateien + `bun run build`/`lint` grün.
      ✓ 2026-09-01 · Stichprobe: `organizationSchema`/`websiteSchema` in `StructuredData.tsx`
      tragen bereits `name: 'STORIA Catering & Events München'` bzw. `alternateName` mit
      „STORIA Catering"-Varianten — **kein Fund, keine Änderung nötig**. `src/pages/seo/*.tsx`
      selbst enthält keine eigenen Title/Meta-Strings (alle 12 Landingpages beziehen
      `title`/`description` über `t.seo.*` aus `src/translations/{de,en}.ts` — dort tatsächlich
      geprüft statt blind der KONZEPT-Pfadangabe vertraut, wie im Protokoll gefordert). Von
      9 bare-„STORIA"-Titeln ohne Zusatz enthalten 7 bereits „Catering" an anderer Stelle im
      selben Titel (z. B. „Fingerfood Catering München | ... – STORIA") — dort belassen, um das
      SEO-Titel-Längenlimit (<60 Zeichen, 3 davon bereits vor diesem Fix über dem Limit) nicht
      zusätzlich zu verschlechtern für keinen zusätzlichen Disambiguierungs-Nutzen. Echte Funde
      (STORIA komplett ohne jeden Zusatz im String): `passwordReset.title` und
      `orderSuccess.title` in `de.ts`+`en.ts` (4 Stellen, noIndex-Utility-Seiten) →
      „STORIA" → „STORIA Catering" ergänzt. Nebenbefund-Behebung (aus P1.2 übernommen):
      `grep -rn "storia_ristorante\|ristorante_storia\|instagram.com" public/llm-de.html
      public/llm-en.html public/llm.html` → 4 Treffer, alle falsche Restaurant-Instagram-Links
      im `sameAs` (kein eigenes verifiziertes Catering-Konto, siehe P1.2) → alle 4 entfernt
      (nicht ersetzt): `llm-de.html:106`, `llm-en.html:106` (jeweils einziger `sameAs`-Eintrag,
      Property komplett entfernt), `llm.html:488` (einer von 3 Einträgen, Instagram-Zeile
      entfernt, `ristorantestoria.de`+OpenTable-Link bleiben — siehe Nebenbefund unten),
      `llm.html:661` (einziger Eintrag, Property entfernt). JSON-LD-Validität aller 3 Dateien
      nach dem Fix per `python3 json.loads()` auf jedem `<script type="application/ld+json">`-
      Block geprüft: alle 9 Blöcke (3 je Datei) weiterhin gültiges JSON. `grep` danach:
      kein Treffer mehr für `storia_ristorante`/`ristorante_storia`/`instagram.com` in den drei
      Dateien. `bun run build` → `✓ built in 47.12s` (Exit 0) · `bun run lint` →
      `599 problems (512 errors, 87 warnings)` identisch zur Baseline, 0 Findings in
      `translations/de.ts`/`translations/en.ts`/`StructuredData.tsx` · `git diff --stat` (5
      Dateien): `public/llm-de.html | 5 +----`, `public/llm-en.html | 5 +----`,
      `public/llm.html | 6 +-----`, `src/translations/de.ts | 4 ++--`,
      `src/translations/en.ts | 4 ++--` — `7 insertions(+), 17 deletions(-)`. Build-Nebenwirkung
      `public/sitemap.xml`+`src/data/static-menus.json` neu geschrieben, vor Commit mit
      `git checkout --` zurückgesetzt. **Neuer Nebenbefund für Folge-Iteration:**
      `llm.html:489-490` (Organization-Schema von „Events STORIA") enthält im `sameAs`-Array
      weiterhin `https://www.ristorantestoria.de` und einen OpenTable-Link des Restaurants —
      exakt dieselbe Domain-Konfusion wie das ursprüngliche P1.1-Problem, aber außerhalb des
      hier explizit beauftragten Instagram-Scopes (Grep-Muster traf nicht auf diese beiden
      URLs) — nicht in dieser Iteration angefasst, sondern nur vermerkt.

## P2 — URL-Kanonisierung

- [x] **P2.1** Trailing-Slash-Konsistenz zwischen Sitemap und internen Links hergestellt
      (KONZEPT § P2.1).
      Beweis: `bun run sitemap` Output + Stichprobe interner Links ohne abweichende Form.
      ✓ 2026-09-01 · Root Cause: `getLocalizedPath()` in `src/config/routes.ts` erzeugte Pfade
      OHNE Trailing Slash (`/kontakt`), während `scripts/generate-sitemap.ts` (`withTrailingSlash`)
      und die `.htaccess`-301-Regel (§0, erzwingt Slash auf JEDER Nicht-Datei-URL) MIT Slash
      arbeiten — jeder interne `<LocalizedLink>`/`<Link>`-Klick auf eine ROUTES-Seite kostete
      dadurch einen unnötigen serverseitigen 301-Hop. Zusätzlich fielen `getRouteByDePath`/
      `getRouteByEnPath`/`getAlternatePath` bei einem Pfad MIT Slash (dem echten Produktions-Fall)
      auf ihren dynamischen Fallback zurück, weil die Map-Lookups gegen Keys ohne Slash liefen —
      das produzierte einen **echten Sprachumschalter-Bug**: `getAlternatePath('/en/contact/', 'en')`
      lieferte vor dem Fix `/contact/` (keine gültige DE-Route, statt korrekt `/kontakt/`).
      Fix: `withTrailingSlash`/`stripTrailingSlash`-Helper ergänzt; `getLocalizedPath` gibt jetzt
      immer Trailing Slash zurück, `getRouteByDePath`/`getRouteByEnPath` normalisieren den Input
      vor dem Lookup, `getAlternatePath` normalisiert Input UND Output. Zusätzlich 5 hartcodierte
      interne `<a href>`/`<LocalizedLink to>`-Ziele ohne Slash gefunden und korrigiert:
      `AGBVeranstaltungen.tsx` (`/datenschutz`→`/datenschutz/`), `AGBRestaurant.tsx`
      (`/agb-gutscheine`→`/agb-gutscheine/`), `OrderConfirmationDialog.tsx`,
      `PublicOffer.tsx`, `public-offer/ContactSection.tsx` (je `/agb-veranstaltungen`→
      `/agb-veranstaltungen/`). Vorher/Nachher-Beweis (`git stash` auf unveränderten Code,
      identisches Prüfscript erneut ausgeführt):
      VORHER `getAlternatePath('/en/contact/', 'en')` → `/contact/` (Bug) ·
      NACHHER → `/kontakt/` (korrekt). `bun run sitemap` → `✓ Sitemap generated … 22 routes ×
      2 languages = 44 URLs` · `grep "<loc>" public/sitemap.xml` → alle 44 Einträge enden auf
      `/</loc>` (0 Abweichungen). `bun run build` → `✓ built in 44.09s` (Exit 0) · `bun run lint`
      → `599 problems (512 errors, 87 warnings)` identisch zur P0–P1-Baseline, 0 Findings in
      `routes.ts`/den 5 geänderten Dateien. Build-Nebenwirkungen `public/sitemap.xml` +
      `src/data/static-menus.json` vor Commit mit `git checkout --` zurückgesetzt (Sitemap-Logik
      selbst unverändert, nur `routes.ts` und 5 Link-Ziele betroffen). Scope-Hinweis: reine
      Admin-Routen (`/admin/*`) und der tote Legacy-Link `/reservierung` (existiert in keiner
      Route-Config) bewusst nicht angefasst — außerhalb des öffentlichen Content-Systems.
- [ ] **P2.2** `/catering/`-403 geklärt: Absicht dokumentiert ODER Bug behoben (KONZEPT § P2.2).
      Beweis: Fund + Entscheidung im PR-Text, ggf. Code-Diff.
      ✓ _ausstehend_

## P3 — Interne Verlinkung stärken

- [ ] **P3.1** Footer-Links zu Anlass-Cluster (6 DE + EN-Pendants) ergänzt.
      Beweis: `bun run build`/`lint` grün + Diff Footer-Komponente.
      ✓ _ausstehend_
- [ ] **P3.2** Footer/Content-Links zu Kulinarik-Cluster ergänzt.
      Beweis: `bun run build`/`lint` grün + Diff.
      ✓ _ausstehend_
- [ ] **P3.3** `/kontakt/`, `/en/contact/`, `/events/`, `/en/events/` prominent verlinkt
      (Header/Footer/Homepage-CTA).
      Beweis: `bun run build`/`lint` grün + Diff + Screenshot oder Beschreibung der Platzierung.
      ✓ _ausstehend_

## P4 — Indexierung bei Google beantragen — HARTES GATE

🔒 **Blockiert bis Antoine `scripts/service-account.json` in
`~/Developer/Websites/seo.schrittmacher.ai/scripts/` bereitstellt** (oder
`GOOGLE_APPLICATION_CREDENTIALS` setzt) **und** P3 auf `main` deployed + live verifiziert ist.
Nicht raten, nicht überspringen — bei fehlendem Credential `BLOCKED` ausgeben und im Log unten
vermerken, dann Turn beenden.

- [ ] **P4.1** `node scripts/google-index-submit.mjs --url <URL>` für die 30 betroffenen
      Cluster-URLs (Liste: Audit-Artifact „Indexierungslücke") ausgeführt.
      Beweis: Script-Output (Anzahl erfolgreich eingereicht) + Datum.
      ✓ _ausstehend_

---

## BLOCKED-Log

<!-- Format: DATUM · Kriterium · Grund · was gebraucht wird -->

- 2026-09-01 · P4.1 · `scripts/service-account.json` fehlt lokal, gitignored, kein Zugriff ohne
  Antoines Bereitstellung · benötigt: Datei am genannten Pfad oder `GOOGLE_APPLICATION_CREDENTIALS`.

## Abschluss

Sind P0–P3 vollständig abgehakt (P4 bleibt ggf. bis Credential wartend): wörtlich
`SEO-FIXES-EINHEIT-FERTIG` ausgeben und Antoine im Chat Bescheid geben (Slack nur nach 5 Min. ohne
Reaktion, siehe `~/.claude/CLAUDE.md` § „Fragen & Meldungen").
