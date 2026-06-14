
## Ziel

1. **Resend = Primärversand**, SMTP IONOS = Fallback (Reihenfolge zurückdrehen).
2. **Maestro-Status darf nicht lügen**: Wenn Resend „Suppressed", „Bounced" oder „Complained" meldet, muss die Aktivität rot als Zustellfehler erscheinen — nicht grün „Zugestellt".
3. **Automatischer SMTP-Retry**: Sobald Resend eine Mail nach Versand als nicht-zustellbar meldet (Suppressed/Bounced/Failed), versendet Maestro dieselbe Mail automatisch erneut über IONOS-SMTP an `events-storia.de`.

## Was geändert wird

### A) `supabase/functions/send-offer-email/index.ts` (Versand-Funktion)

- Reihenfolge in `sendEmail()` umdrehen:
  1. **Resend zuerst** (mit PDF-Anhang, CC/BCC, Reply-To, Threading-Headers).
  2. Nur wenn Resend einen HTTP-Fehler / Exception liefert → **SMTP IONOS** als sofortiger Fallback (gleiche Mail, PDF, Header).
- `result.provider` wird korrekt gesetzt (`resend` oder `ionos_smtp_fallback`), damit man im Log sieht, welcher Weg verwendet wurde.
- Initial-Status im `email_delivery_logs` bleibt `queued` bei Resend (Webhook entscheidet später), bei SMTP-Fallback wird direkt `sent` gesetzt (kein Webhook).

### B) `supabase/functions/receive-resend-webhook/index.ts` (Webhook)

- Mapping erweitern um `email.failed` → `failed`.
- Bei Events `bounced`, `complained`, `failed`, sowie wenn Resend uns `email.delivery_delayed` mit `Suppressed`-Reason schickt:
  1. `email_delivery_logs.status` auf den realen Fehlerstatus setzen + `error_message` befüllen (z. B. „Recipient on suppression list").
  2. Neue Aktivität in `v2_event_activities` schreiben: „Zustellfehler an <empfänger> (Resend: <reason>)" — damit die grüne „Zugestellt"-Badge ersetzt bzw. ergänzt wird.
  3. **Automatischer SMTP-Retry**: Mail aus `v2_event_emails` (subject, html, to, cc, bcc, thread headers) laden und über die neue interne Funktion `resend-via-smtp` erneut zustellen. PDF wird nicht erneut angehängt (war im ersten Versand enthalten, kein Bedarf zur Doppelzustellung beim Retry; alternativ Re-Fetch via `lexoffice_quotation_id` aus den Metadaten, falls vorhanden).
  4. Doppel-Retry-Schutz: Flag `smtp_retry_attempted` in `v2_event_emails.metadata` setzen, damit dasselbe Resend-Event uns nicht mehrfach SMTP-en lässt.

### C) Neue Edge Function `supabase/functions/resend-via-smtp/index.ts`

- Input: `{ event_email_id }` (Zeile aus `v2_event_emails`).
- Lädt Empfänger/Subject/HTML/Threading aus der DB, optional PDF aus LexOffice (wenn `lexoffice_quotation_id` in `metadata`).
- Versendet ausschließlich über IONOS-SMTP (`smtp.ionos.de:465`, `SMTP_USER` / `SMTP_PASSWORD`).
- Loggt Ergebnis in `email_delivery_logs` als `provider: 'ionos_smtp_retry'` und schreibt Aktivität „SMTP-Fallback an <empfänger> ausgeführt".

### D) UI-Korrektur in `src/components/admin/shared/ConversationThread.tsx`

- Mapping ändern: `queued` → Label „Zustellung ausstehend" (gelb), nicht mehr „Zugestellt (wartend)".
- So entsteht kein falscher „Zugestellt"-Eindruck mehr, solange Resend keine echte Delivery-Bestätigung geschickt hat.

### E) Deployments

Edge Functions deployen: `send-offer-email`, `receive-resend-webhook`, `resend-via-smtp`.

## Was bewusst nicht geändert wird

- Resend bleibt Primärprovider (Wunsch des Nutzers).
- Andere E-Mail-Funktionen (`send-payment-email`, `send-invoice-email` etc.) bleiben unberührt; falls gewünscht, ziehen wir dieselbe Logik später in eine geteilte Helper-Funktion.
- Bestehende Suppressed-Adressen in Resend werden nicht automatisch entfernt — das ist ein manueller Schritt (Resend „Removed from suppression list").

## Technische Details

- Threading-Header (`In-Reply-To`, `References`) werden im SMTP-Retry aus `v2_event_emails.in_reply_to` rekonstruiert.
- LexOffice-PDF wird beim Retry nur dann erneut geholt, wenn `metadata.lexoffice_quotation_id` vorhanden ist; sonst geht die Mail ohne Anhang raus (Empfänger hat den Anhang i. d. R. ohnehin nie erhalten, weil Resend suppressed hat).
- Webhook-Sicherheit (Svix-Signatur, 5-Min-Replay-Schutz) bleibt unverändert.
- Operator-Email-Guard im `send-offer-email` bleibt aktiv und greift auch beim SMTP-Retry, da `resend-via-smtp` denselben Check ausführt.
