# Architektur-Entscheidungsdokument: Mandantenisolation MAESTRO (Neon + Cloudflare)

> Zielablage: `docs/ARCHITECTURE-MULTITENANCY.md`
> Status: Entwurf zur Umsetzung · Kein Code, konzeptionell + Pseudocode
> Kontext: Neuaufbau MAESTRO als Multi-Tenant-SaaS auf Neon (Postgres, eu-central-1) + Neon Auth (Stack Auth, Organizations = Mandanten) + Cloudflare (Pages + Workers) + Stripe Connect.

## 0. Leitprinzip (aus dem Audit abgeleitet)

Das Altsystem hatte die Mandanten-Infrastruktur **vorbereitet, aber nie erzwungen**. Belege im Repo:

- `supabase/functions/_shared/auth.ts` – Rollen- und Tenant-Auflösung laufen über einen `service_role`-Client, der RLS komplett umgeht. Genau das Muster, das 90/105 Functions hatten.
- `supabase/migrations/20260625231814_...sql` – `custom_access_token_hook` (JWT-Tenant-Claim) existiert, wurde aber laut Audit nie in der Auth-Config aktiviert. Der Claim war also nie im Token.
- `src/providers/refine-data-provider.ts` – der Data-Provider setzt/filtert `tenant_id` an **keiner** Stelle; er verlässt sich vollständig auf RLS, die es faktisch nicht gab.
- `supabase/functions/_shared/tenant.ts` – `resolveTenantFromEntity` fällt bei fehlendem Treffer **still auf den Default-Tenant** zurück. In Multi-Tenant wäre das ein leises Cross-Tenant-Leck.
- Öffentliche Angebots-RPCs sind `SECURITY DEFINER`, an `anon` granted und **ohne jeden Tenant-Bezug**; Zugriff nur über rate-Limit-freie UUID/Slug.
- Secrets global: `Deno.env.get('LEXOFFICE_API_KEY')`, `SMTP_*` etc. sind **prozessweite** Env-Vars, nicht pro Mandant.

**Konsequenz für das Zielsystem:** Isolation darf nie von Disziplin (dem Erinnern an einen `.where(tenant_id=...)`) abhängen. Sie muss **strukturell in der Datenbank** liegen (RLS als letzte, nicht umgehbare Instanz) und darf **keinen einzigen Codepfad** haben, der mit einer RLS-umgehenden Rolle (Owner/Superuser/`service_role`-Äquivalent) auf Fachdaten zugreift.

---

## 1. Isolationsmodell

### 1.1 Optionen

| Option | Erzwingung | Schwäche |
|---|---|---|
| **A) Reine App-Layer-Filterung im Worker** (Drizzle `where tenant_id=...`) | nur Code-Disziplin | Ein vergessener Filter, ein Raw-Query, ein Webhook = Leck. Exakt der Altsystem-Fehler. |
| **B) Reine Postgres-RLS über JWT-Claims** | DB erzwingt | Hintergrundjobs/Webhooks haben kein End-User-JWT → Versuchung, `service_role` zu nehmen. |
| **C) Kombination: RLS primär + App-Layer sekundär, EIN Zugriffspfad für alle (auch Jobs)** | DB erzwingt + Ergonomie | mehr Aufbauaufwand, JWT muss bis Postgres reichen |

### 1.2 Empfehlung: Option C — RLS als strukturelle Grenze, App-Layer als erste Verteidigungslinie

**Primärstrategie: Postgres-RLS in Neon, getrieben durch verifizierte JWT-Claims (`org_id`) via `pg_session_jwt` / Neon RLS (Neon Authorize).** RLS ist die einzige Instanz, die auch bei einem App-Bug nicht umgangen wird. Die App-Layer-Filterung ist redundante Absicherung + Performance + saubere 403-Fehler, **niemals** die alleinige Grenze.

**Der entscheidende strukturelle Hebel:** Es existiert **kein** global privilegierter Connection-String im Request-Pfad. Kein Codepfad — weder User-Request noch Webhook noch Cron — bekommt jemals eine Verbindung mit einer Rolle, die RLS umgeht (`BYPASSRLS`, Table-Owner, Superuser). Diese privilegierte Verbindung existiert ausschließlich im Migrations-/Deploy-Kontext (getrennte Credentials, nicht im Worker-Binding).

