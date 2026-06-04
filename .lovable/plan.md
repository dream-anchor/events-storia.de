# LexOffice → Maestro Webhook-Sync

Ziel: Wenn eine Rechnung in LexOffice geändert wird (Status, Beträge, Positionen, Zahlung), wird Maestro in Echtzeit aktualisiert. Bei lokal abweichendem Stand: Warnung statt Auto-Overwrite.

## Zwei Synchronisationswege

**Weg 1 – Maestro → LexOffice (bereits vorhanden)**
- Neue Rechnungen werden über `create-lexoffice-*` Funktionen angelegt.
- Stornierung über `void-lexoffice-invoice`.
- Bleibt unverändert.

**Weg 2 – LexOffice → Maestro (NEU)**
- LexOffice Event-Subscription ruft Edge-Function-Webhook bei jeder Änderung an.
- Webhook holt das aktuelle Voucher/Invoice-Objekt aus LexOffice und schreibt es nach Maestro.

## Komponenten

### 1. Neue Edge Function: `lexoffice-webhook`
- Öffentlich erreichbar (`verify_jwt = false`).
- Authentizität: Lexware vergibt kein Shared Secret. Stattdessen prüft die Funktion optional den `X-Lxo-Signature`-Header (RSA-SHA256) gegen Lexwares Public Key (`LEXOFFICE_WEBHOOK_PUBLIC_KEY` in PEM/SPKI-Format).
- Ist kein Public Key konfiguriert, akzeptiert der Endpoint alle Requests — das ist sicher, weil der Payload nur eine `resourceId` enthält und der Sync die Rechnung mit unserem eigenen `LEXOFFICE_API_KEY` aus Lexware nachlädt. Eine gefälschte Anfrage kann maximal einen Re-Sync einer ohnehin uns gehörenden Rechnung auslösen.
- Akzeptiert Event-Typen: `invoice.changed`, `invoice.status.changed`, `payment.changed`, `voucher.changed`, `voucher.deleted`.
- Lädt vollständigen LexOffice-Datensatz nach (Status, Beträge, Positionen, Zahlungen).
- Schreibt nach Maestro (siehe unten).

### 2. Neue Edge Function: `sync-lexoffice-invoice`
- Manueller Trigger (Admin-UI Button "Aus LexOffice aktualisieren") und vom Webhook intern aufgerufen.
- Input: `lexoffice_invoice_id`.
- Vergleicht LexOffice-Stand mit Maestro-Stand → erkennt Konflikte.

### 3. Datenbank-Erweiterungen
Migration auf `v2_payments`:
- `lexoffice_last_synced_at TIMESTAMPTZ`
- `lexoffice_remote_version INT` (LexOffice `version`-Feld)
- `lexoffice_remote_status TEXT` (open/paid/voided)
- `lexoffice_remote_total_cents INT`
- `lexoffice_sync_conflict BOOLEAN DEFAULT FALSE`
- `lexoffice_conflict_details JSONB` (welche Felder weichen ab)

Neue Tabelle `lexoffice_sync_log`:
- `id, lexoffice_invoice_id, event_type, payload JSONB, applied BOOLEAN, conflict BOOLEAN, error TEXT, created_at`
- Audit-Trail aller Webhook-Events.

### 4. Sync-Logik
Pro Event:
1. LexOffice-Voucher per `get-lexoffice-document-by-id` abrufen.
2. Maestro-Zeile (`v2_payments` via `lexoffice_invoice_id`) laden.
3. Felder vergleichen (Status, `totalAmount`, `lineItems`-Hash, Zahlungen).
4. Wenn lokal **nichts geändert** seit letztem Sync → Update durchführen (Status, Beträge, `paid_at`, `paid_via`).
5. Wenn lokal **abweichend** (z. B. Maestro-Stand zeigt anderen Betrag oder neueres `updated_at` als `lexoffice_last_synced_at`) → `lexoffice_sync_conflict = true`, `lexoffice_conflict_details` mit Diff befüllen, KEIN Auto-Overwrite.
6. PDF-Cache invalidieren (`get-lexoffice-document` zieht beim nächsten Aufruf frisch).
7. Eintrag in `lexoffice_sync_log` schreiben.
8. Wenn Status auf `paid` wechselt: Admin-Benachrichtigung via bestehender Notification-Pipeline (E-Mail + WhatsApp).

### 5. Admin-UI
- **Inquiry-Detail / Rechnungs-Karte**: 
  - Badge "LexOffice-Stand abweichend" wenn `lexoffice_sync_conflict = true`.
  - Diff-Dialog: zeigt Maestro vs. LexOffice nebeneinander (Status, Betrag, Positionen).
  - Buttons: "LexOffice übernehmen" (overwrite Maestro) / "Maestro behalten" (LexOffice neu pushen) / "Konflikt verwerfen".
  - "Aus LexOffice aktualisieren"-Button (manueller Refresh-Trigger).
- **Letztes Sync-Datum** unter der Rechnung.

### 6. LexOffice-Setup (Doku für User)
Da LexOffice keine Self-Service-Webhook-API hat, gibt es zwei Setup-Pfade:
- **Bevorzugt**: LexOffice "Event-Subscriptions" via API einrichten (per einmaligem Setup-Skript in der Edge Function `lexoffice-webhook-setup`).
- **Fallback**: Wenn LexOffice-Plan keine Subscriptions zulässt, läuft alternativ ein 5-Minuten-Polling-Cron (`pg_cron` auf `sync-lexoffice-payment-status` erweitert), bis Webhooks aktiv sind.

## Secrets
- Optional: `LEXOFFICE_WEBHOOK_PUBLIC_KEY` (PEM, SPKI). Wenn gesetzt, wird jeder eingehende Webhook gegen die Signatur geprüft. Lexware veröffentlicht den passenden Public Key in der Event-Subscriptions-Doku.

## Out of Scope
- Bestehende stornierte/falsche Rechnungen werden nicht rückwirkend repariert.
- Maestro-seitige Bearbeitung finalisierter Rechnungen bleibt gesperrt (Immutability-Prinzip); Korrekturen geschehen weiterhin in LexOffice und fließen via Webhook zurück.
