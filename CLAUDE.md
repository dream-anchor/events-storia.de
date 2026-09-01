# events-storia.de

## Zusätzlicher Stack
- Refine v5 (Admin-Panel)
- Stripe (Payments)

## Verzeichnisse
```
src/components/ (155+), src/pages/ (33), src/hooks/ (19)
src/contexts/, src/integrations/, src/lib/, src/types/
supabase/migrations/, supabase/functions/
```

## Commands (zusätzlich)
```bash
npm run prerender         # SSG für SEO
supabase functions serve  # Lokale Edge Functions
supabase db push          # Migrationen
supabase gen types        # TS-Types regenerieren
```

## Content-Architektur (Pillar & Cluster)
- Pillar: `/` (Home), `/events/` (Location), `/catering/*`
- Cluster: Stadt/Bezirk, Anlass (Firmenfeier, Geburtstag, Weihnachtsfeier), Kulinarik (Pizza, Buffet, Fingerfood)
- Cluster → Pillar verlinken, Pillar → alle Cluster
- CTAs → `/checkout/` oder Kontaktformulare

## SEO
- Keyword-Mapping: `docs/seo-strategy.md` (VOR Seitenänderung prüfen!)
- Canonical, hreflang, Breadcrumb immer setzen
- Pre-Render für SEO-kritische Seiten

## Local SEO
- Fokus: München – Maxvorstadt (Karlstr. 47a, 80333 München)
- Sekundär: Schwabing, Lehel, Isarvorstadt
- Lokaler Kontext (Landmarks, ÖPNV) in Stadt-/Bezirksseiten
- NAP nur aus zentraler Konfiguration

## SEO Indexing Tool

Google Indexing API Script zum Einreichen von URLs zur Indexierung (200/Tag kostenlos). Liegt NICHT
in diesem Repo, sondern zentral (Cross-Projekt-Tool):
`~/Developer/Websites/seo.schrittmacher.ai/scripts/google-index-submit.mjs`. Service Account JSON
liegt (gitignored) unter `~/Developer/Websites/seo.schrittmacher.ai/scripts/service-account.json` —
Stand 01.09.2026 lokal **nicht vorhanden**, siehe hartes Gate in `docs/LOOP-SEO-FIXES.md` § P4.

```bash
# Ausführen aus ~/Developer/Websites/seo.schrittmacher.ai
node scripts/google-index-submit.mjs --dry-run https://www.events-storia.de/sitemap.xml   # Preview, ganze Sitemap
node scripts/google-index-submit.mjs --de-only https://www.events-storia.de/sitemap.xml   # Nur DE-URLs aus Sitemap
node scripts/google-index-submit.mjs --url https://www.events-storia.de/page/             # Einzelne URL (mehrfach --url möglich)
```

**Service Account:** `gsc-auditor-storia@evocative-shore-486623-v4.iam.gserviceaccount.com`
Muss in GSC als **Inhaber** für `events-storia.de` eingetragen sein.

## SEO/GEO-Fixes-Loop (CRITICAL — vor jeder SEO-Änderung lesen)

Seit 01.09.2026 laufen die Maßnahmen aus dem GSC-Search-Audit als Loop (Konvention:
`~/.claude/CLAUDE.md` § „Loop-Arbeit"):
- **Bauplan** `docs/KONZEPT-SEO-FIXES.md` — Ausgangslage, Ziel, bereits verifizierte Code-Ursachen
  (Structured-Data-Fehler, Marken-Kannibalisierung mit ristorantestoria.de), Architektur-Entscheidungen.
- **Zustand** `docs/LOOP-SEO-FIXES.md` — Checkboxen P0–P4, Beweiszeilen, BLOCKED-Log.
- **Protokoll** `.claude/commands/seo-fixes-loop.md` — Iterations-Ablauf.

**Warum dieser Hinweis CRITICAL ist (Antoines Vorgabe):** bevor irgendjemand (Mensch oder Session)
in 4+ Wochen erneut fragt „sollten wir nicht die Indexierung/Schema-Fehler/Marken-Kannibalisierung
angehen?" — steht hier: **ja, das wurde bereits analysiert und ist in Arbeit/erledigt**, siehe
Zustand oben statt von vorn zu recherchieren. Vor jeder neuen SEO-Maßnahme an events-storia.de
zuerst `docs/LOOP-SEO-FIXES.md` prüfen, ob sie nicht schon läuft oder bewusst zurückgestellt wurde.
