## Problem

Bei der letzten Test-Buchung mit Kostenübernahme (Zahlung später / Rechnung) hat **der Gast** die Bestätigungsmail erhalten, **wir aber nicht**.

## Ursache (in den Logs verifiziert)

Beide Mails laufen über die Funktion `notify-customer-response`:

```
09:44:41  Kunde   → mimmo2905@yahoo.de                       resend  delivered ✅
09:44:41  Admin   → info@events-storia.de, d.speranza@…      resend  delayed   ❌
09:36:40  Admin   → info@events-storia.de, d.speranza@…      resend  delayed   ❌
```

Resend nimmt die Mail an (`sent = true`), liefert sie aber an `info@events-storia.de` nicht aus → Status bleibt **`delayed`**. Weil der Code `sent = true` setzt, greift der **IONOS-SMTP-Fallback nicht**. Der Gast (yahoo.de) bekommt sein Mail, wir bekommen nichts.

Hintergrund: Wir senden **von** `info@events-storia.de` **an** `info@events-storia.de` über Resend. Resend stellt das per ausgehender MX an unser eigenes IONOS-Postfach zu, was IONOS regelmäßig deferred → "delayed".

(WhatsApp-Alarm scheitert separat mit `WhatsApp not configured` — nicht Teil dieses Fixes.)

## Lösung

In `supabase/functions/notify-customer-response/index.ts` die **Admin-Benachrichtigung** dual versenden:

1. **Primär: IONOS SMTP** für interne Empfänger (`info@events-storia.de`, `d.speranza@storia-muenchen.de`) — eigene Domain, sofort zustellbar, kein Resend-MX-Umweg.
2. **Fallback: Resend** falls SMTP-Credentials fehlen oder einen Fehler werfen.

Die **Kunden-Bestätigung** bleibt unverändert (Resend primär, da externe Empfänger).

**Subject bleibt unverändert.**

## Technische Details

Datei: `supabase/functions/notify-customer-response/index.ts`

- Reihenfolge der beiden Send-Blöcke für die Admin-Mail tauschen: erst SMTP (denomailer / IONOS), dann Resend als Fallback.
- `provider` in `email_delivery_logs` zeigt korrekt `ionos_smtp` bzw. `resend`.

Keine DB-Änderung, keine UI-Änderung, kein Eingriff in `confirm-order`, Subject oder Kunden-Mail.

## Out of Scope

- WhatsApp-Konfiguration (separater Task).
- Manuelles Nachsenden der verlorenen Test-Bestätigung — sag Bescheid, wenn ich sie nachschicken soll.
