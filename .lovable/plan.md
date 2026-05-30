## Ziel
Eine vierte Restzahlungs-Option ergänzen: **„Rechnung vor Event"** — Kunde erhält die Rechnung vor dem Event und überweist bis **standardmäßig 7 Tage vor Event**. Frist ist editierbar.

## Änderungen

### 1. `PaymentTermsBlock.tsx`
- `BalanceMethod`-Type erweitern: `'stripe_prepay' | 'on_site' | 'invoice_after' | 'invoice_before'`
- `BALANCE_OPTIONS` um vierten Eintrag ergänzen:
  - Label: **„Rechnung vor Event"**
  - Beschreibung: *„Überweisung bis X Tage vor Event"*
  - Icon: `FileText` (gleicher Stil wie „Rechnung vorab" bei Anzahlung)
- Neuer Default: `invoice_before_due_days_before_event = 7` (in `site_settings.default_payment_terms`)
- Neues Frist-Feld einblenden, wenn `bMethod === 'invoice_before'`:
  - Label: *„Zahlungsfrist (vor Event)"* — Tage, default 7
  - Speichert in **`balance_due_days_before_event`** (Feld wird wiederverwendet — semantisch identisch zu `stripe_prepay`)
- `pairToLegacy()`: `invoice_before` → mapped auf neuen Legacy-Wert `'invoice_before'` (oder Fallback `'invoice_after'` falls Legacy-Spalte enum-beschränkt ist — siehe Tech-Details)
- `setPair()`: `payment_timing = 'before_event'` bei `invoice_before`
- `summaryText`: *„Restzahlung per Rechnung vor Event (Zahlung bis {bDays} Tage vor Event)"*
- Hinweis-Box („Kunde sieht…"): bei `invoice_before` Text *„Rechnung wird manuell versendet — Zahlungseingang vor Event erwartet."*

### 2. Backend / Daten
- **Keine neue Spalte** nötig — `balance_method` ist `text`, `balance_due_days_before_event` existiert bereits.
- `event_inquiries_update_payment_methods` Trigger überträgt das Feld bereits 1:1.
- Optional: `site_settings.default_payment_terms` JSON um `balance_due_days_before_event_invoice: 7` erweitern (nur wenn der Default für die neue Variante anders sein soll als für Stripe-Prepay). **Für jetzt: wir nutzen denselben Default-Key.**

### 3. Folge-Logik
- `send-scheduled-reminders` Edge Function: Erinnerung 13 Tage vor Event soll auch bei `balance_method = 'invoice_before'` greifen → Filter erweitern (`balance_method IN ('stripe_prepay','invoice_before')`).
- `create-balance-payment-link` / `Restzahlung.tsx` / `PaymentBalanceCard.tsx`: für `invoice_before` **kein** Stripe-Link generieren — stattdessen Status „Rechnung manuell versandt / Zahlungseingang ausstehend". Im Admin-UI zeigt `PaymentBalanceCard` einen Hinweis statt Stripe-Aktion.
- `PaymentSection.tsx` (PublicOffer): bei `invoice_before` Hinweistext anzeigen *„Rechnung folgt separat per E-Mail"*.

### 4. Texte / Emails
- Auftragsbestätigung & Anschreiben (bilingual DE/EN) erwähnen die Variante korrekt:
  - DE: „Die Restzahlung erfolgt per Überweisung nach gesonderter Rechnung, fällig 7 Tage vor dem Event."
  - EN: „The balance will be paid by bank transfer against a separate invoice, due 7 days before the event."

## Technische Details

- Datei-Edits:
  - `src/components/admin/refine/InquiryEditor/PaymentTermsBlock.tsx`
  - `src/components/admin/shared/PaymentBalanceCard.tsx` (UI-Branch für `invoice_before`)
  - `src/pages/public-offer/PaymentSection.tsx` (Kunden-Hinweis)
  - `supabase/functions/send-scheduled-reminders/index.ts` (Filter)
  - `supabase/functions/create-balance-payment-link/index.ts` (Guard: 400 bei `invoice_before`)
  - Email-Template-Renderer (`emailTemplates.ts` / `emailTemplateRenderer.ts`) für Restzahlungs-Erklärtext
- Legacy `payment_method` Mapping: bleibt `invoice_after` als Fallback, neuer canonical Wert in `balance_method`. So vermeiden wir Enum-Migration.
- Reine UI/Logik-Erweiterung — keine DB-Migration.

## Edge Cases
- Bei Wechsel von `stripe_prepay` → `invoice_before` bleibt `balance_due_days_before_event` erhalten (User passt ggf. auf 7 an).
- Anzahlung bleibt unabhängig wählbar (z. B. „Stripe Anzahlung + Rechnung vor Event").
- Reminder-System darf bei `invoice_before` keinen Stripe-Link in die Mail rendern — Templates prüfen.
