# Events Storia - Kontext

## Stack
- React 18 + TS + Vite + Tailwind + shadcn/ui
- Supabase (Postgres, Auth, Edge Functions)
- Refine v5 (Admin), Stripe (Payments)
- TanStack Query (Server State), React Context (Global State)

## Verzeichnisse
```
src/components/ (155+), src/pages/ (33), src/hooks/ (19)
src/contexts/, src/integrations/, src/lib/, src/types/
supabase/migrations/, supabase/functions/
```

## Deployment
- Code → commit + push → Lovable auto-deploy
- Supabase (Edge Functions, SQL, Secrets) → Lovable-Prompt an User
- Kein CLI-Zugang zu Supabase

## Konventionen
- PascalCase: Components | camelCase: functions/vars
- Strict TS, kein `any`, keine unused imports/console.logs
- Tailwind + shadcn bevorzugt
- Alle Supabase-Tabellen: RLS Pflicht
- Types: `src/integrations/supabase/types.ts`
- Komplette Dateien ausgeben, keine Snippets

## Commands
```bash
npm run dev | build | preview | lint
npm run prerender         # SSG für SEO
supabase functions serve  # Lokale Edge Functions
supabase db push          # Migrationen
supabase gen types        # TS-Types regenerieren
```

## SEO (Verbindlich)
- Jede Seite: GENAU EIN Primary Keyword (keine Kannibalisierung)
- H1 = natürliche Version des Primary Keywords
- `<title>` mit Keyword + lokalem Modifier
- Canonical, hreflang, Breadcrumb immer setzen
- Keyword-Mapping: `docs/seo-strategy.md` (VOR Seitenänderung prüfen!)

## Content-Architektur (Pillar & Cluster)
- Pillar: `/` (Home), `/events/` (Location), `/catering/*`
- Cluster: Stadt/Bezirk, Anlass (Firmenfeier, Geburtstag, Weihnachtsfeier), Kulinarik (Pizza, Buffet, Fingerfood)
- Cluster → Pillar verlinken, Pillar → alle Cluster
- CTAs → `/checkout/` oder Kontaktformulare

## Local SEO
- Fokus: München – Maxvorstadt (Karlstr. 47a, 80333 München)
- Sekundär: Schwabing, Lehel, Isarvorstadt
- Lokaler Kontext (Landmarks, ÖPNV) in Stadt-/Bezirksseiten
- NAP nur aus zentraler Konfiguration, keine fake Reviews

## Sprache
- UI: Deutsch | Code/Variablen: Englisch
