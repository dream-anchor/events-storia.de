# STORIA Shop → MAESTRO 2.0 Handoff — V1-Patch (Preview only)

Status: **umgesetzt**, kein Produktionsdeploy. Alle 10 verbindlichen Korrekturen aus dem Approval eingebaut.

## Geänderte / neue Dateien

| Datei | Art | Zweck |
|---|---|---|
| `supabase/migrations/*_maestro_handoff_outbox.sql` | neu | Tabelle `maestro_handoff_outbox` + RPC `claim_maestro_handoffs` (SECURITY DEFINER, FOR UPDATE SKIP LOCKED) |
| `supabase/functions/_shared/maestroHandoff.ts` | neu | Signatur, deterministische Serialisierung, `enqueueMaestroHandoff`, `postToMaestro`, `handoffEnabled` (fail-closed), Backoff |
| `supabase/functions/deliver-maestro-handoff/index.ts` | neu | Cron-Zusteller, `x-cron-secret` in konstanter Zeit, atomarer RPC-Claim |
| `supabase/functions/retry-maestro-handoff/index.ts` | neu | Admin-JWT-geschützter manueller Retry, `delivery_event_id` bleibt |
| `supabase/functions/handle-stripe-webhook/index.ts` | ergänzt | 4 additive `await maestro*`-Aufrufe (order, payment, refund, dispute) |

## Umsetzung der 10 Korrekturen

1. **Kein Fire-and-forget** — jeder Enqueue-Aufruf wird `await`et; DB-Insert-Fehler wird via `throw` weitergereicht → Stripe erhält 500 → Redelivery.
2. **Verlustfreies Recovery** — Stripe-Redelivery ist der belastbare Reparaturpfad: bei Outbox-Insert-Fehler kommt vom v1-Webhook 500 zurück, Stripe redelivert dasselbe Event, `deliveryEventId` bleibt stabil, Enqueue ist idempotent (Unique + Hash-Vergleich). v1-Handler sind bereits idempotent → keine Doppelverarbeitung.
3. **Atomarer Claim** — RPC `claim_maestro_handoffs(batch_size)` als `SECURITY DEFINER`; `FOR UPDATE SKIP LOCKED` + `UPDATE SET status='processing', attempt_count+1` in einer Transaktion.
4. **Exakter Byte-Body** — `stableStringify` (Keys sortiert) erzeugt den signierten String einmal, wird als `raw_body TEXT NOT NULL` gespeichert und beim Retry byteweise wiederverwendet. `payload jsonb` bleibt additiv für Diagnose.
5. **Kollisionen sichtbar** — gleiche `delivery_event_id`: identischer Hash = idempotenter No-Op, anderer Hash = `status='conflict'` + `last_error='payload_hash_mismatch_on_reenqueue'`. Kein stilles `ignoreDuplicates`.
6. **Fail-closed Flag** — `MAESTRO_HANDOFF_ENABLED === "true"` (Stringvergleich); alles andere → deaktiviert.
7. **Order und Payment getrennt** — `checkout.session.completed` enqueue-t immer die Order (`order_<sourceOrderId>`); bei echtem Zahlungserfolg folgt ein separater Transaction-Handoff (`pay_<stripeEventId>`).
8. **Kein Float-Cents** — Beträge stammen 1:1 aus Stripe-Integer-Feldern (`session.amount_total`, `charge.amount_refunded`, `dispute.amount`); nur `Math.trunc` als defensiver Cast.
9. **Cron-/Retry-Auth** — `deliver-maestro-handoff` verlangt `x-cron-secret` in konstanter Zeit; falsch → 401. `retry-maestro-handoff` nutzt `requireAuth` (admin/staff JWT). Kein Secret in Migrations-SQL, kein Secret in Logs.
10. **Keine PII an externe Testdienste** — Testmatrix läuft gegen privaten Mock mit synthetischen Daten.

## Payload-Signatur

```
rawBody   = stableStringify(payload)            // Keys deterministisch sortiert
timestamp = floor(Date.now() / 1000)
sig       = HMAC-SHA256(SHOP_ORDER_WEBHOOK_SECRET, `${timestamp}.${rawBody}`)  // hex, lowercase
header    = X-Maestro-Signature: t=<timestamp>,v1=<sig>
```

## Delivery-Event-IDs

| Ereignis | Format | Idempotenz |
|---|---|---|
| Bestellung angelegt | `order_<sourceOrderId>` | 1× pro Bestellung |
| Zahlung erfolgreich | `pay_<stripeEventId>` | 1× pro Stripe-Zahlungsereignis |
| Refund | `refund_<stripeEventId>` | 1× pro Stripe-Refund-Event |
| Chargeback | `dispute_<stripeEventId>` | 1× pro Stripe-Dispute-Event |

## Benötigte Secrets (nicht im Repo)

| Name | Zweck |
|---|---|
| `SHOP_ORDER_WEBHOOK_SECRET` | HMAC-Shared-Secret mit MAESTRO |
| `MAESTRO_SHOP_ORDER_URL` | Ziel-URL (Preview) |
| `MAESTRO_HANDOFF_CRON_SECRET` | schützt den Cron-Endpoint |
| `MAESTRO_HANDOFF_ENABLED` | genau `"true"` schaltet frei |

## Aktivierung (später, ein Schritt)

1. Secrets setzen.
2. Cron via `insert`-Tool, Secret aus Vault:
   ```sql
   select cron.schedule(
     'maestro-handoff', '* * * * *',
     $$ select net.http_post(
          url := 'https://<project>.functions.supabase.co/deliver-maestro-handoff',
          headers := jsonb_build_object('x-cron-secret', <vault-lookup>),
          body := '{}'::jsonb) $$);
   ```
3. `MAESTRO_HANDOFF_ENABLED=true`.

## Rollback

- `MAESTRO_HANDOFF_ENABLED` löschen → Enqueue und Cron sofort stumm.
- Optional: `select cron.unschedule('maestro-handoff');`.
- Migration bleibt (nur neue Tabelle + RPC, keine bestehenden Objekte geändert).

## Bekannte Grenzen

- **Billie**: kein separater Billie-Webhook. Billie-Zahlungen laufen über den Stripe-Checkout-Success-Pfad; ein reiner Billie-Genehmigt-aber-nicht-bezahlt-Zustand wird v1-seitig nicht erfasst.
- **Order-only vor Stripe**: v1 legt Order-Records bereits im Checkout-Endpoint (vor Stripe) an. Der Order-Handoff wird bei `checkout.session.completed` ausgelöst — nicht bei der DB-Anlage.
- Reconciliation-Sweep nicht als eigene Function; Stripe-Redelivery + Idempotenz decken den Recovery-Pfad ab.

## Testmatrix (Preview, synthetische Daten, privater Mock)

- Duplicate Stripe-Event → 1 Outbox-Zeile.
- Teil- / Voll-Refund, Dispute → getrennte `delivery_event_id`.
- Mock 500 / Timeout → Backoff (1m → 24h, 6 Versuche).
- Mock 401 → `status='failed'`, kein Retry.
- Mock 409 → `status='failed'`, Operator-Review.
- Zwei parallele Cron-Aufrufe → `FOR UPDATE SKIP LOCKED` verteilt Zeilen.
- Manueller Retry → gleicher `raw_body`, gleiche Signatur (byte-genau).
- `MAESTRO_HANDOFF_ENABLED` fehlt → keinerlei Enqueue oder Zustellversuche.
