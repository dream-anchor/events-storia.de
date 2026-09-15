# KONZEPT — Shop-Umsatz events-storia.de (Plan, Stand 15.09.2026)

**Status: PLAN. Noch nichts umgesetzt.** Erstellt mit Opus 5, Ausführung durch die Folge-Session
(Sonnet 5) über `docs/LOOP-SHOP-UMSATZ.md` + `.claude/commands/shop-umsatz-loop.md`.

## Ausgangslage

Zwei Datenquellen, erstmals zusammengeführt:
- **GSC-Export 15.09.2026** (`~/Downloads/01_DOCUMENTS/SEO/events-storia.de/2026-09/2026-09-15_01`),
  Follow-up 14 Tage nach der Fix-Runde vom 01.09. (`docs/LOOP-SEO-FIXES.md`, P0–P6.5).
- **GA4** (`properties/516232242`, via Composio, Zeitraum 17.06.–14.09.2026) — schließt die Lücke,
  die GSC prinzipiell nicht schließen kann: GSC endet beim Klick, der Kauf passiert danach.

### Der Funnel (GA4, 90 Tage, Nutzer — nicht Events)

| Stufe | Nutzer | Übergang |
|---|---|---|
| Sessions gesamt | 1.013 | — |
| `add_to_cart` | 28 | — |
| `begin_checkout` | 25 | **89 %** vom Warenkorb — sehr gut |
| `purchase` | **2** | **8 %** vom Checkout — **hier bricht alles** |

Umsatz laut GA4: 2.463,80 € aus 2 Käufen → **Ø-Bestellwert 1.232 €.** Jeder zusätzliche Kauf ist
also rund **1.200 € wert** — ein einzelner gewonnener Checkout schlägt jede Ranking-Verbesserung.

Kanäle (Sessions / Käufe): Direct 409/0 · Organic Search 318/1 · Unassigned 193/1 ·
Organic Shopping 64/0 · **AI Assistant 19/0** · Referral 7/0 · Cross-network 3/0.

### Die drei Befunde, auf denen der Plan steht

**1. Die Kauf-Messung ist vermutlich selbst defekt — das muss zuerst geklärt werden.**
GA4 zählt 2 Käufe im Quartal. Aus der Session vom 30.08. sind aber **acht konkrete Stripe-Bestellungen**
aus Juli/August aktenkundig (975 €, 375 €, 825 €, 622 €, 1.801 €, 100 €, 5.180 €, 5.742 € — siehe
Lovable-Commit `c9339260`). Der GA4-Wert von **1.801 € bei Organic Search entspricht exakt einer
davon**. Heißt: GA4 erfasst einen Bruchteil der realen Bestellungen. Solange unklar ist, ob die
„8 % Checkout-Conversion" real oder ein Tracking-Artefakt sind, ist **jede** Optimierung blind.
Deshalb ist der Abgleich Schritt 1 und blockiert alles Weitere.

**2. Das Prerendering liefert 12 von 44 Seiten leer aus — inklusive der besten Shop-Seite.**
`usePrerenderReady` (`src/hooks/usePrerenderReady.ts`) feuert das `prerender-ready`-Event nach einem
**festen 100-ms-Timeout** nach dem ersten Render, ohne auf die Supabase-Menüdaten zu warten.
Puppeteer fotografiert, was nach 100 ms da ist. Die Supabase-Kette (menus → menu_categories →
menu_items) braucht laut PageSpeed-Netzwerkanalyse bis 1.439 ms. Ergebnis, live verifiziert am
15.09.:

| Seite | Titel | Produkt-Schema |
|---|---|---|
| `/catering/pizze-napoletane/` | index.html-Fallback | **0** |
| `/catering/buffet-platten/` | index.html-Fallback | **0** |
| `/catering/buffet-fingerfood/` | eigener | 30 |
| `/catering/buffet-auflauf/` | eigener | 15 |
| `/catering/desserts/` | eigener | 7 |

Betroffen sind **12 von 44 Sitemap-URLs**, jeweils paarweise DE+EN: `/en/` (die englische
Startseite!), `/events/`, `/en/events/`, `/catering/buffet-platten/` + EN, `/catering/pizze-napoletane/`
+ EN, `/faq-catering-muenchen/` + EN, `/firmenfeier-catering-muenchen/` + EN,
`/pizza-catering-muenchen/`.

Auch die **Startseite** trägt nur noch einen `WebPage`-Block — das in P0/P1 reparierte
CateringBusiness-, Organization- und FAQ-Schema kommt im ausgelieferten HTML **gar nicht an**.

Der Business-Bezug: `/catering/buffet-platten/` hat laut GA4 die **beste Shop-Conversion der
ganzen Seite** (12 Sessions → 5 Warenkörbe → 5 Checkout-Starts = 42 %). Genau diese Seite wird
leer ausgeliefert und ist deshalb „Gecrawlt – zurzeit nicht indexiert".

