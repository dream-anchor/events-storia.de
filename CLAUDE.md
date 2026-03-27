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

Google Indexing API Script zum Einreichen von URLs zur Indexierung (200/Tag kostenlos).
Service Account JSON liegt in `scripts/service-account.json` im seo.schrittmacher.ai Repo.

```bash
# Optionen
node scripts/request-indexing.mjs --de-only        # Nur DE-URLs aus Sitemap
node scripts/request-indexing.mjs --priority        # Nicht-indexierte Priority-URLs
node scripts/request-indexing.mjs --dry-run         # Preview ohne Submit
node scripts/request-indexing.mjs --url https://events-storia.de/page/  # Einzelne URL
```

**Service Account:** `gsc-auditor-storia@evocative-shore-486623-v4.iam.gserviceaccount.com`
Muss in GSC als **Inhaber** für `events-storia.de` eingetragen sein.
