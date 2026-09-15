# LOOP — Shop-Umsatz events-storia.de

Bauplan: `docs/KONZEPT-SHOP-UMSATZ.md` (dort stehen die verifizierten Ursachen — vor jedem
Kriterium lesen). Weicht dieser Log vom Konzept ab, gilt das Konzept.

**Ziel:** mehr Käufe im Shop (Katalog `/catering/*` → Kasse `/checkout`), nachrangig mehr Aufrufe.
**Ø-Bestellwert 1.232 €** — ein gewonnener Checkout schlägt jede Ranking-Verbesserung.

**Deploy-Modell:** Push auf `main` = sofortiges Live-Deployment (SFTP, kein CI-Gate). Bündelung
„ein PR je Einheit" gilt strikt.

**Beweis-Standard:** `bun run build` + `bun run lint` (Baseline: 599 problems / 512 errors /
87 warnings — identisch = grün, neue Findings in berührten Dateien = rot). `bun` ggf. über
`export PATH="$HOME/.bun/bin:$PATH"`. Build schreibt `public/sitemap.xml` und
`src/data/static-menus.json` neu — vor dem Commit mit `git checkout --` zurücksetzen, außer das
Kriterium ändert die Sitemap-Logik selbst.

---

## P7 — Kauf-Messung verifizieren 🔒 GATE: blockiert P8

- [ ] **P7.1** Reale Bestellungen 17.06.–14.09.2026 aus Supabase zählen (Zugriff **nur** über
      Composio/Konnektoren, nie 1Password) und gegen GA4 `purchase` = 2 stellen.
      Beweis: Query-Ergebnis (Anzahl + Summe) im Wortlaut, daneben der GA4-Wert.
      ✓ _ausstehend_
- [ ] **P7.2** Ergebnis bewerten und Weg festlegen — **Antoine berichten, bevor P8 startet**:
      (a) reale Conversion ähnlich schlecht → P8 wie geplant;
      (b) Käufe real deutlich höher → P8 wird Tracking-Fix (serverseitiges `purchase` aus dem
      Stripe-Webhook via Measurement Protocol), Schwerpunkt rückt zu P9/P10.
      Beweis: Entscheidung + Begründung hier eingetragen.
      ✓ _ausstehend_

## P8 — Checkout-Abbruch (erst nach P7.2)

- [ ] **P8.1** Diagnose vor Therapie: vorhandene Schritt-Instrumentierung auswerten
      (`funnel_step_view` 25 Events/4 Nutzer, `funnel_step_complete` 14/4, `funnel_drop` 6/4,
      `funnel_prefilled` 5/4) — welcher Schritt verliert die meisten Nutzer?
      Beweis: GA4-Auswertung je Schritt, benannter größter Abbruchpunkt.
      ✓ _ausstehend_
- [ ] **P8.2** Den **einen** größten Abbruchschritt beheben. Kein Blind-Umbau des Checkouts.
      Beweis: Diff + Build/Lint grün + Beschreibung, was der Nutzer jetzt anders erlebt.
      ✓ _ausstehend_
- [ ] **P8.3** Nebenbefund `remove_from_cart` (19 von 28 Warenkorb-Nutzern entfernen wieder etwas)
      prüfen: Preis-/Mengen-/Mindestbestellwert-Überraschung im Warenkorb?
      Beweis: Fund dokumentiert, Fix oder begründete Zurückstellung.
      ✓ _ausstehend_
- [ ] **P8.4** Kontaktformular: `form_start` 46 Nutzer → `generate_lead` 6 = 87 % Abbruch.
      Ursache suchen (Pflichtfelder, Validierung, Turnstile/Captcha, Fehlermeldungen).
      Beweis: Fund + Fix oder begründete Zurückstellung.
      ✓ _ausstehend_

## P9 — Prerender-Race beheben

- [ ] **P9.1** `usePrerenderReady` (`src/hooks/usePrerenderReady.ts`) feuert nicht mehr nach festem
      100-ms-Timeout, sondern erst wenn die Daten der jeweiligen Seite geladen sind. Muster aus
      `~/Developer/Websites/ristorantestoria.de/prerender.js` übernehmen (KONZEPT § P9) —
      Daten **vor** dem Render holen, je Call try/catch mit Fallback, harter `process.exit()`.
      Beweis: Diff + Build grün.
      ✓ _ausstehend_
