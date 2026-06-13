## Ziel

Jede Email, die nicht erfolgreich zugestellt wurde (bounced, complained, failed, suppressed, delayed >24h), wird sofort:
1. mit einer **DRINGEND**-Mail an `info@events-storia.de` gemeldet,
2. **rot** im jeweiligen Angebot (Inquiry-Detailseite) markiert,
3. **rot** in der Inquiry-Übersichtsliste (`UnifiedInquiriesList`) markiert,
4. **rot** im Admin-Dashboard als Tile/Counter angezeigt.

Quelle ist die bestehende Tabelle `email_delivery_logs` (Status: `bounced | complained | failed | delayed | suppressed`). Aktuell ist bereits Logik vorhanden, aber niemand bemerkt Fehler.

## Architektur

```text
Resend Webhook (bounced/complained/failed)
  → receive-resend-webhook (update status)
      → NEU: notify-email-failure (DRINGEND-Mail an info@)
                + insert system_errors / email_failures Eintrag
                + cache invalidieren

Inquiry-Detail / Liste / Dashboard
  → useEmailFailures(entityId | global)
      → SELECT * FROM email_delivery_logs WHERE status IN (failed, bounced, complained, suppressed)
      → rotes Badge / Banner
```

Auch der initiale Send-Fehler (z.B. `send-offer-email` wirft Exception, Resend antwortet 4xx/5xx) wird bereits als `status='failed'` geloggt — derselbe UI-/Alert-Pfad greift.

## Backend-Änderungen

### 1. Neue Edge Function `notify-email-failure`
Datei: `supabase/functions/notify-email-failure/index.ts`

- Input: `{ deliveryLogId: string }`
- Liest Log-Eintrag (entity_type, entity_id, recipient, subject, status, error_message, provider).
- Resolviert Inquiry-Titel/Customer-Name aus `event_inquiries` / `group_inquiries` / `catering_inquiries` über entity_type.
- Sendet via bestehender Infrastruktur (`send-raw-html-email` oder direkt Resend) an `info@events-storia.de`:
  - **Subject:** `🚨 DRINGEND: Email an {recipient} nicht zugestellt ({status})`
  - **Body:** Monochrome HTML, deutsch, mit:
    - Status-Badge rot
    - Empfänger, Original-Subject, Fehlertext, Provider, Zeitstempel
    - Direktlink zur Inquiry: `https://events-storia.de/admin/inquiry/{entity_id}`
    - Hinweis: "Bitte alternativen Kontaktweg (Telefon/WhatsApp) verwenden."
- BCC: keine.
- Idempotenz: setzt `metadata.alert_sent_at` auf dem Log-Eintrag und überspringt, wenn schon gesetzt (verhindert Mehrfach-Mails bei Webhook-Retries).

### 2. `receive-resend-webhook` erweitern
Wenn `newStatus IN ('bounced','complained','failed','delayed')` UND `metadata.alert_sent_at` fehlt, invoke `notify-email-failure` async (fire-and-forget, kein Block des Webhook-200).

### 3. Bestehende Senders erweitern
In jedem Send-Function-Catch (`send-offer-email`, `send-payment-email`, `send-invoice-email`, `send-menu-confirmation`, `send-customer-response-copy`, `send-raw-html-email`, `send-cancellation-notification`, `send-payment-confirmation-v2`) — wenn der Provider-Call wirft und ein Log mit `status='failed'` geschrieben wird: zusätzlich `notify-email-failure` invoken. **Implementierung:** zentral via DB-Trigger statt N Code-Stellen.

### 4. Migration: DB-Trigger
```text
CREATE TRIGGER email_delivery_failure_notify
AFTER INSERT OR UPDATE OF status ON email_delivery_logs
FOR EACH ROW
WHEN (NEW.status IN ('failed','bounced','complained','suppressed')
      AND (NEW.metadata->>'alert_sent_at') IS NULL)
EXECUTE FUNCTION notify_email_failure_trigger();
```
Trigger-Funktion ruft `notify-email-failure` per `pg_net` HTTP-POST mit `deliveryLogId`. Damit greift es egal welcher Sender oder welcher Webhook den fail-Status setzt.

## Frontend-Änderungen

### 5. Hook `useEmailFailures.ts`
Zwei Varianten:
- `useEmailFailuresForEntity(entityType, entityId)` → Anzahl + jüngste Fehler für eine Inquiry.
- `useGlobalEmailFailures()` → alle ungelösten Fehler der letzten 30 Tage für Dashboard/Liste; Realtime-Subscribe auf `email_delivery_logs`.

"Ungelöst" = `status IN (failed,bounced,complained,suppressed)` AND `metadata->>'resolved_at' IS NULL`.

### 6. Inquiry-Detail (Angebot)
Neue Komponente `EmailFailureBanner.tsx` im InquiryEditor oben unter dem Header:
- Roter `bg-destructive/10 border-destructive` Banner (einzige zulässige rote Akzentfarbe — bewusste Abweichung von Monochrome wegen Alarm-Charakter; passt zu bestehenden Restzahlungs-/Storno-Warnungen).
- Liste der Fehler: Empfänger, Status, Zeit, Fehlertext.
- Button "Als erledigt markieren" → setzt `metadata.resolved_at` + `resolved_by`.
- Button "Erneut senden" (falls Sender bekannt) → ruft passenden Sender erneut auf.

### 7. Inquiry-Liste `UnifiedInquiriesList.tsx`
- Pro Zeile: roter Punkt links neben dem Titel, wenn `useEmailFailuresForEntity` > 0.
- Filter-Chip "Email-Fehler" oben — zeigt nur Inquiries mit offenen Email-Fehlern.

### 8. Dashboard
- Neue Tile "Email-Fehler" zwischen den bestehenden Counter-Tiles. Roter Hintergrund wenn > 0.
- Klick → öffnet Inquiry-Liste mit Filter "Email-Fehler" aktiv.

### 9. Realtime
Supabase-Channel `email-failures` auf `email_delivery_logs` (INSERT/UPDATE). Alle drei Surfaces (Detail, Liste, Dashboard) invalidieren ihre Queries.

## Auflösungs-Flow

- "Als erledigt markieren" → `UPDATE email_delivery_logs SET metadata = metadata || jsonb_build_object('resolved_at', now(), 'resolved_by', auth.uid())`.
- Trigger nicht erneut feuern (WHERE-Klausel im Trigger prüft `resolved_at`).

## Out of Scope

- WhatsApp-Alarm für Email-Fehler (separate Iteration, kann via bestehender `send-whatsapp-alert` Function leicht ergänzt werden).
- Auto-Retry der ursprünglichen Mail.
- Suppression-Verwaltung (Resend-Dashboard bleibt Quelle).

## Verifikation

1. Test-Mail an `bounce@simulator.amazonses.com` (oder Resend-Test-Adresse) versenden → Status wird `bounced` → DRINGEND-Mail kommt bei info@ an, rotes Banner im Angebot, rote Tile im Dashboard.
2. `send-offer-email` mit absichtlich invalider Resend-API-Key → `status='failed'` → gleicher Pfad greift.
3. "Als erledigt markieren" entfernt Banner und Counter.
4. Zweiter Resend-Webhook-Retry für denselben Log löst keine zweite DRINGEND-Mail aus (Idempotenz via `alert_sent_at`).
5. Realtime: Status-Change auf einem Tab updated andere offene Tabs ohne Reload.
