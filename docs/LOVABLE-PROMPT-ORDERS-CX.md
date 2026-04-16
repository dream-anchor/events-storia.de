# Lovable-Prompt: Orders CX Deployment (Commit fdba695)

## Copy-Paste an Lovable:

---

Bitte aus dem neuesten Commit `fdba695` deployen — Catering-Orders CX-Überarbeitung:

**1. DB-Migration:** `supabase/migrations/20260416_catering_orders_cx_overhaul.sql`

Fügt 3 neue Felder zu `catering_orders` hinzu:
- `reminder_sent_at` (timestamptz)
- `last_customer_message_at` (timestamptz)
- `last_our_reply_at` (timestamptz)

Plus Index auf `(desired_date, status)` für aktive Orders.

**2. Edge Function:** `supabase/functions/process-order-reminders/index.ts`

Secrets prüfen (sollten schon gesetzt sein):
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SITE_URL` = `https://events-storia.de`

**3. pg_cron Migration:** `supabase/migrations/20260416_catering_orders_pgcron.sql`

Stündlicher Job (`0 * * * *`) ruft die Edge Function auf. Macht 2 Dinge:
- Reminder-Mail an `info@events-storia.de` + `info@ristorantestoria.de` wenn Bestellung in 2 Tagen ansteht
- Auto-Transition `pending`/`confirmed` → `completed` wenn Liefer-/Abholzeit + 1h überschritten

**Test nach Deploy:**
1. Eine Bestellung mit `desired_date = heute+2` anlegen
2. Edge Function manuell triggern im Supabase Dashboard
3. Prüfen: Mail bei `info@events-storia.de` + `info@ristorantestoria.de` angekommen
4. `reminder_sent_at` in DB gesetzt

---

## Hinweis

Das Frontend (`OrdersList.tsx`) ist bereits live und liest die neuen Felder. Bis die DB-Migration durchgelaufen ist, zeigt die Kommunikation-Spalte einfach `—` (kein Fehler, nur leer).

TypeScript-Types (`src/types/refine.ts`) sind ebenfalls bereits erweitert.
