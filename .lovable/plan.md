## Problem

In der Belege-Karte steht bei `Angebot AG0139` weiterhin **"Noch nicht versendet"**, obwohl im Block "Versendete Angebote" v1 mit Datum und Empfänger sauber als versendet ausgewiesen ist.

## Ursache (verifiziert per DB-Query)

`supabase/functions/list-lexoffice-documents/index.ts` (Zeile 185) sammelt die Versand-Historie aus `email_delivery_logs` und filtert dabei **strikt** auf `status = 'sent'`.

Resend schreibt aber abhängig vom Webhook-Event diese Status:
- `queued` (direkt nach Versand)
- `sent` (Resend-API hat angenommen)
- `delivered` (Empfänger-Server hat angenommen) ← unser realer Fall

Für die Anfrage `3602bf56…` stehen alle 3 Log-Einträge auf **`delivered`** mit korrekt gesetztem `metadata.lexoffice_quotation_id`. Der Filter wirft sie raus → `sends = []` → "Noch nicht versendet".

Die Karte "Versendete Angebote" zieht ihre Daten aus `v2_event_offer_history` / `v2_event_emails` und ist deshalb korrekt.

## Fix

**1 Datei, 1 Zeile in der Edge Function** `supabase/functions/list-lexoffice-documents/index.ts`:

```ts
// vorher
.eq("status", "sent")
// nachher
.in("status", ["queued", "sent", "delivered"])
```

Damit zählen alle tatsächlich abgesendeten Mails als "versendet" — egal ob der Resend-Webhook bereits `delivered` gemeldet hat oder noch im `queued`-Zustand hängt.

Zusätzlich für `invoice_email_sent` (Activity-Log-Pfad ab Zeile 207): kein Fix nötig — dort wird der Log nur bei tatsächlichem Versand geschrieben.

## Erwartetes Ergebnis

Belege-Karte zeigt für `AG0139` direkt:
> Versendet am 02.06.26, 20:12 an angel.zhu@guoguo.de

Identisch zur Anzeige im Block "Versendete Angebote". Keine Doppel-Wahrheit mehr.

## Nicht im Scope

- Backfill alter "Noch nicht versendet"-Anzeigen: behebt sich automatisch beim nächsten Card-Refresh.
- UI-Änderungen: nicht nötig — Rendering-Logik in `LexofficeDocumentsCard.tsx` ist korrekt.
- Schema-Änderungen: nicht nötig.
