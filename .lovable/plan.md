## Diagnose

Zwei zusammenhängende Bugs am Freitext-/KI-Angebot:

### Bug 1 — KI-Menü „verschwindet" im Wizard (Root Cause: DB-Trigger)
- Das Enum `v2_offer_mode` enthält `freeform`, aber die INSTEAD-OF-Trigger
  `inquiry_offer_options_insert_trigger` / `_update_trigger` haben **keinen
  CASE-Branch für `'freeform'`** → `v_mode` wird `NULL`.
- Frontend schreibt also `offer_mode='freeform'`, in der DB landet `NULL`
  (bzw. der alte Wert `full_menu` bleibt stehen, wenn ein anderer Pfad zuerst
  speicherte).
- Beim Reload mappt `mapLegacyMode(null)` → `'menu'`. Damit rendert die
  OptionCard wieder die **Menü-Ansicht** (leer), und der Auto-Recalc für
  Menü-Modus überschreibt `total_amount` mit `0` — obwohl `freeformProgram`
  inkl. 4 Tagen und 28.460,84 € weiterhin im `menu_selection`-JSON liegt.
- Beleg in der DB (zwei betroffene Zeilen):
  - `9f6ce2a7…` (Inquiry `6ddaabe0…`): `offer_mode='full_menu'`, `total_amount=0`, `freeformProgram` vorhanden (4 Tage, 28.460,84 €).
  - `ef092a7a…` (Inquiry `7a992e64…`): `offer_mode=NULL`, `total_amount=28.460,84`, `freeformProgram` vorhanden.

### Bug 2 — Public Offer zeigt das Menü nicht
- Route `/offer/:id` rendert `src/pages/PublicOffer.tsx` (nicht
  `ProposalView.tsx`).
- In `PublicOffer.tsx` wird `freeformProgram` nur für die Preis-Fallback-Logik
  ausgelesen; der eigentliche Programm-/Menü-Block (`FreeformProgramSection`)
  ist nie eingebunden. Deshalb sieht der Kunde nur Briefkopf, Preis-Card und
  Zahl-Buttons, aber keinen Inhalt.

## Fix-Plan

### 1. DB-Migration — Trigger um `freeform` ergänzen
Neue Migration `supabase/migrations/…_offer_mode_freeform_mapping.sql`:
- `inquiry_offer_options_insert_trigger`: CASE-Zweig
  `WHEN 'freeform' THEN 'freeform'::v2_offer_mode` ergänzen.
- `inquiry_offer_options_update_trigger`: identisch ergänzen.
- Backfill der zwei betroffenen Rows:
  - `9f6ce2a7…`: `offer_mode='freeform'`, `amount_total = (freeformProgram.totalsFromText.gross − Rabatt)`.
  - `ef092a7a…`: `offer_mode='freeform'` (Betrag bereits korrekt).
- Sanity-Check: Alle Rows mit `menu_selection ? 'freeformProgram'` und
  `offer_mode IS NULL` → `'freeform'`.

### 2. Frontend Auto-Save härten
`src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx`,
`FreeformContent.setProgram` & `onChange`-Callback:
- Bei jedem Setzen eines Programms zusätzlich `offerMode: 'freeform'`
  mitsenden — verhindert, dass Legacy-Optionen im Menü-Modus bleiben und der
  Recalc-Effekt `totalAmount` auf 0 zieht.

`src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts`:
- Recalc-Effekt (`opt.offerMode === 'menu'`-Block): **Skip**, wenn
  `opt.menuSelection.freeformProgram` existiert. Schützt vor versehentlicher
  Null-Berechnung, falls Mode-Flag jemals abweicht.
- `mapLegacyMode`: zusätzlich `NULL`/`undefined` → wenn
  `menu_selection.freeformProgram` vorhanden ist, `'freeform'` zurückgeben
  (defensive Hydration, falls Altdaten ohne sauberen Mode reinkommen).

### 3. Public Offer Rendering
`src/pages/PublicOffer.tsx`:
- `FreeformProgramSection` und Typen aus `./public-offer/…` importieren.
- In beiden Optionskarten-Renderern (lines ~1352 und ~1664) **vor** dem
  bestehenden Speisekarten-Block einen Branch ergänzen:
  ```
  if (menu?.freeformProgram) {
    <FreeformProgramSection program={menu.freeformProgram} lang={lang} />
  }
  ```
  und den klassischen Courses/Drinks-Block überspringen, wenn freeform
  vorhanden ist (verhindert leere „Menü"-Sektion). Auch im
  „Bestätigt"-Bereich (~1916) analog ergänzen.
- Spracheinstellung respektieren (`lang` Prop weiterreichen — falls
  `FreeformProgramSection` aktuell kein `lang` annimmt, einfache i18n der
  Überschriften ergänzen).

### 4. Verifikation
- Migration ausführen, Inquiry `6ddaabe0…` neu laden → Wizard zeigt
  Freeform-Editor mit 4 Tagen + 28.460,84 €, Auto-Save persistiert
  `offer_mode='freeform'`.
- Public-Offer-URL erneut öffnen → vollständiges 4-Tage-Programm sichtbar,
  Gesamtpreis 28.460,84 €, Anzahlung 20 % = 5.692,17 €.
- Re-Save im Wizard (z.B. Tag-Titel ändern) → Reload → Programm bleibt
  erhalten, Mode bleibt `freeform`.

## Was nicht angefasst wird
- `ProposalView.tsx` (Archiv-Pfad) bleibt unverändert — funktioniert bereits.
- Keine Änderungen an `parse-freeform-offer` / `validate-freeform-offer`
  Edge Functions, an Stripe-Flow oder am Mail-Versand.
