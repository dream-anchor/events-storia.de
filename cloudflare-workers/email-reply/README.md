# STORIA Inbound Email Worker

Cloudflare Email Worker, der eingehende Antwortmails an Angebots-Mails entgegennimmt und an die Supabase Edge Function `receive-inbound-email` weiterleitet. Dadurch werden Kunden-Replies automatisch dem richtigen Angebot in StoriaMaestro zugeordnet.

## Architektur

```
Kunde → Reply an reply+INQUIRY_ID@reply.monot.com
          ↓
Cloudflare Email Routing (MX reply.monot.com)
          ↓
Cloudflare Email Worker (dieser Code)
          ↓
POST /functions/v1/receive-inbound-email (Supabase)
          ↓
email_messages Tabelle (Thread-Konversation in StoriaMaestro)
```

**Warum eine Subdomain?** `monot.com` nutzt Google Workspace (MX auf Google). Wenn Cloudflare Email Routing für die Apex-Domain aktiviert würde, würden Google-Mails kaputtgehen. Deshalb läuft das Inbound-Routing isoliert auf `reply.monot.com`.

## Setup (einmalig)

### 1. DNS (Cloudflare Dashboard → monot.com → DNS)

**Wichtig:** Die bestehenden MX-Records für `monot.com` (Google Workspace) bleiben unberührt.

Nur für die Subdomain `reply.monot.com` hinzufügen:

```
Type   Name    Content                        Priority  TTL
MX     reply   route1.mx.cloudflare.net       36        Auto
MX     reply   route2.mx.cloudflare.net       57        Auto
MX     reply   route3.mx.cloudflare.net       85        Auto

TXT    reply   "v=spf1 include:_spf.mx.cloudflare.net ~all"
```

Nach dem Hinzufügen: `dig reply.monot.com MX` sollte die 3 Cloudflare-Server zeigen.

### 2. Cloudflare Email Routing aktivieren

Cloudflare Dashboard → monot.com → **Email Routing** → **Routing Rules** → **Catch-all address**

- Destination: **Send to Worker**
- Worker: `storia-inbound-email` (wird unten deployed)

Das Catch-all muss auf dem Level `reply.monot.com` konfiguriert sein (falls Cloudflare das UI-seitig unterscheidet — sonst im Worker-Code).

### 3. Worker deployen

```bash
cd cloudflare-workers/email-reply
npm install

# Secrets setzen (Werte siehe 1Password / Supabase Dashboard)
npx wrangler secret put SUPABASE_URL
# → https://sovlfqncotxcjqseeawp.supabase.co

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# → Service Role Key (Supabase → Settings → API)

# Optional: zusätzliche Absicherung
npx wrangler secret put WEBHOOK_SECRET
# → irgendein random String, muss auch in receive-inbound-email als Env gesetzt sein

# Deploy
npx wrangler deploy
```

### 4. Worker mit Email Routing verknüpfen

Cloudflare Dashboard → Email Routing → Routing Rules → Edit Catch-all → Worker `storia-inbound-email` auswählen.

### 5. Code-Anpassung `send-offer-email`

Die Edge Function muss jetzt `reply+UUID@reply.monot.com` als Reply-To setzen (statt events-storia.de). Das ist bereits in diesem Commit erledigt.

## Testen

1. Ein Test-Angebot in StoriaMaestro verschicken
2. Die Angebotsmail im Postfach ansehen — `reply_to` sollte `reply+UUID@reply.monot.com` sein
3. Darauf antworten (normaler "Antworten"-Button im Mail-Client)
4. **In StoriaMaestro → Event öffnen → Kommunikation-Tab** prüfen: die Antwort sollte als neuer Thread-Eintrag erscheinen (innerhalb 1–2 Minuten)

### Debugging

```bash
# Live-Logs ansehen
npx wrangler tail

# Test-Mail von der Kommandozeile (via Gmail / Apple Mail reicht auch)
echo "Test-Antwort" | mail -s "Re: Angebot" reply+test-uuid@reply.monot.com
```

Wenn keine Mail ankommt:
- `dig reply.monot.com MX` → sind die Cloudflare-MX-Records da?
- Cloudflare Dashboard → Email Routing → **Activity** → zeigt eingehende Mails + ob der Worker aufgerufen wurde
- `wrangler tail` → zeigt Worker-Logs in Echtzeit

## Limits (Cloudflare Email Workers, Free Plan)

- 100.000 Mails/Tag
- 25 MB pro Mail (inkl. Anhänge)
- 10s Worker-Runtime

Reicht für STORIA's Volumen locker aus.

## Warum kein Resend Inbound?

Resend hat **kein natives Inbound** (Stand 2026). Alternativen wie Postmark oder Mailgun sind kostenpflichtig und brauchen eigenes Setup. Cloudflare Email Routing + Worker ist **kostenfrei** und sauberer, weil wir eh schon Cloudflare als DNS haben.

## Dateien

- `src/index.ts` — Worker-Code (parst RFC822, POSTet an Supabase)
- `wrangler.toml` — Deployment-Config
- `package.json` — Dependencies (postal-mime für MIME-Parsing)
