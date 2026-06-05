# Public Offer Sync + exakte Beträge am Zahl-Button

## Problem

1. **Anschreiben neu generieren ≠ Public Offer aktuell:**
   - Beim Regenerieren wird `event_inquiries.email_content` aktualisiert, aber:
     - der Übersetzungs-Cache in `email_content_translations` (jsonb mit `en/it/fr`) bleibt stehen → Kunde in EN/IT/FR sieht weiter den **alten** übersetzten Text.
     - Die Menü-/Options-Anzeige liest beim Versand aus dem History-Snapshot (`inquiry_offer_history.options_snapshot`), aber beim reinen Regenerieren ohne neuen Versand wird kein neuer Snapshot erzeugt → falls Menü zwischendurch geändert wurde, sind Anschreiben und Options-Karten auf Public Offer auseinander.

2. **Zahl-Button rundet:**
   - `formatCurrency()` in `src/pages/public-offer/types.ts` ist auf `minimumFractionDigits: 0, maximumFractionDigits: 0` gesetzt. Dadurch wird z. B. `1.053,99 €` am Bezahl-Button als `1.054 €` dargestellt (Zeile 1012 / 1029 ProposalView).
   - Zusätzlich rundet `Math.round(totalAmount * depositPercent) / 100` in ProposalView (Zeile 163) und PublicOffer (Zeile 199) Anzahlungen auf Cent — gegen die Maestro-Regel („Preise 1:1 aus Maestro, niemals neu runden").

## Lösung

### A) Anschreiben-Regenerate synchronisiert Public Offer

In `src/components/admin/refine/InquiryEditor/AIComposer.tsx` (Stelle, an der nach `generate-inquiry-email` der neue `email_content` ankommt und in die Inquiry geschrieben wird) zusätzlich:

1. `email_content_translations = {}` setzen (Cache leeren) — damit `AnschreibenSection` bei nicht-deutschen Sprachen neu übersetzt.
2. Aktuellen Options-Snapshot (alle `inquiry_offer_options` mit `is_active = true`) lesen und in den aktuellen `inquiry_offer_history`-Eintrag der laufenden Version schreiben (`update … set email_content = neuer Text, options_snapshot = aktuelle Options where inquiry_id = X and version = current_offer_version`). Falls noch kein History-Eintrag für die laufende Version existiert (Draft-Phase), wird kein History-Update gemacht — `PublicOffer.tsx` fällt dann ohnehin auf die Live-Options aus `inquiry_offer_options` zurück.
3. Aktivität loggen: `cover_letter_regenerated` mit `{ version, translations_cleared: true }`.

→ Effekt für Kunden: Anschreiben, Menü-Snapshot und Übersetzungen auf Public Offer sind nach Regenerate konsistent.

### B) Zahl-Button: exakter Betrag, keine Rundung

In `src/pages/public-offer/types.ts`:

- `formatCurrency()` auf `minimumFractionDigits: 2, maximumFractionDigits: 2` umstellen. (Hat dieselbe Darstellung wie `formatCurrencyDecimal` — `formatCurrencyDecimal` bleibt als Alias bestehen, um Re-Exports nicht zu brechen.)

In `src/pages/public-offer/ProposalView.tsx` (Zeile 161–163) und `src/pages/PublicOffer.tsx` (Zeile 186–199 `computeDeposit`):

- Wenn `inquiry.deposit_amount > 0` ist (fester Maestro-Betrag), wird er 1:1 übernommen (auch Stelle in `Math.min`-Pfad nicht runden).
- Beim prozentualen Pfad statt `Math.round(totalAmount * pct) / 100` ein unverändertes `(totalAmount * pct) / 100` verwenden. Die Anzeige nutzt `formatCurrencyDecimal`, das auf 2 Nachkommastellen korrekt formatiert, ohne den Wert intern zu runden.
- Hinweis: Stripe wird im Edge-Function-Aufruf (`create-payment-session`) ohnehin in ganzen Cent angegeben — dort bleibt eine unvermeidbare Cent-Konvertierung (`Math.round(x*100)`) bestehen, weil Stripe keine Sub-Cent-Beträge akzeptiert; das ist keine Rundung in der UI.

## Technische Details

**Geänderte Dateien:**
- `src/pages/public-offer/types.ts` — `formatCurrency` auf 2 Nachkommastellen.
- `src/pages/public-offer/ProposalView.tsx` — `Math.round` aus `depositAmount`-Berechnung entfernen.
- `src/pages/PublicOffer.tsx` — `computeDeposit` ohne `Math.round`.
- `src/components/admin/refine/InquiryEditor/AIComposer.tsx` — nach erfolgreichem Regenerate:
  - `update event_inquiries set email_content = …, email_content_translations = '{}'::jsonb where id = inquiry_id`
  - `update inquiry_offer_history set email_content = …, options_snapshot = activeOptions where inquiry_id = X and version = current_offer_version` (nur wenn Eintrag existiert).
  - `logActivity('cover_letter_regenerated', …)`.

**Keine** Migration nötig (`email_content_translations` existiert bereits als jsonb).
**Keine** Backend-/Stripe-Logikänderung — Stripe-Beträge bleiben in Cent korrekt.
