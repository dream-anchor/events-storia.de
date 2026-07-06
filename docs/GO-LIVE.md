# MAESTRO — Scharfschalten des Live-Flows

> Stand 2026-07-06. Der Composio-REST-Contract ist gegen die Doku bestätigt; die Adapter im
> Worker passen (Endpoint/Auth/Body/Response). Zum Live-Betrieb fehlt nur **ein** Secret.

## Was schon erledigt ist
- ✅ Alle nicht-geheimen Live-Vars stehen in `apps/api/wrangler.toml` (`MAIL_FROM`,
  `MAIL_SENDER_NAME`, `WEB_BASE_DOMAIN`, `DEPOSIT_PERCENT_BP`).
- ✅ Alle DB-Migrationen (30–50) sind bereits auf Neon angewendet.
- ✅ Worker bündelt sauber (Dry-Run-Deploy ok), 139/139 Tests grün.
- ✅ Composio-Verbindungen ACTIVE + live bewiesen (Anthropic, LexOffice, Resend, Stripe).

## Deine 3 Schritte
1. **Neuesten Stand einspielen & deployen** (im lokalen `maestro-cloud`):
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

## ⚠️ Vor echten Kunden beachten
- **Stripe ist LIVE-Mode** (echte Zahlungen). Für Tests eine **Test-Mode**-Composio-Verbindung
  nutzen. Für Mehrmandanten kommt **Stripe Connect je Betrieb** dazu (`application_fee`).
- **AVV / EU-KI-Verarbeitung** mit Anthropic/OpenAI vor echtem Kundenbetrieb bestätigen.
- Aufräumen aus den Tests: LexOffice-Entwurf **AG0237** löschen, Stripe-Test-Produkt
  **`prod_Upr3wu0wSzgYGN`** archivieren (Link ist bereits inaktiv).
- `MAIL_SENDER_NAME`/`MAIL_FROM` sind derzeit plattformweit (Storia als erster Mandant); je
  Mandant individualisieren ist eine spätere Ausbaustufe (aus `tenants`).