### 1.3 Rollen- und Verbindungsmodell (konkret)

Drei Postgres-Rollen, sauber getrennt:

- `maestro_migrator` — Owner der Tabellen, `BYPASSRLS`. **Nur** in CI/Deploy, nie im Worker.
- `maestro_app` — Login-Rolle des Workers, **RLS unterworfen** (kein BYPASSRLS), minimale Grants (SELECT/INSERT/UPDATE/DELETE auf Fachtabellen, kein DDL).
- `maestro_public` — noch restriktivere Rolle für die anonyme öffentliche Fläche (nur SELECT auf freigegebene Views/Funktionen).

Identität (Mandant + Rolle) kommt **nicht** aus der DB-Rolle, sondern aus dem **pro Request/Transaktion gesetzten JWT**:

```
Cloudflare Worker (Request)
  │  1. Stack-Auth-Access-Token aus Cookie/Header lesen + verifizieren (JWKS von Neon Auth)
  │  2. org_id (= selected team) + Rolle aus Claims lesen
  │  3. Subdomain-Slug ↔ org_id gegencheck (siehe §5) → sonst 403
  ▼
Neon serverless driver (HTTP), authToken = das verifizierte Access-Token
  │  → Neon setzt pro Transaktion die JWT-Claims; auth.jwt()->>'org_id' verfügbar
  ▼
Postgres (Rolle maestro_app, RLS aktiv)
  │  RLS-Policies filtern auf tenant_id = current_tenant_id()
```

**Pooling-Modell / warum das leak-sicher ist:** Weil die Identität am **Token pro Transaktion** hängt (nicht an einer Session-Variable), ist Neons Connection-Pooling unkritisch — es gibt keinen `SET`-Session-State, der zwischen Requests auf einer wiederverwendeten Connection „hängen bleiben" kann. Das ist der bewusste Vorteil des JWT-getriebenen Wegs gegenüber dem klassischen `SET app.tenant_id`.

**Falls** an einer Stelle doch GUCs statt JWT genutzt werden (z. B. für den System-Issuer, siehe unten), gilt eiserne Regel: **`SET LOCAL` innerhalb einer expliziten Transaktion** (transaktions-scoped), niemals `SET` (session-scoped) — sonst leakt Kontext über den Transaction-Pooler.

### 1.4 Der kritische Punkt: Hintergrundjobs/Webhooks ohne End-User-JWT

Damit ein Webhook (Stripe Connect, IMAP-Poll, LexOffice-Sync, Retention-Job) **nicht** in die `service_role`-Falle des Altsystems läuft, gibt es genau **einen** legitimen Weg:

1. **Tenant zuerst auflösen** — aus dem Payload heraus, bevor irgendein Fachdatenzugriff passiert. Beispiel Stripe: Webhook enthält `account` (Connected-Account-ID) → Lookup `tenants.stripe_account_id → tenant_id`. Beispiel IMAP-Cron: iteriere über `tenants`, ein Durchlauf pro Tenant.
2. **System-Token minten** — ein kurzlebiges, serverseitig signiertes JWT mit Claims `{ org_id: <tenant>, role: 'system' }`, ausgestellt von einem dedizierten **System-Issuer** (eigener Signing-Key, nur im Worker/Job-Kontext, nie am Client). Neon vertraut diesem Issuer via zusätzlichem JWKS-Eintrag.
3. **Denselben `withTenant`-Pfad benutzen** wie ein User-Request. Der Job ist damit RLS-unterworfen wie jeder andere.

Damit gilt: **Ein Job, der vergisst einen Tenant zu setzen, sieht null Zeilen (RLS default-deny) und schlägt laut fehl — statt still mandantenübergreifend zu lesen.** Genau die Umkehrung des Altsystem-Verhaltens (`resolveTenantFromEntity` → Default-Tenant).

