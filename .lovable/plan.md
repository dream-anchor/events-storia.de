## Ursachenanalyse

Auf der Inquiry-Seite (`/admin/inquiries/.../edit`) fragt die Timeline `email_delivery_logs` mit `entity_type='event_inquiry'` ab (Datei `SmartInquiryEditor.tsx`, Zeile 1106). Aber:

1. **Christinas Restzahlungs-Mail vom 24.05.** (`515ac390…`) wurde mit `entity_type='v2_event'` geloggt → unsichtbar.
2. **Alle 7 Angebots-Mails von Christina** (07.05.) wurden ebenfalls mit `entity_type='v2_event'` geloggt → unsichtbar.
3. Die Edge Function `send-raw-html-email` (die Restzahlung an Christina und Anzahlungsbestätigung an Jessica versendet hat) **loggt überhaupt nichts** in `email_delivery_logs`. Christinas Restzahlungs-Log wurde nur manuell von einer anderen Funktion (`receive-resend-webhook`?) als `v2_event` nachgetragen, Jessicas gar nicht.

Da Inquiry-ID und v2_event-ID identisch sind (gleiche UUID), ist die saubere Lösung: Timeline soll beide Entity-Types lesen, und der Raw-HTML-Sender soll künftig immer mitloggen.

## Plan

### 1. Timeline liest beide Entity-Types (Frontend)
- `src/hooks/useEmailDeliveryLogs.ts`: Query um `.in('entity_type', ['event_inquiry', 'v2_event'])` erweitern, wenn `entityType === 'event_inquiry'`.
- `src/hooks/useActivityLog.ts` (`useActivityLogs`): Analog erweitern, damit auch `offer_email_sent`-Einträge (entity_type `v2_event`) erscheinen.

Effekt: Christinas 7 Angebots-Mails und die Restzahlung erscheinen sofort in der Aktivitäten-Timeline. Keine Daten-Migration nötig.

### 2. `send-raw-html-email` loggt zukünftig automatisch
- Nach erfolgreichem Resend-POST ein `INSERT` in `email_delivery_logs` durchführen mit:
  - `entity_type = 'event_inquiry'` (Maestro-Standard)
  - `entity_id` = optional aus Request-Body (`event_id`/`inquiry_id`), sonst über die TO-Adresse + neuestes Event resolved (Lookup in `v2_events` JOIN `v2_customers`)
  - Für die zwei vordefinierten Presets `entity_id` hartkodieren:
    - `rigshospitalet-restzahlung-v3` → `316a0f27-8911-464f-97ea-c5135328f3d5`
    - `cyim-anzahlung-bestaetigung` → `90321866-239d-4331-a85b-fddf5280ce97`
  - `recipient_email`, `subject`, `provider='resend'`, `provider_message_id=data.id`, `status='sent'`, `sent_by=userData.user.email`, `metadata={ bcc, preset, type: 'manual_raw_html' }`

### 3. Christinas Restzahlungs-Mail nachtragen
- Die bestehende Reihe `515ac390…` (entity_type `v2_event`) bleibt, wird durch Schritt 1 sichtbar. Keine Insertion nötig.
- Falls Schritt 1 nicht greift (z. B. Schema-Cache), als Fallback eine Kopie mit `entity_type='event_inquiry'` einfügen.

### 4. Verifikation
- Inquiry-Seite Christina neu laden → Restzahlung + 7 Angebots-Mails erscheinen in „Aktivitäten“.
- Inquiry-Seite Jessica neu laden → Anzahlungsbestätigung erscheint.
- Nächste Mail über `send-raw-html-email` erzeugt automatisch einen Log-Eintrag.

## Technische Details

Geänderte Dateien:
- `src/hooks/useEmailDeliveryLogs.ts`
- `src/hooks/useActivityLog.ts`
- `supabase/functions/send-raw-html-email/index.ts`

Kein DB-Schema-Wechsel, keine Migration nötig.