Das ist exakt das in `~/Developer/Websites/CLAUDE.md` § „Prerender/SSR mit Live-Daten" dokumentierte
Muster. Referenzimplementierung: `ristorantestoria.de/prerender.js` — **übernehmen, nicht neu erfinden.**

**3. Google crawlt die Seite praktisch nicht mehr.**
Crawl-Statistik der letzten 10 Tage: 04.09. = 0 Anfragen, 05.09. = 0, 06.09. = 1, 07.09. = 45,
08.09. = 9, 09.09. = 0, 10.09. = 1, 11.09. = 0, 12.09. = 6, 13.09. = 0. Zusammen ~68 Anfragen,
davon 24 % HTML → rund **16 HTML-Seitenabrufe in 10 Tagen**. Verteilung nach Zweck:
**98,5 % „Aktualisieren", 1,5 % „Auffindbarkeit"** — für Entdeckung neuer Seiten bleibt praktisch
nichts übrig.

Folge: Die 33 Seiten unter „Gefunden – zurzeit nicht indexiert" stehen **unverändert** auf
`Zuletzt gecrawlt: 1970-01-01` — sie wurden **nie** gecrawlt, auch 14 Tage nach Sitemap-Resubmit,
Indexing-API-Einreichung und neuen internen Links nicht.

**Korrektur einer Annahme vom 01.09.:** Die Google Indexing API wurde damals als „schnellster Weg"
eingesetzt und meldete für alle 30 URLs Erfolg. Die API unterstützt offiziell aber **nur
`JobPosting` und `BroadcastEvent`** — für normale Seiten nimmt sie den Aufruf an und ignoriert ihn.
Die Daten bestätigen das: 14 Tage später keine einzige der 30 URLs gecrawlt. Das Mittel war
wirkungslos; das gehört korrigiert, damit es nicht erneut als Lösung eingeplant wird.

Auch die internen Links aus P3 sind in GSC unverändert (Startseite 8, Unterseiten 3–4) — weil
die Seiten, die sie tragen, nicht neu gecrawlt wurden.

### Was seit dem 01.09. messbar besser wurde

- **GEO/KI-Suche: 428 → 613 Impressionen (+43 %)** — der einzige klar wachsende Kanal. GA4 führt
  „AI Assistant" bereits als eigenen Kanal: 19 Sessions, 11 Warenkörbe = **58 % Warenkorb-Rate,
  die höchste aller Kanäle.**
