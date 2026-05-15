## Ein zentrales Health-System für **beide** Projekte

[Ristorante Online Hub](/projects/efe4bb0a-3864-4b17-a62b-ed995c528cf0) und events-storia.de werden mit **einem gemeinsamen Monitoring-Backend** ausgestattet. Maestro (events-storia.de) ist die Zentrale — du siehst beide Projekte in einer Oberfläche.

---

## Architektur — Hub & Spoke

```text
                    ┌─────────────────────────────────┐
                    │   MAESTRO (events-storia.de)    │
                    │   = Single Pane of Glass        │
                    │                                 │
                    │   /admin/system-health          │
                    │   ┌─────────────────────────┐   │
                    │   │ events-storia.de   🟢   │   │
                    │   │ ristorantestoria.de 🔴  │   │
                    │   └─────────────────────────┘   │
                    └────────────┬────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │  Supabase events-storia (HUB)   │
                │  • system_errors (project_key)  │
                │  • daily_audits  (project_key)  │
                │  • Edge: report-system-error    │
                │  • Edge: daily-audit            │
                │  • pg_cron 06:00                │
                └────────┬───────────────┬────────┘
                         │               │
              ┌──────────┴───┐      ┌────┴────────────┐
              │ events-storia │      │ ristorantestoria│
              │ Frontend +    │      │ Frontend +      │
              │ Edge Funcs    │      │ Edge Funcs      │
              │ → POST errors │      │ → POST errors   │
              └───────────────┘      └─────────────────┘
```

**Warum events-storia als Hub:**
- Maestro existiert dort bereits (Admin-UI, Auth, Staff-Management)
- Du loggst dich ohnehin nur dort ein
- WhatsApp + Mail-Infrastruktur läuft schon
- Eine Wahrheitsquelle, eine UI, ein Cron-Job

---

## Phase A — Hub bauen (in events-storia.de)

### A1. DB-Migration: zentrale Tabellen

```sql
CREATE TYPE project_key AS ENUM ('events_storia', 'ristorante_storia');

CREATE TABLE public.system_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project project_key NOT NULL,        -- ⭐ multi-project
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb,
  count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX system_errors_dedup ON public.system_errors(project, payload_hash) WHERE resolved_at IS NULL;
CREATE INDEX system_errors_unresolved ON public.system_errors(project, severity, last_seen DESC) WHERE resolved_at IS NULL;

CREATE TABLE public.daily_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project project_key NOT NULL,
  audit_date date NOT NULL,
  severity_score integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project, audit_date)
);
```

RLS: Admin/Staff lesen alle Projekte, Schreiben nur via Edge-Function (service-role).

### A2. Neue Edge-Function `report-system-error` (öffentlich, CORS)

Akzeptiert von **beiden** Projekten:
```ts
POST /functions/v1/report-system-error
{
  project: 'events_storia' | 'ristorante_storia',
  source: string,
  severity: 'error' | 'warning' | 'critical',
  message: string,
  payload?: object,
  shared_secret: string  // einfaches Bearer-Auth gegen Spoofing
}
```
- Hasht Source+Message → UPSERT
- Bei `count >= 3 within 10min` → WhatsApp + Mail-Eskalation mit Projekt-Label
- CORS offen für `events-storia.de`, `ristorantestoria.de`, `*.lovable.app`

### A3. Maestro-UI: `/admin/system-health`

Neue Seite mit zwei Tabs (events-storia | ristorantestoria) + Übersichts-Header:
- Pro Projekt: ungelöste Fehler-Liste (Source, Message, Count, Last-Seen, Payload)
- „Resolved"-Button mit Notiz
- Realtime via Supabase-Channel
- System-Health-Widget auf `/admin` Dashboard zeigt **beide** Projekte als Ampel

### A4. Daily-Audit Edge-Function

Läuft 06:00 Berlin (1× pg_cron-Job, audited beide Projekte):
1. **events-storia**: Edge-Logs, Postgres-Logs, system_errors, Stripe-Failures, Sitemap-Crawl
2. **ristorante-storia**: dasselbe Schema (über deren Supabase-Service-Role-Key, gespeichert als Secret `RISTORANTE_SERVICE_ROLE_KEY`)
3. Schreibt 2 Einträge pro Tag in `daily_audits`
4. Bei `severity_score >= 3` → kombinierte Mail/WhatsApp-Zusammenfassung

