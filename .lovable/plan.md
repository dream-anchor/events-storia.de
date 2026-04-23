

# Status-Audit der offenen Punkte (vor Änderungen prüfen, nichts kaputt machen)

Faktencheck gegen aktuellen Code- und DB-Stand. Pro Punkt: was stimmt noch, was ist erledigt, was ist offen, was ist falsch verstanden.

## ✅ Bereits erledigt / kein Handlungsbedarf

- **Punkt 7 (Bug C9 — sendFinalOffer Payment-Link-Loop)**: In `supabase/functions/send-offer-email/index.ts` existiert **keine** Payment-Link-Schleife mehr. Payment-Links werden separat über `create-offer-payment-link` (pro Option, einzeln) erzeugt — aufgerufen aus 3 Stellen im Frontend (`MultiOfferComposer`, `useOfferBuilder`, `SmartInquiryEditor`). Eine atomare Transaktion ist hier strukturell nicht nötig: jeder Link-Erstellungs-Call ist idempotent pro Option, Fehler werden pro Option getoastet. **Streichen.**

## 🟡 Korrekt diagnostiziert, weiter offen

- **Punkt 2 (E2E nicht live getestet)**: bleibt offen. Stripe-Webhook, `receive-event-inquiry` und LexOffice-Rechnungserstellung wurden in der letzten Runde nur gegen Test-Inquiries (Preview-Modus) verifiziert — kein echter Zahlvorgang, kein echtes Formular mit Maus geklickt. Empfehlung unten.
- **Punkt 3 (typed-client-Hack)**: bestätigt — aktuell **17 Files** importieren `@/integrations/supabase/typed-client` (Original-Schätzung „14" war zu niedrig). Liste:
  ```
  hooks/useTasks, useEventBookings, useEventInquiries, useCateringOrders,
  useNotifications, useCloneOfferVersion
  components/admin/refine/InquiryEditor/MultiOffer/{MultiOfferComposer,useMultiOfferState}
  components/admin/refine/InquiryEditor/OfferBuilder/{OfferBuilder,useOfferBuilder}
  components/admin/refine/InquiryEditor/{AddPaymentDrawer,SmartInquiryEditor}
  components/admin/refine/{OfferCreate/index,KanbanView}
  components/admin/shared/BulkActionBar
  providers/refine-data-provider
  ```
  Grund liegt in der DB: alle 10 betroffenen „Tabellen" sind tatsächlich **VIEWS** (`pg_tables`/`information_schema` bestätigt). Solange Compat-Layer existiert, kein Risiko, **aber** TS verschluckt Tippfehler in diesen 17 Files. Aufräumen ist sinnvoll, bricht aber bei Fehlern alle Inquiry-Workflows.
- **Punkt 8 (Bug C19 — EventBookingEditor Toast lügt)**: bestätigt. `EventBookingEditor.tsx:134` toastet `"Menü bestätigt und E-Mail gesendet!"` im `onSuccess`, ohne den Email-Status aus der `confirmMenu`-Mutation zu prüfen. Fix: Mutation muss `{ ok: boolean, emailSent: boolean }` zurückgeben, Toast-Text dann konditional.

## 🟠 Teil-richtig — präzisieren

- **Punkt 4 (178+ Commits ungepusht)**: Annahme stimmt nicht 1:1. Lokale Git-History zeigt nur 3 Commits oben (`bc979d4`, `2366e70`, `c73a243`). Die „178+" stammen vermutlich aus einer alten Lovable-internen Zählung. Ungepusht sind aber tatsächlich diverse — Backup-Risiko bleibt. Aktion: einmal Push.
- **Punkt 5 (Frontend nativ auf v2 portieren)**: korrekt diagnostiziert. **25 Edge Functions** schreiben gegen Legacy-Namen (laut Search). Funktioniert wegen INSTEAD OF Triggern (siehe `db-functions`: 21 Trigger-Funktionen sind aktiv). Migration ist eine 2–3-Tage-Aufgabe und **soll nicht jetzt im Rahmen dieses Tickets passieren** — Risiko zu hoch.
- **Punkt 6 (v2 vereinen — eine Liste)**: Produktentscheidung, nicht Tech-Schuld. **Keine Code-Aktion ohne explizite UX-Freigabe.** Drei Listen sind heute funktional und stabil.
- **Punkt 12 (EventBookingsList ohne sortierbare Spalten)**: korrekt — ist eine Card-Liste (`EventBookingsList.tsx`), keine Tabelle. UX-Redesign außerhalb dieses Tickets.
- **Punkt 14 (Realtime auf Views)**: korrekt — `usePresence.ts` und `ConversationThread.tsx` nutzen `supabase.channel()`. `usePresence` läuft gegen `admin_presence` (echte Tabelle, OK). `ConversationThread` subscribed `email_messages:${inquiryId}` mit `postgres_changes` auf eine **VIEW** — Postgres `LOGICAL` Replication liefert für Views keine Events. Echtes Risiko: neue eingehende Mails erscheinen erst nach Refresh statt live.

## 🟢 Niedrig-Risiko-Aufräumarbeiten (out of scope für diesen Sprint)

- **Punkt 9** (9 LexOffice-Zombie-Rechnungen stornieren) — manueller Backoffice-Job, kein Code.
- **Punkt 10** (REVOKE auf `_legacy_*` nach 2 Wochen Stabilität) — DB-Migration in 2 Wochen, nicht jetzt.
- **Punkt 11** (`_legacy_*` ins Archiv-Schema verschieben) — siehe 10.
- **Punkt 13** (Cron-Jobs gegen v2-Views) — `process-order-reminders` schreibt in `catering_orders` (View) → läuft via UPDATE-Trigger sauber. Gleiches für `send-scheduled-reminders` und `process-follow-up-tasks`. Nominal abgedeckt durch die Trigger; ein einmaliger Trockendurchlauf wäre Bonus, ist aber kein Blocker.

## Empfehlung — was JETZT angehen, ohne Bestehendes zu brechen

Streng minimal-invasiv, nichts an Geschäftslogik:

1. **Bug C19 fixen** (Punkt 8): `useEventBookings`'s `confirmMenu` propagiert Email-Status. Toast in `EventBookingEditor.tsx:134` zeigt `"Menü bestätigt — E-Mail-Versand fehlgeschlagen"` als Warning, sonst Erfolg. ~10 Zeilen, isoliert.
2. **Realtime-Lücke (Punkt 14) entschärfen**: `ConversationThread` subscribed zusätzlich `admin_presence`-Channel als Trigger oder pollt alle 30 s als Fallback. Live-Subscription auf View entfernen und stattdessen auf v2-Tabelle `v2_event_emails` umstellen — die ist real und unterstützt logical replication. Eine Datei, ~5 Zeilen.
3. **Git-Push** (Punkt 4): einmal `git push` — kein Code, reine Hygiene.
4. **E2E-Smoke-Test (Punkt 2)**: einmaliger Ablauf in Test-Modus mit `antoine@monot.com`:
   - Anfrage über Public-Form → DB-Eintrag prüfen (Trigger schreibt `v2_events`)
   - Angebot senden → Stripe Payment Link erzeugen → Test-Karte zahlen
   - LexOffice-Rechnung wird erzeugt → in Inquiry sichtbar
   - Edge-Function-Logs während des Laufs in `supabase--edge_function_logs` mitlesen.
   Ergebnis dokumentieren, keine Code-Änderung außer Log-Beobachtung.

**Bewusst NICHT in diesem Sprint:**
- typed-client-Hack auflösen (Punkt 3) — riskant für 17 Files.
- Frontend auf native v2-Tabellen portieren (Punkt 5) — separate Migrations-Phase.
- v2-One-List-UX (Punkt 6) — Produktentscheidung offen.
- Legacy-Cleanup (9, 10, 11) — Zeitfenster.

## Geänderte Dateien (nur falls Punkte 1–2 oben freigegeben)

- `src/hooks/useEventBookings.ts` — `confirmMenu` Return-Type um `emailSent` ergänzen
- `src/components/admin/refine/EventBookingEditor.tsx` — Toast-Text konditional
- `src/components/admin/shared/ConversationThread.tsx` — Realtime auf `v2_event_emails` umstellen

Keine DB-Migration, keine Edge-Function-Änderung, keine Schema-Änderung.

