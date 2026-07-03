# MAESTRO SaaS Playbook

## Projekt-Kontext

MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route `/admin` im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
produktiv und darf nicht unterbrochen werden.

Ziel (Gesamtprogramm): MAESTRO als eigenständiges Multi-Tenant-SaaS auf
Neon (Postgres, EU/Frankfurt, mit Neon Auth) + Cloudflare herauslösen. Die
Website events-storia.de bleibt bei IONOS und wird technisch von MAESTRO
getrennt. PublicOffer (Kunden-Angebotsseite) gehört zu MAESTRO.

Strategie: Paralleler Aufbau des neuen Stacks neben dem alten. Beide laufen
gleichzeitig; das alte Tool wird erst nach validierter Migration abgeschaltet.

## Fortschritts-Tracking

### Phase 0 – Sicherheitslücken im laufenden System schließen
- [x] `supabase/functions/lex-inspect` (offener LexOffice-Proxy) gelöscht + Referenz in `supabase/config.toml` entfernt
- [x] `inbound-maestro-email` + `receive-inbound-email`: `x-webhook-secret` gegen Umgebungs-Secret geprüft, unsignierte Requests → 401
- [x] `public/vorschau-lagourres-restzahlung.html` (echte Kundendaten) gelöscht
- [x] RLS: `"Anyone can insert v2_events"` und `"...read v2_event_emails"` durch tenant-restriktive Varianten ersetzt (Migration `20260703120000_restrict_v2_events_v2_event_emails_rls.sql`)
- [x] Microsoft Clarity hinter Cookie-Consent gelegt

→ PR: https://github.com/dream-anchor/events-storia.de/pull/2 (Draft)

### Phase 1 – Neon/Cloudflare-Fundament (offen)
- [ ] TBD

### Phase 2 – Datenmigration (offen)
- [ ] TBD

## Offene Rücksprache-Punkte

- **IMAP-Relay**: Entscheidung offen, wie/ob der bestehende IMAP-Sync (`supabase/functions/imap-sync`) beim Herauslösen von MAESTRO weiterläuft oder durch den Cloudflare-Email-Worker ersetzt wird.
- **Stripe Connect**: Entscheidung offen, ob Multi-Tenant-Payments über Stripe Connect (pro Tenant eigener Account) oder zentral über einen Storia-Account laufen.
- **Retention-Fristen**: Entscheidung offen, wie lange Kunden-/Event-Daten je Tenant vorgehalten werden (`purge-retention`-Funktion), insb. im Hinblick auf DSGVO bei Multi-Tenant-Trennung.
