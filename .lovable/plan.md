## Problem

Aktivitäten-Timeline (Screenshot 1) zeigt für 02:50/02:51 klar:
1. Resend `suppressed`
2. SMTP-Fallback `Versandt ✓`

Die Banner-Komponente (Screenshot 2) listet aber denselben 02:50-Vorfall weiter als DRINGEND · nicht zugestellt. Das ist der Widerspruch.

Grund: Das ursprüngliche Resend-Log (`id=7b3666ac…`) hat trotz erfolgreichem SMTP-Retry kein `metadata.resolved_at` bekommen. `useGlobalEmailFailures.isUnresolved()` filtert daher nicht und der Banner bleibt rot.

Der 10.06.-Bounce ist ein echter, ungelöster Fall (kein SMTP-Retry) und darf bleiben.

## Maßnahmen

### 1) Backfill (Migration)
Setzt für alle Resend-Failure-Logs `metadata.resolved_at = sent_at_smtp` + `resolved_via = 'smtp_fallback_backfill'`, sobald es ein erfolgreiches `ionos_smtp_retry`-Log gibt mit
`metadata.original_resend_message_id = resend.provider_message_id`.

Effekt sofort: 02:50-Eintrag verschwindet aus dem Banner. 10.06.-Bounce bleibt sichtbar.

### 2) `resend-via-smtp` härten
Nach `update(metadata=…)` die Anzahl betroffener Zeilen prüfen. Falls 0:
- zweite Strategie: alle Resend-Logs mit demselben `entity_id` + `recipient_email` + Status ∈ failure innerhalb der letzten 60 Min auflösen.
- detailliertes `console.log` (request resend_log_id, gefundene Treffer, update-result), sodass künftige Fälle in den Edge-Function-Logs nachvollziehbar sind.

### 3) Banner-UX (`EmailFailureBanner.tsx`)
Pro gelistetem Vorfall:
- Wenn `metadata.resolved_via === 'smtp_fallback*'`: Eintrag erscheint **nicht** im Banner (Safety-Net, eigentlich schon durch `isUnresolved` gefiltert).
- Optional kleines Info-Chip "Via SMTP-Fallback zugestellt um HH:MM" für historische Sichtbarkeit in der Inquiry-Detailansicht (separater Block unterhalb Aktivitäten, nicht im DRINGEND-Banner).

Header-Text dynamisch:
- Nur noch echte ungelöste Fälle zählen für "X Vorfälle".

### 4) Resend-Dashboard-Hinweis (klein)
Im suppressed-Resend-Eintrag in der Timeline einen Hinweis ergänzen:
"Resend.com zeigt diesen Versand weiterhin als *Suppressed*. Tatsächliche Zustellung erfolgte via SMTP-Fallback um 02:51 (siehe Eintrag oben)."
→ erklärt den scheinbaren Widerspruch zum externen Resend-Dashboard.

## Technische Details

- Migration enthält nur ein UPDATE-Statement, keine Schemaänderung.
- `resend-via-smtp` bleibt rückwärtskompatibel (Body-Schema unverändert).
- Banner-Filter ist clientseitig — kein zusätzlicher Query nötig.
- Keine UI-Änderung im Belege-Block.

## Was unverändert bleibt

- Aktivitäten-Timeline (zeigt bereits korrekt SMTP-Erfolg + Resend-Fehler).
- Bestehende Resend-Webhook-Logik.
- 10.06.-Bounce-Eintrag bleibt offen, "Erledigt"-Button funktioniert wie bisher.
