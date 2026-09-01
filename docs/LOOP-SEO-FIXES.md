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

- [ ] **P1.1** `Index.tsx`: `type="restaurant"` → `type="localbusiness"` + separater
      `type="faq"`-Aufruf (Vorbild `Kontakt.tsx`). Prüfen ob `restaurantSchema`/`localBusinessSchema`
      danach noch anderswo referenziert werden (KONZEPT § P1.1).
      Beweis: `bun run build`/`lint` grün + Diff + Vermerk, ob `restaurantSchema` toter Code wurde.
      ✓ _ausstehend_
- [ ] **P1.2** `sameAs`-Verweis auf `instagram.com/storia_ristorante` entfernt oder durch eigenen
      Account ersetzt (KONZEPT § P1.2).
      Beweis: `grep -rn "storia_ristorante" src` Ergebnis vorher/nachher + `bun run build` grün.
      ✓ _ausstehend_
- [ ] **P1.3** Title/Meta/Schema-Namen auf „STORIA Catering" vereinheitlicht, Stichprobe
      `src/pages/seo/*.tsx` + `organizationSchema`/`websiteSchema` (KONZEPT § P1.3).
      Beweis: Liste der geänderten Dateien + `bun run build`/`lint` grün.
      ✓ _ausstehend_

## P2 — URL-Kanonisierung

- [ ] **P2.1** Trailing-Slash-Konsistenz zwischen Sitemap und internen Links hergestellt
      (KONZEPT § P2.1).
      Beweis: `bun run sitemap` Output + Stichprobe interner Links ohne abweichende Form.
      ✓ _ausstehend_
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
