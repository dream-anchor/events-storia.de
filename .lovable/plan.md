# Session D — Daily Audit + Preflight

Sessions A–C laufen: Hub-Tabelle steht, Maestro-Edge-Functions melden, Ristorante meldet (Hub-Connection bestätigt). Session D schließt die Schleife mit **proaktiver Beobachtung** (täglicher Digest) und einem **Pre-Deploy-Gate**.

## Ziel

1. **Daily Audit** — einmal pro Tag (08:00 Europe/Berlin) wird der Health-Status beider Projekte zusammengefasst und per E-Mail an `info@events-storia.de` geschickt. Kein Rauschen — nur wenn es etwas zu sagen gibt.
2. **Preflight** — ein lokal/CI ausführbares Script, das vor einem Publish blockiert, wenn offene kritische Fehler oder fehlende Secrets existieren.

## Was wird gebaut

### 1. Migration: `system_health_audit_runs`

Neue Tabelle, um jeden Audit-Lauf für Traceability zu speichern.

Felder (Domain): `run_at`, `window_hours`, `summary` (jsonb), `email_sent`, `email_id`, `had_blockers` (bool).

RLS: nur Admins lesen (gleiche Policy wie `system_errors`).

### 2. Edge Function: `system-health-daily-audit`

- `verify_jwt = false` (wird vom Cron via pg_net aufgerufen)
- Sammelt für die letzten 24h pro Projekt (`events_storia`, `ristorante_storia`):
  - **Neue kritische Fehler** (severity = critical, first_seen > now()-24h, unresolved)
  - **Eskalierende Fehler** (count-Zuwachs > 10 in 24h, unresolved)
  - **Stille kritische Alt-Fehler** (severity = critical, unresolved, älter als 7 Tage)
  - **Top-3 by count** (24h)
- Schreibt einen Eintrag in `system_health_audit_runs`
- Sendet **nur dann** eine E-Mail (via bestehender Resend-Infra), wenn mindestens eine Kategorie nicht leer ist
  - Empfänger: `info@events-storia.de`
  - Betreff: `[System-Health] Tägliche Übersicht — N kritisch / M eskalierend`
  - Body: monochrome Light-Mode-Tabelle, Links zu `/admin/system-health`
- Keine WhatsApp-Eskalation (das macht bereits das Realtime-System bei akuten Fehlern)

### 3. pg_cron Job

Täglich 08:00 Europe/Berlin (= 06:00/07:00 UTC, je nach DST — wir nehmen `0 6 * * *` UTC, also Sommerzeit 08:00 / Winterzeit 07:00, was für eine 08-Uhr-Mail akzeptabel ist).

Wird via `insert`-Tool angelegt (enthält projektspezifische URL).

### 4. Preflight-Script: `scripts/preflight.mjs`

CLI-Tool (`node scripts/preflight.mjs`). Prüft:
- **Secrets vorhanden**: `SYSTEM_HEALTH_SHARED_SECRET`, `RESEND_API_KEY`, `LEXOFFICE_API_KEY`, `STRIPE_SECRET_KEY` (best-effort via Supabase Management API oder lokale `.env` falls vorhanden — primär: nur Existenzprüfung über Edge-Function-Aufruf, der `Deno.env.get` testet)
- **Offene kritische Fehler** (24h) — schlägt fehl wenn > 0 und `--strict`
- **Letzter Audit-Lauf** existiert und ist < 36h alt
- **Hub-Connection-Test** (POST mit Test-Payload an `report-system-error` mit shared secret)

Exit-Codes: 0 = clean, 1 = Warnungen, 2 = Blocker.

Aufruf-Hinweis im README.

### 5. Admin-UI-Ergänzung in `SystemHealth.tsx`

Neue Karte oben: **"Letzter Audit-Lauf"** mit
- Zeitpunkt
- Zusammenfassung (Counts)
- Button "Jetzt manuell ausführen" → ruft `system-health-daily-audit` ad-hoc auf
- Tabelle der letzten 7 Audit-Läufe

## Was wird NICHT gebaut

- Keine Anomalie-Erkennung auf Function-Ebene (würde Traffic-Tracking voraussetzen, das wir nicht haben)
- Kein Slack/Teams-Webhook (nicht angefragt)
- Kein "Auto-Heal" / Retry-Logik
- Keine Änderungen an Sessions A–C oder am Ristorante-Projekt

## Technical Notes

```text
pg_cron (06:00 UTC daily)
        │
        ▼
net.http_post → system-health-daily-audit (Hub)
        │
        ├─ SELECT system_errors WHERE …
        ├─ INSERT system_health_audit_runs
        └─ wenn nicht leer → Resend → info@events-storia.de
```

E-Mail-Body folgt Memory-Vorgaben: Inter, monochrome, kein Grün/Gelb, `info@events-storia.de` als Absender, dynamische DB-Signatur.

Bestätige den Plan, dann lege ich Migration + Function + Cron + Preflight-Script + UI-Karte in einem Rutsch an.
