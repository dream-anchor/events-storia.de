# STORIA Inbound Email Worker (Vorbereitet, nicht aktiv)

> **Status:** Code vorbereitet, aber **nicht deployed**. Wird erst aktiv wenn `events-storia.de` von IONOS zu Cloudflare DNS migriert wird.
>
> **Aktuell:** Reply-To in Angebotsmails geht an `info@events-storia.de` (IONOS-Postfach). Antworten werden manuell im Postfach bearbeitet.

Cloudflare Email Worker, der eingehende Antwortmails an Angebots-Mails entgegennimmt und an die Supabase Edge Function `receive-inbound-email` weiterleitet. Dadurch werden Kunden-Replies automatisch dem richtigen Angebot in StoriaMaestro zugeordnet.

## Architektur (nach Migration)

```
Kunde → Reply an reply+INQUIRY_ID@reply.events-storia.de
          ↓
Cloudflare Email Routing (MX reply.events-storia.de)
          ↓
Cloudflare Email Worker (dieser Code)
          ↓
POST /functions/v1/receive-inbound-email (Supabase)
          ↓
email_messages Tabelle (Thread-Konversation in StoriaMaestro)
```

**Warum eine Subdomain?** `events-storia.de` hat ein produktives IONOS-Postfach (`info@events-storia.de`). Das MX bleibt bei IONOS. Nur `reply.events-storia.de` bekommt Cloudflare-MX und routet zum Worker.

## Voraussetzung: DNS-Migration

1. `events-storia.de` von IONOS-Nameservern (ui-dns.*) zu Cloudflare umziehen
2. Alle bestehenden DNS-Records (A, CNAME, MX für IONOS-Postfach, SPF, DKIM) in Cloudflare übernehmen
3. Erst dann macht dieser Worker Sinn

Siehe `paterbrown.com` Migration als Referenz (ist 2025 gelaufen).

## Setup (nach Migration, einmalig)

### 1. DNS (Cloudflare Dashboard → events-storia.de → DNS)

Nur für die Subdomain `reply.events-storia.de`:

```
Type   Name    Content                        Priority  TTL
MX     reply   route1.mx.cloudflare.net       36        Auto
MX     reply   route2.mx.cloudflare.net       57        Auto
MX     reply   route3.mx.cloudflare.net       85        Auto

TXT    reply   "v=spf1 include:_spf.mx.cloudflare.net ~all"
```

Die bestehenden MX-Records für `events-storia.de` (IONOS-Postfach) bleiben **unangetastet**.

### 2. Cloudflare Email Routing aktivieren

Cloudflare Dashboard → events-storia.de → **Email Routing** → **Routing Rules** → **Catch-all**:
- Destination: **Send to Worker**
- Worker: `storia-inbound-email`
- Scope: nur für `reply.events-storia.de` (nicht für die Apex)

### 3. Worker deployen

```bash
cd cloudflare-workers/email-reply
npm install

npx wrangler secret put SUPABASE_URL
# → https://sovlfqncotxcjqseeawp.supabase.co

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# → Service Role Key (Supabase → Settings → API)

npx wrangler deploy
```

### 4. Code-Anpassung aktivieren

In `supabase/functions/send-offer-email/index.ts` die Zeile
```ts
const replyToAddress = 'info@events-storia.de';
```
ändern zu
```ts
const replyToAddress = `reply+${inquiryId}@reply.events-storia.de`;
```

## Testen

1. Ein Test-Angebot in StoriaMaestro verschicken
2. Die Angebotsmail im Postfach ansehen — `reply_to` sollte `reply+UUID@reply.events-storia.de` sein
3. Darauf antworten (normaler "Antworten"-Button im Mail-Client)
4. **In StoriaMaestro → Event → Kommunikation-Tab** prüfen: Antwort sollte als neuer Thread-Eintrag erscheinen (1–2 Min.)

### Debugging

```bash
npx wrangler tail            # Live-Logs
dig reply.events-storia.de MX  # Sind die CF-MX-Records da?
```

## Limits (Cloudflare Email Workers, Free Plan)

- 100.000 Mails/Tag
- 25 MB pro Mail (inkl. Anhänge)
- 10s Worker-Runtime

Reicht für STORIA's Volumen locker aus.

## Warum kein Resend Inbound?

Resend hat **kein natives Inbound** (Stand 2026). Alternativen wie Postmark oder Mailgun sind kostenpflichtig. Cloudflare Email Routing + Worker ist **kostenfrei** — aber eben nur auf Cloudflare-Domains.

## Dateien

- `src/index.ts` — Worker-Code (parst RFC822, POSTet an Supabase)
- `wrangler.toml` — Deployment-Config
- `package.json` — Dependencies (postal-mime für MIME-Parsing)
