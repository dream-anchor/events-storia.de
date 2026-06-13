## Ziel

1. WhatsApp-Einträge erscheinen nie im Zustellfehler-Banner (es gibt keinen WhatsApp-Versand an Kunden – diese Logs sind interne Alerts).
2. Klick auf „Erledigt" entfernt den Vorfall sofort, beim letzten Vorfall verschwindet das gesamte Banner.
3. Jede Resolve-Aktion wird dauerhaft im Aktivitäten-Log der Anfrage festgehalten (Wer / Wann / Welche Email).

## Änderungen

### 1. WhatsApp aus Failure-Quellen ausschließen
`src/hooks/useEmailFailures.ts`
- In `useEmailFailuresForEntity` und `useGlobalEmailFailures` die Query zusätzlich filtern:
  - `.neq("provider", "whatsapp_meta")` und client-seitig `recipient_email` nicht mit `whatsapp:` beginnen lassen (Defensive für Altdaten).
- `isUnresolved` zusätzlich `false` zurückgeben bei `provider === 'whatsapp_meta'` oder `recipient_email?.startsWith('whatsapp:')`.

Damit verschwindet sowohl die rote Umrandung in Kanban/Liste als auch das Banner im Editor für reine WhatsApp-Logs.

### 2. Optimistisches Entfernen + Aktivitäts-Log
`src/hooks/useEmailFailures.ts`
- `resolveEmailFailure(id, currentMetadata, ctx)` erweitern: Nach erfolgreichem UPDATE einen Insert in `activity_logs` schreiben:
  - `entity_type`: aus dem Log-Eintrag (`inquiry` o.ä.)
  - `entity_id`: `entity_id` des Logs
  - `action`: `'email_failure_resolved'`
  - `actor_id` / `actor_email`: aus `supabase.auth.getUser()`
  - `metadata`: `{ recipient_email, subject, status, sent_at, log_id }`
- Neuer Hook-Helper / Mutation, die nach Erfolg den React-Query-Cache optimistisch updatet:
  `qc.setQueryData(["email-failures", "entity", entityId], (old) => old?.filter(x => x.id !== id))` und entsprechend für `["email-failures", "global"]`. Damit verschwindet die Karte sofort, ohne auf Realtime/Refetch zu warten.

`src/components/admin/refine/InquiryEditor/EmailFailureBanner.tsx`
- Resolve-Aufruf reicht jetzt `entity_type`/`entity_id` mit, nutzt optimistic update. Banner returnt bereits `null` bei leerer Liste – nach Entfernen des letzten Vorfalls verschwindet die gesamte Box automatisch.

### 3. Aktivitäten-Anzeige
Im bestehenden Aktivitäten-/Activity-Feed der Anfrage neuen Action-Typ `email_failure_resolved` rendern (Icon + Text „Zustellfehler an {recipient_email} als erledigt markiert von {actor}"). Falls ein generischer Renderer existiert, reicht ein Label-Mapping; sonst kleine Case-Erweiterung.

## Verifikation
- WhatsApp-Eintrag (wie Screenshot 1) ist nicht mehr sichtbar, rote Umrandung verschwindet.
- Bei Anfrage mit 3 echten Email-Fehlern (Screenshot 2): Erledigt entfernt jeweils einen, beim letzten verschwindet das Banner; Realtime-Update spiegelt das auch in Kanban/Liste.
- Aktivitäten-Tab zeigt die Resolve-Einträge mit Zeitstempel und Bearbeiter.

## Nicht-Ziele
- Kein Schema-Change an `email_delivery_logs`.
- Keine Änderung an Versand-Funktionen außer der bereits vorhandenen WhatsApp-Skip-Logik.