- [ ] **P9.2** **Blast-Radius-Prüfung — der eigentliche Beweis.** Nach dem Build alle 44
      Sitemap-URLs gegen den `index.html`-Fallback-Titel prüfen. Erwartung: 0 Treffer.
      ```bash
      FALLBACK="STORIA Catering &amp; Events – Italienisches Catering München | Fingerfood, Pizza, Buffets"
      for u in $(curl -s https://www.events-storia.de/sitemap.xml | grep -oE "<loc>[^<]*</loc>" | sed 's/<[^>]*>//g'); do
        t=$(curl -s --max-time 12 "$u" | grep -oE "<title>[^<]*</title>" | head -1 | sed 's/<[^>]*>//g')
        [ "$t" = "$FALLBACK" ] && echo "FALLBACK: $u"
      done
      ```
      Ausgangswert 15.09.2026: **12 von 44** betroffen (`/en/`, `/events/`, `/en/events/`,
      `/catering/buffet-platten/` + EN, `/catering/pizze-napoletane/` + EN, `/faq-catering-muenchen/`
      + EN, `/firmenfeier-catering-muenchen/` + EN, `/pizza-catering-muenchen/`).
      Beweis: Befehlsausgabe vorher/nachher.
      ✓ _ausstehend_
- [ ] **P9.3** Startseite trägt wieder ihr vollständiges Schema (aktuell nur ein `WebPage`-Block —
      CateringBusiness/Organization/FAQ aus P0/P1 kommen im HTML nicht an).
      Beweis: JSON-LD-Typen der ausgelieferten Startseite vorher/nachher.
      ✓ _ausstehend_
- [ ] **P9.4** `/catering/pizze-napoletane/` liefert wieder 25 Produkte mit Merchant-Feldern aus
      (`brand` genau einmal je `@id`, `hasMerchantReturnPolicy`/`shippingDetails`/`validFrom` in
      `offers` — die P0.2/P0.3-Fixes sind im Code, kommen aber nicht ins HTML).
      Danach in GSC die Validierung für „Feld `brand` doppelt" (25 Elemente) starten.
      Beweis: Produkt-`@id`-Zählung im ausgelieferten HTML + GSC-Validierung angestoßen.
      ✓ _ausstehend_

## P10 — Crawl-Discovery erzwingen

- [ ] **P10.1** Interne Verlinkung **aus den tatsächlich gecrawlten Seiten** auf die 33 nie
      gecrawlten URLs. Gecrawlt werden real nur: `/`, `/en/`,
      `/en/catering-delivery-service-munich/`, `/en/party-service-munich/`,
      `/catering-lieferservice-muenchen/`, `/en/trade-fair-catering-munich/`. Nur Links von dort
      haben eine Chance, Discovery-Budget zu erzeugen.
      Beweis: Diff + Build/Lint grün.
      ✓ _ausstehend_
- [ ] **P10.2** `scripts/submit-indexnow.ts` scharf schalten (deckt Bing/Yandex ab, **nicht**
      Google) — vorhanden, bisher ungenutzt.
      Beweis: Script-Ausgabe.
      ✓ _ausstehend_
- [ ] **P10.3** Nach 14 Tagen erneut prüfen, ob sich „Zuletzt gecrawlt" der 33 URLs von
      `1970-01-01` bewegt hat. **Das ist der einzige belastbare Erfolgsnachweis für P10.**
      Beweis: GSC-Export oder `GOOGLE_SEARCH_CONSOLE_INSPECT_URL` für 4 Stichproben.
      ✓ _ausstehend_

## P11 — CTR auf Kauf-Suchanfragen (erst nach P9)

- [ ] **P11.1** Title/Description der Transaktions-Landingpages auf Kaufabsicht ausrichten
      (Preis ab, Lieferzeit, Mindestbestellwert). Betroffene Suchanfragen mit Kaufabsicht,
      zusammen ~370 Impressionen bei **0 Klicks**: „cater food delivery" (97, Pos. 8,7),
      „lieferservice catering münchen" (63, Pos. 9,0), „catering liefern münchen" (22, Pos. 10,4),
      „party pizza bestellen münchen" (18, Pos. 11,4), „catering online bestellen münchen" (11).
      Titel-Limit < 60 Zeichen beachten.
      Beweis: Diff + Build/Lint grün.
      ✓ _ausstehend_

## P12 — GEO ausbauen (erst nach P9)

- [ ] **P12.1** llms.txt-/llm-*.html-Struktur auf die Shop-Katalogseiten ausdehnen (Preise,
      Mindestbestellwert, Liefergebiet, Vorlaufzeit als Fakten). Begründung: „AI Assistant" ist
      mit 58 % die **beste Warenkorb-Rate aller Kanäle**, GEO-Impressionen +43 % (428 → 613).
      Beweis: Diff + llms.txt-Spec-Check (mind. 1 echter Markdown-Link, genau 1 H1).
      ✓ _ausstehend_
- [ ] **P12.2** robots.txt-Inkonsistenz klären: `Anthropic-AI: Disallow: /` bei gleichzeitig
      erlaubtem `ClaudeBot`. Entscheidung dokumentieren (Antoine fragen, wenn unklar).
      ✓ _ausstehend_

---

## BLOCKED-Log

<!-- DATUM · Kriterium · Grund · was gebraucht wird -->

## Abschluss

P7–P9 vollständig → wörtlich `SHOP-UMSATZ-EINHEIT-FERTIG`. Zusätzlich P10–P12 → wörtlich
`SHOP-UMSATZ-LOOP VOLLSTÄNDIG ABGESCHLOSSEN`.