- Rezensions-Snippet-Fehler: 5 → 2 Seiten. Produkt-Snippets: 25 gültig, 0 Fehler.
- Canonical-Duplikate: 3 → 0. `/catering/`-403: aufgelöst („Bestanden").
- Impressionen gesamt +15 % (9.475 → 10.897), Klicks +5 % (144 → 151).

### Was sich verschlechtert hat

- **CTR fällt**: erste 14 Tage des Zeitraums 1,29 % → letzte 14 Tage **1,05 %**. Impressionen
  steigen (1.623 → 2.288), Klicks kaum (21 → 24). Sichtbarkeit ohne Klick.
- Ø-Position 9,57 → 9,98.
- Transaktionale Suchanfragen mit Kaufabsicht sammeln rund **370 Impressionen bei 0 Klicks**:
  „cater food delivery" (97, Pos. 8,7), „lieferservice catering münchen" (63, Pos. 9,0),
  „catering liefern münchen" (22, Pos. 10,4), „party pizza bestellen münchen" (18, Pos. 11,4),
  „catering online bestellen münchen" (11, Pos. 22,7).

---

## Zielbild und Reihenfolge

Leitsatz: **Bei 25 Checkout-Startern und 2 Käufen bringt doppelter Traffic 4 Käufe — ein
reparierter Checkout bei gleichem Traffic 6–8.** Deshalb kommt Conversion vor Sichtbarkeit,
und Messbarkeit vor Conversion.

| Phase | Was | Warum zuerst |
|---|---|---|
| **P7** | Kauf-Messung verifizieren | Ohne belastbare Zahl ist jede Priorisierung geraten |
| **P8** | Checkout-Abbruch beheben | Größter Hebel: 92 % Abbruch × 1.232 € |
| **P9** | Prerender-Race beheben | Blockiert Indexierung **und** trifft die beste Shop-Seite |
| **P10** | Crawl-Discovery erzwingen | Ohne Crawl nützt der beste Content nichts |
| **P11** | CTR auf Kauf-Suchanfragen | 370 Impressionen mit Kaufabsicht, 0 Klicks |
| **P12** | GEO ausbauen | Einziger wachsender Kanal, beste Warenkorb-Rate |

### P7 — Kauf-Messung verifizieren (blockiert alles Weitere)

Abgleich der GA4-`purchase`-Events gegen die echten Bestellungen. Quelle für die Wahrheit:
Supabase (Bestell-/Order-Tabellen) bzw. Stripe — **Supabase-Zugriff ausschließlich über Composio
oder die Neon/Supabase-Konnektoren, nie über 1Password** (`~/.claude/CLAUDE.md` § Datenbank-Zugriff).
Konkret: Anzahl bezahlter Bestellungen im Zeitraum 17.06.–14.09.2026 gegen GA4 `purchase` = 2.

Mögliche Ursachen, die dabei zu prüfen sind:
- `purchase`-Event feuert erst auf `/konto/bestellung-erfolgreich` — kehrt der Kunde nach der
  Stripe-Zahlung nicht dorthin zurück, wird der Kauf nie gezählt.
- Bestellungen, die über den Angebots-Flow (`/offer/…`, `offer_payment_initiated`: 17 Events /
  10 Nutzer) laufen, erzeugen möglicherweise gar kein `purchase`-Event.
- Serverseitige Zahlungsbestätigung (Stripe-Webhook) ohne GA4-Anbindung.

**Ergebnis entscheidet über P8:** Ist die reale Conversion ähnlich schlecht → P8 wie geplant.
Sind die Käufe in Wahrheit deutlich höher → P8 wird zum Tracking-Fix (Measurement Protocol /
serverseitiges Event aus dem Stripe-Webhook), und der Schwerpunkt rückt zu P9/P10.

### P8 — Checkout-Abbruch

Erst nach P7. Diagnose vor Therapie: Wo genau bricht es ab (`funnel_step_view` 25 / `funnel_drop` 6
deuten auf eine bereits vorhandene Schritt-Instrumentierung hin — die auswerten, bevor etwas
umgebaut wird). Nebenbefund aus GA4, der mit hinein gehört: **`remove_from_cart` bei 19 von 28
Warenkorb-Nutzern** — zwei Drittel entfernen wieder etwas. Und das Kontaktformular:
`form_start` 46 Nutzer → `generate_lead` 6 = **87 % Abbruch**.

Kein Blind-Umbau des Checkouts. Zuerst messen, dann den einen größten Abbruchschritt beheben.

### P9 — Prerender-Race

Muster aus `ristorantestoria.de/prerender.js` übernehmen: Daten **vor** dem Render-Loop holen,
je Call einzeln try/catch mit Fallback, Ergebnis vor `renderToString` in den Query-Cache schreiben,
am Ende harter `process.exit()`. Hier zusätzlich: `usePrerenderReady` darf nicht mehr nach festem
Timeout feuern, sondern erst wenn die Daten der Seite geladen sind.

**Beweis ist nicht „Build grün".** Nach dem Fix für alle 44 Sitemap-URLs prüfen, dass keine mehr
den `index.html`-Fallback-Titel trägt (der Prüfbefehl steht in `docs/LOOP-SHOP-UMSATZ.md` § P9).

### P10 — Crawl-Discovery

Die Indexing API ist für diese Seitentypen wirkungslos (s. o.). Wirksame Mittel stattdessen:
interne Verlinkung aus **tatsächlich gecrawlten** Seiten (praktisch nur Startseite, `/en/`, die
vier rankenden Landingpages), Reduktion des JS-Anteils am Crawl-Budget (aktuell 47,7 % JavaScript
gegen 24,3 % HTML), und externe Links von Dritten — das Profil besteht zu 88 % aus einer einzigen
Domain (ristorantestoria.de, 132 von 150 Links). Das vorhandene, bisher ungenutzte
`scripts/submit-indexnow.ts` deckt Bing/Yandex ab, nicht Google.

### P11 — CTR auf Kauf-Suchanfragen

Die Seite rankt auf Position 9–13 für „bestellen/liefern"-Suchanfragen und bekommt null Klicks.
Hebel: Title/Description dieser Landingpages auf Transaktion ausrichten (Preis ab, Lieferzeit,
Mindestbestellwert), plus die in P0.3 vorbereiteten Merchant-Felder tatsächlich ausliefern —
was aber erst nach P9 sichtbar wird, weil `/catering/pizze-napoletane/` aktuell **gar kein**
Produkt-Schema ausliefert. Deshalb steht P11 hinter P9.

### P12 — GEO

Der einzige wachsende Kanal, mit der besten Warenkorb-Rate. Nach P9 (dann greift das Schema wieder)
die llms.txt-/llm-*.html-Struktur auf die Shop-Katalogseiten ausdehnen. Prüfen, ob
`User-agent: Anthropic-AI Disallow: /` in der robots.txt noch gewollt ist, während `ClaudeBot`
erlaubt ist — inkonsistent.

## Randbedingungen

- **Merge auf `main` = sofortiges Live-Deployment** (SFTP, kein CI-Gate). Diff vor jedem Merge
  selbst lesen, Bündelung nach `~/.claude/CLAUDE.md` § Loop-Arbeit.
- Supabase-Schema/Edge Functions **nur über Lovable**, nie per CLI gegen die DB.
- Jede Iteration in einem eigenen Subagenten.

## Was dieser Plan bewusst NICHT enthält

JS-Bundle-Reduktion (352 KB) und CSS-Code-Splitting — Architekturthemen aus
`docs/KONZEPT-SEO-FIXES.md` § P6, weiterhin zurückgestellt. Sie zahlen indirekt auf P10 ein
(Crawl-Budget), sind aber kein Quick-Fix und nicht der Engpass.
