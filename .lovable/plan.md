## Ziel
Eine Gutschein-Seite unter `/gutschein` auf events-storia.de, von der Kunden Wertgutscheine für das Restaurant STORIA online kaufen können. Die Seite ist Zielziel für die `voucher_click`-CTAs aus ristorantestoria.de.

## Umfang dieser Runde
- Route + Seite `/gutschein` (DE) und `/en/voucher` (EN) — bilingual wie alle anderen Seiten.
- Kaufweg per Stripe Checkout: feste Beträge (25 / 50 / 75 / 100 €) + Freibetrag (10–500 €).
- Eingabefelder: Empfänger-Name (optional), Absender-Name (optional), persönliche Nachricht (optional, max. 300 Z.), Käufer-E-Mail (Pflicht — Rechnungs- und Zustellempfänger).
- Versand: PDF-Gutschein per E-Mail nach erfolgreicher Zahlung (Resend, bilingual gemäß Memory-Regel). Eindeutiger Gutscheincode (z. B. `STORIA-XXXX-XXXX`). Optional zweite Mail an Empfänger, wenn dessen E-Mail eingegeben wurde.
- LexOffice-Rechnung automatisch (Brutto, taxType `gross`) — analog bestehender Stripe→LexOffice-Pipeline.
- Einlösung: bewusst **offline** im Restaurant (kein Online-Einlösen). Gutscheincode wird beim Bezahlen im STORIA vorgezeigt. Hinweis dazu auf der Seite und auf dem PDF.
- AGB-Verlinkung: `/agb-gutscheine` (existiert bereits) + Widerrufsbelehrung + Datenschutz.

## Nicht in dieser Runde
- Erlebnis-/Menü-spezifische Gutscheine (z. B. „Drei-Gänge für 2"). Erst Wertgutscheine, später erweiterbar.
- Admin-UI zum manuellen Einlösen/Entwerten. Erste Stufe: Code wird im Restaurant manuell auf Papier/Liste abgehakt; Einlöse-Tracking kommt in einer Folgerunde, wenn Bedarf da ist.
- Anpassungen am ristorantestoria.de-Projekt — die Verlinkung dort ist bereits vorbereitet.

## Seitenaufbau `/gutschein`
1. Hero: „STORIA Gutschein verschenken — italienische Küche in der Maxvorstadt." Kurze Subline, Bild der Pizzeria/Terrasse.
2. Betragsauswahl (Karten 25/50/75/100 € + Freibetrag).
3. Persönliche Nachricht + Empfänger-/Absender-Felder.
4. Käufer-E-Mail + AGB-Checkbox.
5. „Jetzt kaufen" → Stripe Checkout.
6. Trust-Block: Wie funktioniert's (3 Schritte), Gültigkeit (3 Jahre nach Jahresende gem. § 195 BGB), Einlösung nur vor Ort im STORIA, Rechnung wird automatisch per Mail zugestellt.
7. FAQ kurz: Versand, Gültigkeit, Verlust, Restbetrag.

## Technik
- **Route:** `src/pages/Gutschein.tsx` neu, in `src/App.tsx` registrieren (`/gutschein` + `/en/voucher`). Translations in `src/translations/{de,en}.ts`.
- **Stripe-Produkt:** ein Produkt „STORIA Gutschein" mit dynamischem `unit_amount` (Custom Amount via `price_data` in Checkout Session — kein festes Price-Objekt nötig). Alternativ vier feste Preise + ein „flexibler" Pfad. Empfehlung: `price_data` mit Custom-Amount — einfacher zu warten.
- **Edge Function neu:** `supabase/functions/create-voucher-checkout/index.ts` — validiert Betrag/Felder, erstellt Stripe Checkout Session, schreibt Pending-Record in neuer Tabelle `vouchers`.
- **Edge Function neu:** `supabase/functions/voucher-webhook/index.ts` (oder Erweiterung der existierenden Stripe-Webhook-Function) — bei `checkout.session.completed`: Gutscheincode generieren, PDF rendern, Mail(s) versenden, LexOffice-Rechnung anlegen, Status auf `paid` setzen.
- **DB-Tabelle `vouchers`** (Migration mit GRANTs + RLS, gemäß Core-Regel):
  - `id`, `code` (unique), `amount_cents`, `currency` (`eur`), `purchaser_email`, `purchaser_name?`, `recipient_email?`, `recipient_name?`, `message?`, `stripe_session_id`, `status` (`pending`/`paid`/`redeemed`/`cancelled`), `lexoffice_invoice_id?`, `pdf_url?`, `created_at`, `paid_at?`, `redeemed_at?`, `valid_until` (date).
  - RLS: kein anon/authenticated read; nur `service_role` (Edge Functions) + Admin (über `has_role`) lesen/schreiben.
- **PDF:** bilinguales Layout (DE oben, EN unten — Bilingual-Memory-Regel), STORIA-Branding, Code groß, Betrag, Gültigkeit, Einlöse-Hinweis.
- **E-Mail:** Resend mit IONOS-Fallback (bestehende Infrastruktur), Absender `info@events-storia.de`, bilingual, PDF im Anhang. Käufer erhält Bestätigung + PDF; bei Empfänger-Mail zusätzlich Versand an Empfänger ohne Rechnung.
- **LexOffice:** taxType `gross`, grossAmount = gekaufter Betrag, Artikelbezeichnung „STORIA Restaurant-Gutschein Nr. {code}".
- **Tracking:** GA4 `begin_checkout` beim Klick auf „Jetzt kaufen" (`location:'gutschein'`), `purchase` nach erfolgreicher Webhook-Verarbeitung über Success-Page (`/gutschein/danke`).

## Offene Punkte (entscheidet ihr, bevor ich baue)
1. **Gültigkeit:** Standard 3 Jahre zum Jahresende (BGB) — okay so, oder anderer Zeitraum?
2. **Beträge:** 25 / 50 / 75 / 100 + Freibetrag 10–500 — okay, oder andere Staffelung?
3. **Persönliche Nachricht auf dem PDF abdrucken** — ja / nein?
4. **Stripe Test-Mode oder direkt Live?** (Empfehlung: erst Test, dann Live nach einem Probekauf.)