```
// Pseudocode — der EINZIGE Weg zu einem DB-Handle
export async function withTenant<T>(
  ctx: { orgId: string; role: 'owner'|'admin'|'staff'|'system'|'public'; token: string },
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const sql = neon(DATABASE_URL_APP, { authToken: ctx.token }); // maestro_app, RLS an
  return await sql.transaction(async (tx) => fn(tx));
}
// KEIN Export eines rohen Pools. Feature-Code kann gar keinen ungescopeten Zugriff bekommen.
```

---

## 2. Org → Tenant-Mapping & Rollen

### 2.1 Mapping-Prinzip

Interne `tenant_id uuid` als stabiler Anker über alle Fachtabellen; externe `stack_org_id` nur in der `tenants`-Tabelle. Das entkoppelt interne PKs vom Auth-Provider und erleichtert den Storia-Import (bestehende `tenant_id` bleibt erhalten).

```sql
CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stack_org_id  text NOT NULL UNIQUE,     -- Stack Auth Organization-ID
  slug          text NOT NULL UNIQUE,     -- Subdomain <slug>.maestro-app.de
  status        text NOT NULL DEFAULT 'onboarding'
                CHECK (status IN ('onboarding','active','suspended')),
  stripe_account_id text UNIQUE,          -- Stripe Connect Connected-Account
  -- Firmen-/Branding-Config (aus altem tenants-Schema übernehmbar)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rollen-Mirror: Stack Auth ist Quelle der Wahrheit für Mitgliedschaft,
-- die DB spiegelt sie für RLS-Rollenprüfungen (per Webhook synchron gehalten).
CREATE TYPE tenant_role AS ENUM ('owner','admin','staff');
CREATE TABLE tenant_users (
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stack_user_id text NOT NULL,
  role          tenant_role NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, stack_user_id)
);
```

**Warum Mirror-Tabelle statt reinem JWT-Rollen-Claim?** Der Tenant-Boundary (`org_id`) wird dem JWT vertraut. Die **Rolle** wird in `tenant_users` nachgeschlagen — robuster (funktioniert auch wenn Stack Auth die Rolle mal nicht ins Token legt), eine einzige Quelle für Policies, und least-privilege bleibt DB-seitig prüfbar. Synchronisiert via Stack-Auth-Webhooks (`team.member.added/updated/removed`) plus periodischer Reconciliation.

### 2.2 tenant_id auf allen Fachtabellen

Jede fachliche Tabelle: `tenant_id uuid NOT NULL REFERENCES tenants(id)`, indexiert. **Kein DEFAULT auf einen Fix-Tenant** (das war ein Altsystem-Antipattern). Stattdessen wird `tenant_id` beim Insert serverseitig aus dem Kontext gesetzt **und** per RLS `WITH CHECK` gegengeprüft (siehe §3).

### 2.3 Policy-Helfer & Rollen-Guards

```sql
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT t.id FROM tenants t
  WHERE t.stack_org_id = (auth.jwt() ->> 'org_id')
$$;

CREATE FUNCTION current_role_in_tenant() RETURNS tenant_role LANGUAGE sql STABLE AS $$
  SELECT tu.role FROM tenant_users tu
  WHERE tu.tenant_id = current_tenant_id()
    AND tu.stack_user_id = (auth.jwt() ->> 'sub')
$$;

-- Standard-Policy-Muster pro Fachtabelle:
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries FORCE ROW LEVEL SECURITY;   -- gilt auch für Tabellen-Owner

CREATE POLICY tenant_select ON inquiries FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_write ON inquiries FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());     -- Insert für fremden Tenant unmöglich

CREATE POLICY tenant_update ON inquiries FOR UPDATE
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Rollen-abgestufte Beispiele:
--  Staff: darf Anfragen lesen/schreiben, aber tenant_secrets/tenant-Config nicht.
--  Owner: darf Mitglieder, Secrets, Billing verwalten.
CREATE POLICY owner_only_secrets ON tenant_secrets FOR ALL
  USING (tenant_id = current_tenant_id() AND current_role_in_tenant() = 'owner')
  WITH CHECK (tenant_id = current_tenant_id() AND current_role_in_tenant() = 'owner');
```