---

## Phase B — events-storia.de instrumentieren

### B1. Smoke-Tests (`supabase/functions/_tests/`)
- `rpc-checkout.test.ts` (`checkout_create_catering_order`, `checkout_create_event_booking`)
- `rpc-offer.test.ts` (Offer-RPCs)
- `edge-healthchecks.test.ts` (5 kritische Edge-Functions)

### B2. Catch-Blöcke umstellen
- 5 kritische Edge-Functions → `report-system-error` mit `project: 'events_storia'`
- `src/pages/Checkout.tsx` Submit-Catch
- `src/lib/createPaymentSession.ts` alle Throws
- Neuer Frontend-Helper `src/lib/reportError.ts`

### B3. Healthcheck-Pattern
Jede Edge-Function:
```ts
if (body?.healthcheck === true) return new Response(JSON.stringify({ ok: true }));
```

---

## Phase C — ristorantestoria.de instrumentieren

### C1. Frontend-Helper `src/lib/reportError.ts`
Identisches Pattern, aber `project: 'ristorante_storia'` und URL zeigt auf events-storia Hub-Function.

### C2. Catch-Blöcke
- Alle Top-Level-Catches in Checkout, Reservierung, Kontaktformular, Auth
- Window-Level: `window.addEventListener('error', ...)` + `'unhandledrejection'`

### C3. Edge-Functions in Ristorante (sofern vorhanden)
- Catch-Blöcke posten an Hub
- Gleicher `shared_secret` wie events-storia

### C4. Deep-Link in Maestro
Jeder Ristorante-Fehler in `/admin/system-health` zeigt zusätzlich Link zur Ristorante-Lovable-Preview, damit du direkt zur Quelle springen kannst.

---

## Phase D — Preflight für beide Projekte

`scripts/preflight-checks.ts` in **beiden** Repos:
- events-storia: RPC-Tests + Edge-Healthchecks + Sitemap + Test-Lead
- ristorantestoria: Reservierungs-Submit + Menu-Load + Sitemap

Bei Failure → Exit 1 + automatischer Eintrag in `system_errors` mit `severity='warning'`, sodass auch übersprungene Preflights sichtbar bleiben.

---

## Reihenfolge & Sessions

| Session | Inhalt | Projekt | Zeit |
|---|---|---|---|
| **1** | Phase A komplett (Hub: DB, Edge, UI, Cron) | events-storia | ~3h |
| **2** | Phase B (events-storia instrumentieren) | events-storia | ~2h |
| **3** | Phase C (ristorante instrumentieren) | ristorantestoria | ~2h |
| **4** | Phase D (Preflight in beiden Repos) | beide | ~2h |

**Wichtig:** Sessions 1+2 laufen in **diesem** Projekt. Session 3 musst du im [Ristorante-Projekt](/projects/efe4bb0a-3864-4b17-a62b-ed995c528cf0) starten — ich kann von dort aus per Cross-Project-Tools die Hub-URL/das Schema lesen, aber Code-Änderungen am Ristorante-Repo finden in jenem Chat statt. Session 4 analog.

---

## Was du brauchst (Secrets)

Vor Phase A1:
1. **`SYSTEM_HEALTH_SHARED_SECRET`** — generiere ich, du speicherst in beiden Projekten als Edge-Function-Secret
2. **`RISTORANTE_SERVICE_ROLE_KEY`** — Service-Role-Key des Ristorante-Supabase-Projekts (für Daily-Audit-Lesezugriff). Den findest du im Ristorante-Projekt unter Cloud-Settings.

Wenn du die zwei Secrets bereitstellen kannst, starte ich Session 1 (Phase A) sofort.

---

## Resultat

Eine URL: **events-storia.de/admin/system-health**
- Zwei Projekte, ein Dashboard
- Jeder Production-Fehler in <10 Sek sichtbar
- Tägliche Zusammenfassung 06:00
- WhatsApp nur bei echtem Burst
- Tests vor Deploy verhindern Regressions

Bestätige **Session 1 starten** und nenne den Service-Role-Key vom Ristorante-Projekt — dann lege ich los.