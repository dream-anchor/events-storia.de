# Checkpoint 2026-07-05 (Nacht) — Katalog-Fundament umgesetzt

> Autonome Nachtarbeit. Erste **implementierte + live-verifizierte** Modul-Umsetzung nach den
> Specs 01–06: das **Katalog-Fundament** (Spec 01). Alles additiv, nichts Destruktives an der
> Live-DB. Code liegt im Repo `maestro-cloud` (siehe Bundle-Anleitung unten).

## Was gebaut wurde (Spec 01 – Katalog & Stammdaten)

**EIN Katalog je Mandant.** Speisen, Getränke, Equipment und Personal in **einer** Item-Tabelle
(Unterscheidung über `kind`). Geld ausschließlich Integer-Cents.

| Ebene | Datei(en) | Inhalt |
|---|---|---|
| DB-Schema | `packages/db/src/schema.ts` | `catalogCategories` + `catalogItems` (Drizzle), Typen exportiert |
| DB-Migration | `packages/db/sql/30_catalog.sql` | Idempotentes DDL: Tabellen, Indizes, RLS-Policies, Grants, FORCE RLS |
| API | `apps/api/src/routes/catalog.ts` | CRUD für `/api/catalog/categories` und `/api/catalog/items` |
| API-Registrierung | `apps/api/src/app.ts` | `registerCatalogRoutes(app)` |
| Tests | `apps/api/test/catalog.test.ts` | 9 Cross-Tenant-/CRUD-Tests |
| Web-UI | `apps/web/src/pages/catalog.tsx` | Katalog-Screen (Filter, Suche, Anlegen/Bearbeiten, Allergene, Archiv) |
| Web-Nav/Route | `apps/web/src/ui/AppShell.tsx`, `apps/web/src/App.tsx`, `apps/web/src/ui/types.ts` | Menüpunkt „Katalog", Route `/katalog`, Typen |

### Sicherheits-Architektur (identisch zum bewährten Muster)
- `tenant_id` wird **serverseitig** aus `withTenant` gesetzt — nie aus dem Body. Ein im Body
  geschmuggeltes `tenant_id`/`tenantId` wird ignoriert **und** von der RLS-`WITH CHECK`-Policy
  geblockt.
- **Zusammengesetzter FK** `(tenant_id, category_id) → catalog_categories(tenant_id, id)`:
  eine Position kann keine Kategorie eines fremden Mandanten referenzieren (Postgres prüft FKs
  unter Umgehung von RLS — deshalb der Composite-FK).
- Partieller Unique-Index `(tenant_id, category_id, name) WHERE archived_at IS NULL` mit
  **`NULLS NOT DISTINCT`**: verhindert doppelte aktive Namen auch im „ohne Kategorie"-Eimer.
- **Soft-Delete** via `archived_at`; hartes `DELETE` nur für Owner/Admin (Rollen-Gate).

## Verifikation (gegen LIVE Neon, nicht simuliert)

**RLS-Isolationsbeweis** (authenticated-Rolle, `request.jwt.claims` gesetzt):
```
PASS  userA legt Kategorie+Item in tenant-a an
PASS  userA liest eigene Zeilen
PASS  userB (tenant-b) sieht 0 Zeilen von tenant-a
PASS  userB Forged-Insert mit tenant-a-id → BLOCKED (WITH CHECK)
PASS  Cross-Tenant-FK (tenant-a-Item → tenant-b-Kategorie) → BLOCKED
```

**Test-Suite:** `57/57 grün` gegen die Live-Neon-Branch (die 9 neuen Katalog-Tests +
alle 48 bestehenden). Typecheck DB/API/Web grün. Web-Build (Vite) grün.

Die Migration `30_catalog.sql` ist **bereits auf die Live-Neon-DB angewendet** (Tabellen,
Policies, FORCE RLS bestätigt). Der Unique-Index trägt live `NULLS NOT DISTINCT`.

## Anwenden (morgens, ~2 Minuten)

Der Code liegt als Git-Bundle bei (`catalog-foundation.bundle`, 1 Commit auf Basis des letzten
CI-Commits `5efc2b2`). Im lokalen `maestro-cloud`-Checkout:

```bash
git fetch /pfad/zu/catalog-foundation.bundle HEAD
git merge FETCH_HEAD        # bzw. cherry-pick FETCH_HEAD
git push                    # löst CI aus → deployt Worker + Pages automatisch
```

Die DB-Migration muss **nicht** erneut laufen (bereits live). Für frische Umgebungen ist
`packages/db/sql/30_catalog.sql` idempotent (`CREATE TABLE IF NOT EXISTS` …).

## Danach direkt nutzbar
- Menüpunkt **„Katalog"** in der Sidebar → Positionen anlegen/bearbeiten/archivieren.
- Kind-Filter (Speise/Getränk/Equipment/Personal), Kategorie-Filter, Suche.
- LMIV-Allergene als Toggle, Ernährungs-Tags, Preis-Hinweis-Feld.

## Nächste Bausteine (Reihenfolge laut ROADMAP)
1. **Spec 06 Speisekarten-KI → schreibt in `catalog_items`** (`source='ai_import'`,
   `ai_confidence`) — der Onboarding-Hebel, füllt den Katalog aus einer Karte.
2. **Spec 02 Angebots-Builder** liest aus dem Katalog (`offer_items` mit echten Preisen/MwSt).
3. Danach 04 (PDF) → 03 (Versand/Annahme/Anzahlung) = kompletter Nordstern-Flow.