`FORCE ROW LEVEL SECURITY` auf allen Fachtabellen — damit selbst ein versehentlicher Zugriff mit der Owner-Rolle gefiltert bleibt. Default-deny: keine Policy = kein Zugriff.

---

## 3. Datenzugriffsschicht (Ersatz für Refine/PostgREST)

### 3.1 Empfehlung: Drizzle-ORM + dünne Worker-API + Refine-Data-Provider gegen diese API

**Verworfen: eigener PostgREST-Ersatz.** Ein generischer „Query beliebige Tabelle"-Endpunkt reproduziert exakt das Risiko des alten `refine-data-provider.ts` (`mapResource` → beliebige Tabelle, Filter vom Client). Tenant-Scoping wäre wieder Client-/Disziplinsache.

**Gewählt:** Drizzle-Repositories hinter expliziten Worker-Endpunkten (`/api/inquiries`, `/api/customers`, …). Refine bekommt einen `DataProvider`, der diese Endpunkte anspricht (analog zur heutigen Struktur, aber ohne direkten DB-Zugriff vom Browser).

### 3.2 Wie JEDER Query zwingend tenant-gescoped ist (strukturell)

Vier Sperren, mehrschichtig:

1. **Tenant kommt nie aus Request-Body/Param.** Der Worker leitet ihn ausschließlich aus dem verifizierten JWT (`org_id`) ab. Ein vom Client gesendetes `tenant_id` wird ignoriert bzw. überschrieben. (Schließt die Lücke „Frontend setzte tenant_id nie" — jetzt **kann** das Frontend es gar nicht setzen.)
2. **Kein roher DB-Handle im Feature-Code.** Nur `withTenant(ctx, fn)` ist exportiert (§1.3). ESLint `no-restricted-imports` verbietet Import des Pools außerhalb `db/withTenant.ts`.
3. **RLS als Netz darunter.** Selbst ein vergessener `.where(eq(t.tenantId, …))` liefert nur Zeilen des Tenants, weil `maestro_app` RLS-unterworfen ist.
4. **Auto-Inject + Guard bei Inserts.** Der Repository-Wrapper injiziert `tenant_id = ctx.tenantId` in jeden Insert; RLS `WITH CHECK` weist alles andere ab.

```
// Pseudocode Repository — tenant_id ist nie ein Parameter des Callers
class InquiryRepo {
  list(ctx)        { return withTenant(ctx, tx => tx.select().from(inquiries)); }
  create(ctx, dto) {
    const clean = stripClientTenant(dto);           // tenant_id aus Body entfernen
    return withTenant(ctx, tx =>
      tx.insert(inquiries).values({ ...clean, tenant_id: ctx.tenantId }));  // server-gesetzt
  }
}
```

5. **CI-Regressionstest** (der im Altsystem fehlte): Ein automatischer Cross-Tenant-Probe-Test (§7) läuft bei jedem Deploy.

---

## 4. Secrets pro Mandant (LexOffice, IMAP, Stripe)

### 4.1 Kategorien

- **Stripe Connect:** Es wird **kein** Connected-Account-Secret gespeichert. Plattform-Secret ist **ein** Worker-Secret; pro Zahlung wird die `stripe_account_id` des Tenants als `Stripe-Account`-Header mitgegeben. Gespeichert wird nur `tenants.stripe_account_id` (tenant-scoped, kein Klartext-Geheimnis). Großer Sicherheitsgewinn vs. altem globalem `STRIPE_SECRET`.
- **Echte Secrets (LexOffice-API-Key, IMAP-Passwort, ggf. eigener SMTP):** Envelope-Encryption, verschlüsselt in der DB, entschlüsselt nur zur Laufzeit im tenant-gebundenen Job.

### 4.2 Envelope-Encryption-Modell

```sql
CREATE TABLE tenant_secrets (
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind        text NOT NULL,          -- 'lexoffice_api_key' | 'imap_password' | ...
  ciphertext  bytea NOT NULL,         -- AES-256-GCM(Klartext, DEK)
  iv          bytea NOT NULL,
  wrapped_dek bytea NOT NULL,         -- DEK, gewrappt mit Master-Key (KEK)
  key_ref     text  NOT NULL,         -- welcher Master-Key (Rotation)
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, kind)
);
-- RLS: nur Owner des Tenants (siehe owner_only_secrets in §2.3)
```

- **Master-Key (KEK)** liegt als Worker-Secret (Cloudflare Secret), idealerweise extern per KMS/HSM verwaltet — *nicht* in der DB. Selbst bei DB-Leak bleibt der Klartext ohne KEK unlesbar.
- **Pro-Tenant-DEK** wird mit dem KEK gewrappt gespeichert → Rotation von KEK ohne Re-Encrypt aller Ciphertexts (nur DEKs neu wrappen).
- **Laufzeit-Auflösung:**

```
async function getTenantSecret(ctx, kind) {
  return withTenant(ctx, async (tx) => {
    const row = await tx.select().from(tenantSecrets)
      .where(eq(tenantSecrets.kind, kind)).limit(1);   // RLS: nur eigener Tenant
    const dek = await unwrap(row.wrapped_dek, KEK[row.key_ref]);
    return aesGcmDecrypt(row.ciphertext, row.iv, dek);  // niemals loggen
  });
}
```

- Zugriff auf Secrets wird **auditiert** (`secret_access_log`, tenant-scoped). Rotation und `key_ref`-Versionierung eingeplant.

---

## 5. Öffentliche Fläche: PublicOffer ohne Login, cross-tenant-sicher

### 5.1 Problem im Altsystem

`get_public_offer(offer_id)` / `get_public_offer_by_slug(slug)` sind `SECURITY DEFINER`, an `anon` granted, ohne Tenant-Filter. Der Slug ist `name-4char` (erratbar). In Multi-Tenant wäre das ein Enumerations-/Cross-Tenant-Risiko.

### 5.2 Zieldesign

1. **URL:** `<slug>.maestro-app.de/angebot/<token>`. Die **Subdomain bindet den Tenant** fest.
2. **Token statt ID/Name-Slug:** `public_token` = ≥128 Bit Zufall, URL-safe, nicht ableitbar aus Kundennamen. Keine sequenzielle ID, kein Name-Slug.
3. **Anonymer, tenant-gebundener Pfad:** Der Worker löst Tenant aus der Subdomain auf, mintet ein System-Token `{ org_id: <subdomain-tenant>, role: 'public' }` und ruft eine `SECURITY INVOKER`-Query bzw. eine restriktive View auf:

```sql
-- Öffentliche View: NUR freigegebene Spalten, Tenant + Token müssen BEIDE matchen
CREATE VIEW public_offer_v AS
  SELECT id, tenant_id, public_token, company_name, options_json, status
  FROM inquiries WHERE status IN ('offer_sent','confirmed');

CREATE POLICY public_read ON inquiries FOR SELECT TO maestro_public
  USING (tenant_id = current_tenant_id());   -- current_tenant_id() = Subdomain-Tenant

-- Zugriff:  WHERE tenant_id = current_tenant_id() AND public_token = $1
```

**Warum sicher:** Ein gültiges Token von Tenant A auf der Subdomain von Tenant B liefert **null Zeilen** (Bedingung `tenant_id = current_tenant_id() AND public_token = …` schlägt fehl). Enumeration ist wegen Token-Entropie chancenlos. `maestro_public` hat nur SELECT auf die freigegebene Projektion, nie auf die volle Tabelle oder andere Tenants.

4. **Zusätzlich:** generisches 404 (kein „existiert, aber falscher Tenant"), Rate-Limiting am Worker, optional Ablaufdatum/`expires_at`. Schreibende Kundenaktion (Angebot annehmen) läuft über einen dedizierten Endpunkt, der wieder `public_token + tenant_id` prüft.

---

## 6. Migrationspfad-Kompatibilität (Import Storia)

### 6.1 Zielmodell bleibt kompatibel

- Storia wird **eine** Stack-Auth-Organization → `stack_org_id`. In `tenants` mit **stabiler** `tenant_id` (die bestehende `00000000-0000-0000-0000-000000000001` kann übernommen werden) und `slug = 'storia'`.
- Bestehende Tabellen (`v2_events`, `v2_customers`, `v2_payments`, `event_inquiries`, `inquiry_offer_options`, `catering_orders`, `packages`, `menus/menu_items`, `email_templates`, `locations`, `inbox_emails`) → Zielschema; **jede Zeile** `tenant_id = Storia`.
- **PKs möglichst erhalten** (UUIDs), damit externe Referenzen intakt bleiben (LexOffice-Invoice-IDs, Stripe-IDs, Offer-Tokens). Wo PKs sich ändern: `import_map(old_id, new_id, entity)`.
- **Rollen:** altes globales `user_roles` / `tenant_users` → Storia-Mitgliedschaften in Stack Auth + `tenant_users`-Mirror.
- **Secrets:** Storias LexOffice-Key, IMAP-/SMTP-Creds → `tenant_secrets` (envelope-verschlüsselt) unter Storia. Stripe: Storia als Connected Account registrieren → `stripe_account_id` setzen.
- **DSGVO-Retention** beim Import respektieren: Original-Timestamps übernehmen; ruhende Kundendaten ohne Buchung 36 Monate, buchhaltungsrelevante Daten (`v2_payments`, Rechnungen) mind. 13 Jahre → tenant-scopedter Retention-Job (Löschung vs. Anonymisierung getrennt behandeln).

### 6.2 ETL-Eigenschaften

Idempotent, resumable, transaktional pro Batch. Nach Import: Row-Count-Abgleich + Pro-Tenant-Checksumme + **Cross-Tenant-Negativtest** (§7) als Abnahmekriterium.

---

## 7. Dünnster vertikaler Spike (B3): Login → Dashboard → 1 Anfrage, 2 Mandanten

### 7.1 Minimale Schrittfolge

1. **Provisioning:** Stack-Auth-Projekt (Neon Auth). Zwei Orgs (Tenant A, Tenant B), je 1 User (plus optional 1 User in beiden, um Org-Switch zu testen). Neon-DB mit `pg_session_jwt`, Stack-Auth-JWKS registriert, RLS Authorize aktiv.
2. **Schema (minimal):** `tenants`, `tenant_users`, `inquiries(tenant_id NOT NULL, …)`; Helfer `current_tenant_id()`; RLS default-deny + `tenant_select`/`tenant_write` (§2.3). Seed: Tenants A/B + Memberships.
3. **Worker-API:** `withTenant` (§1.3), `GET /api/inquiries`, `POST /api/inquiries`. Tenant **nur** aus JWT. Subdomain-Routing `a.maestro-app.de`, `b.maestro-app.de` → Slug↔org_id-Gegencheck.
4. **Frontend (Cloudflare Pages):** Stack-Auth-Login; Dashboard listet `inquiries`; Formular „Anfrage anlegen". Refine-DataProvider → Worker.
5. **Happy Path:** Als A einloggen → „A-1" anlegen → sichtbar. Als B → „B-1" anlegen → **nur** B-1 sichtbar.

### 7.2 Der entscheidende Cross-Tenant-Negativtest (Abnahme-Gate)

Alle Fälle automatisiert in CI:

- **Direkter API-Call mit B-Token auf A-Ressource:** `GET /api/inquiries/<A-1-id>` mit B's gültigem Token → **404/leer** (nicht 200).
- **Direkter Neon-Call mit B-Token:** `SELECT … WHERE id = <A-1-id>` → **0 Zeilen** (RLS).
- **Forged-Insert:** B sendet `POST /api/inquiries` mit Body `tenant_id = A` → landet in **B** (server-gesetzt) bzw. wird von `WITH CHECK` abgewiesen — **niemals** in A.
- **Kein Token:** → **401**. **Token ohne selektierte Org:** → **0 Zeilen** (default-deny), **niemals** „alle Zeilen".
- **Public-Offer-Cross-Tenant:** A's Offer-Token auf B's Subdomain → **404**.

Dieser Test ist die Regressionssperre, die im Altsystem fehlte. „Grün" heißt: Isolation ist strukturell, nicht zufällig (weil es nur einen Tenant gab).

---

## 8. Offene Punkte & Risiken

1. **Stack-Auth-Token-Inhalt:** Trägt das Access-Token zuverlässig die *selektierte* Org (`org_id`) **und** ist bei Multi-Org-Usern eindeutig? Falls nicht: expliziter Token-Exchange/„Org-Pinning" nötig, plus webhook-synchronisierte `tenant_users`. Verhalten bei Subdomain↔Org-Mismatch definieren (harte 403).
2. **Neon RLS + Pooling verifizieren:** `pg_session_jwt`-Verhalten am gepoolten Endpoint praktisch testen (Token-pro-Transaktion, kein Session-Leak). HTTP-Driver-Latenz bei „chattigem" Admin-UI → ggf. Batching/RPC-Endpunkte.
3. **System-Issuer-Key-Custody:** Der Signing-Key für System-Token darf nur serverseitig existieren; Missbrauch (beliebige Tenant-Token minten) ausschließen. Rotation planen.
4. **Master-Key (KEK):** Single Point of Trust im Worker-Secret — externes KMS/HSM erwägen; Rotationsprozess (`key_ref`) festlegen.
5. **Scheduling:** Neon hat kein universelles `pg_cron`. Ersatz: Cloudflare Cron Triggers → Worker → **pro-Tenant-Schleife**, jede Iteration tenant-gebunden.
6. **RLS-Performance:** `tenant_id`-Index auf **jeder** Tabelle Pflicht; Policies mit `tenant_users`-Subquery `STABLE` + indexiert; für Hot-Paths `current_tenant_id()` möglichst aus JWT (ohne Tabellen-Hit) ableiten.
7. **DSGVO-Retention-Automatik:** 36-Monate-Dormant (Löschen/Anonymisieren) vs. 13-Jahre-Buchhaltung (aufbewahren) sauber trennen; tenant-scopedte Jobs; Nachweisbarkeit.
8. **Stripe-Connect-Webhooks:** Tenant **immer** zuerst aus `account`/Connected-Account-ID auflösen, bevor DB-Zugriff; Signaturprüfung; Idempotenz.
9. **Custom Domains (später):** Wildcard-Subdomain jetzt; Custom-Domain braucht `tenant_domains`-Tabelle + Verifizierung + TLS-Provisioning.
10. **Public-Offer-Härtung:** Token-Entropie, Ablauf, Rate-Limit, keine Enumeration, generische Fehler — als Sicherheitsanforderung fixieren, nicht optional.

---

## 9. Zusammenfassung der Kernentscheidungen

| Thema | Entscheidung |
|---|---|
| Isolation | RLS in Neon (JWT `org_id` via `pg_session_jwt`) **primär**, App-Layer sekundär; `FORCE RLS`, default-deny |
| Erzwingung | Keine RLS-umgehende Rolle im Request-Pfad; einziger DB-Zugang via `withTenant`; Jobs minten tenant-scopedte System-Token |
| Mapping | Interne `tenant_id` + `stack_org_id` in `tenants`; Rolle über `tenant_users`-Mirror; `tenant_id NOT NULL` überall, kein Default-Tenant |
| Datenschicht | Drizzle + Worker-API + Refine-DataProvider; Tenant nie aus Client-Input; kein generischer Table-Queryer |
| Secrets | Stripe nur `stripe_account_id`; echte Secrets envelope-encrypted in `tenant_secrets`, KEK im Worker/KMS |
| Public | Subdomain bindet Tenant + hochentropes Token; `tenant_id AND token` müssen beide matchen; eigene `maestro_public`-Rolle |
| Migration | Storia = 1 Org, stabile `tenant_id`, PKs erhalten, Secrets → `tenant_secrets`, Retention respektiert |
| Spike | Login→Dashboard→1 Anfrage für A/B + automatisierter Cross-Tenant-Negativtest als Abnahme-Gate |

---

_Grundlage: Audit des Altsystems (2026-07-03). Erstellt als B2 im MAESTRO-SaaS-Playbook. Freizugeben vor B3 (Spike-Umsetzung)._
