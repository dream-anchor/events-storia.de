# MAESTRO — Scharfschalten des Live-Flows

> Stand 2026-07-06. Der Composio-REST-Contract ist gegen die Doku bestätigt; die Adapter im
> Worker passen (Endpoint/Auth/Body/Response). Zum Live-Betrieb fehlt nur **ein** Secret.

## Der schnellste Weg: ein Befehl

Beide gelieferten Dateien (`maestro-cloud-full.bundle` **und** `go-live.sh`) in den lokalen
`maestro-cloud`-Ordner legen, dann:

```bash
bash go-live.sh
```

Das Skript macht in einem Rutsch: **Bundle einspielen → nach `origin/main` pushen (die CI
deployt Worker + Web) → das Composio-Secret setzen → Liveness-Smoke-Test.** Beim Secret-Schritt
fragt es einmal den Composio-API-Key ab (Eingabe verborgen); ist er schon gesetzt oder als
`COMPOSIO_API_KEY`-Umgebungsvariable vorhanden, überspringt es das.

**Voraussetzungen auf deiner Maschine** (in der Cloud-Sandbox nicht vorhanden, daher lokal):
1. `maestro-cloud`-Checkout mit `origin`-Remote zu GitHub (die CI dort deployt bei Push auf `main`).
2. `wrangler` bei Cloudflare angemeldet **oder** `CLOUDFLARE_API_TOKEN` gesetzt.
3. Composio-API-Key griffbereit (app.composio.dev → Settings → API Keys).

## Was schon erledigt ist
- ✅ `go-live.sh` + auth-freie Liveness-Probe `GET /api/health` im Code (versioniert im Repo).
- ✅ Alle nicht-geheimen Live-Vars stehen in `apps/api/wrangler.toml` (`MAIL_FROM`,
  `MAIL_SENDER_NAME`, `WEB_BASE_DOMAIN`, `DEPOSIT_PERCENT_BP`).
- ✅ Alle DB-Migrationen (30–50) sind bereits auf Neon angewendet.
- ✅ Worker bündelt sauber (Dry-Run-Deploy ok), **139/139 Tests grün**.
- ✅ Composio-Verbindungen ACTIVE + live bewiesen (Anthropic, LexOffice, Resend, Stripe).

## Falls du es lieber manuell machst (was `go-live.sh` automatisiert)
1. **Stand einspielen & deployen** (im lokalen `maestro-cloud`):
   ```bash
   git fetch ./maestro-cloud-full.bundle HEAD && git merge FETCH_HEAD && git push
   ```
   Der Push löst die CI aus → Worker + Web werden deployt (inkl. der neuen Vars).
2. **Das eine Secret setzen** (Composio-API-Key aus app.composio.dev → Settings → API Keys):
   ```bash
   cd apps/api && wrangler secret put COMPOSIO_API_KEY
   ```
   Danach laufen **KI-Parse, E-Mail-Versand und Anzahlungslink live** über Composio.
   (Ohne den Key bleibt alles funktionsfähig; nur diese drei fallen auf „nicht konfiguriert".)
3. **End-to-End testen:** im Backoffice ein Angebot bauen → „An Kunden senden" → die E-Mail
   trifft ein (Absender `angebot@events-storia.de`); auf der öffentlichen Seite annehmen → es
   entsteht ein Stripe-Anzahlungslink.

## Warum ich das nicht direkt für dich deploye
Diese Cloud-Session hat **kein Git-Remote für `maestro-cloud`** (der Code liegt hier nur als
lokaler Klon + Bundle), **keine Cloudflare-Zugangsdaten** und **nicht den Composio-Key**. Der
Deploy muss deshalb physisch von einer Maschine laufen, die dein GitHub-Remote + Cloudflare-Login
+ den Key hat. `go-live.sh` schrumpft deinen Aufwand dort auf genau **einen Befehl**.

## ⚠️ Vor echten Kunden beachten
- **Stripe ist LIVE-Mode** (echte Zahlungen). Für Tests eine **Test-Mode**-Composio-Verbindung
  nutzen. Für Mehrmandanten kommt **Stripe Connect je Betrieb** dazu (`application_fee`).
- **AVV / EU-KI-Verarbeitung** mit Anthropic/OpenAI vor echtem Kundenbetrieb bestätigen.
- Aufräumen aus den Tests: LexOffice-Entwurf **AG0237** löschen, Stripe-Test-Produkt
  **`prod_Upr3wu0wSzgYGN`** archivieren (Link ist bereits inaktiv).
- `MAIL_SENDER_NAME`/`MAIL_FROM` sind derzeit plattformweit (Storia als erster Mandant); je
  Mandant individualisieren ist eine spätere Ausbaustufe (aus `tenants`).
