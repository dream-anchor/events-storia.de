## Was passiert ist

Beim letzten Versand an `Natascha.Morgan@dataguard.com` lief der Flow korrekt:

1. 02:50 — Resend angenommen, Post-Send-Check liefert `suppressed` → roter Log „suppressed"
2. 02:51 — Zustellfehler-Activity geschrieben
3. 02:51 — `resend-via-smtp` ausgeführt → IONOS-SMTP-Retry erfolgreich, neuer Log mit Provider `ionos_smtp_retry`

Die Mail ist also via SMTP rausgegangen. Maestro zeigt aber trotzdem das rote „DRINGEND EMAIL-ZUSTELLFEHLER"-Banner, weil der ursprüngliche `suppressed`-Log nicht als `resolved_at` markiert wird, sobald der Fallback erfolgreich war. Genau das wird gefixt.

## Änderungen

### 1. `supabase/functions/resend-via-smtp/index.ts`
Nach erfolgreichem SMTP-Versand:
- Den auslösenden `email_delivery_logs`-Eintrag (Provider `resend`, gleicher `provider_message_id` bzw. übergebene `resend_log_id`) finden.
- `metadata` mergen mit:
  ```json
  {
    "resolved_at": "<ISO>",
    "resolved_via": "smtp_fallback",
    "smtp_retry_message_id": "<neue smtp-id>"
  }
  ```
- Damit greift `isUnresolved()` in `useEmailFailures.ts` und das Banner verschwindet sofort (Realtime-Subscription invalidiert den Cache).

### 2. `supabase/functions/send-offer-email/index.ts`
Im Post-Send-Verification-Block, wenn der Fallback-Fetch zu `resend-via-smtp` ausgelöst wird, die `resend_log_id` (UUID des soeben geschriebenen Failure-Logs) mit übergeben, damit `resend-via-smtp` ihn eindeutig findet — auch wenn `provider_message_id` mehrfach existieren sollte.

### 3. `supabase/functions/receive-resend-webhook/index.ts`
Analog: Beim Webhook-getriggerten SMTP-Fallback die `resend_log_id` (= `existingLog.id`) mit an `resend-via-smtp` durchreichen.

### 4. Einmaliges Aufräumen
Den aktuell offenen `suppressed`-Log vom 14.06. 02:50 für `Natascha.Morgan@dataguard.com` per Datenupdate auf `resolved_at = now, resolved_via = 'smtp_fallback'` setzen, damit das Banner sofort weg ist (der Bounce-Eintrag vom 10.06. bleibt offen — der ist ein echter alter Vorfall ohne erfolgreichen Fallback und muss manuell auf „Erledigt" geklickt werden).

## Was sich NICHT ändert

- Keine UI-Änderung im Belege-Block (du hast Option „nur auto-resolven" gewählt). Wer es nachvollziehen will, sieht in den Aktivitäten weiterhin die volle Spur: roter `suppressed`-Log → „Zustellfehler" → „SMTP-Fallback ausgeführt" → grüner Versand-Log mit `ionos_smtp_retry`.
- Kein Eingriff in `email-sender.ts` (der Fallback dort funktioniert synchron bereits korrekt — der Bug betraf nur den asynchronen Post-Send-/Webhook-Pfad bei `send-offer-email`).
