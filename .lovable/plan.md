## Ziel
Bei Zahlungsart "Anzahlung + Online" soll der Admin wählen können, ob die Anzahlung als **Prozentsatz** (z. B. 20 %) **oder als fester Eurobetrag** (z. B. 500 €) eingetragen wird.

## UI (PaymentTermsBlock)
- Im Block nur wenn Methode = `deposit_online`: Toggle (zwei kleine Pills/Tabs) **Prozent** | **Fester Betrag**.
- Je nach Auswahl wird genau **ein** Eingabefeld gezeigt:
  - Prozent: bestehendes Feld `deposit_percent` (1–99 %).
  - Fester Betrag: neues Feld `deposit_amount` in Euro (min 1).
- Anzeige des Hinweistexts darunter passt sich an, z. B.
  „Anzahlung 500 € innerhalb 5 Tagen, Restzahlung vor Veranstaltung."
- Defaults aus `site_settings.default_payment_terms` bleiben für Prozent; bei Wechsel auf "Fester Betrag" wird `deposit_percent` auf `null` gesetzt und umgekehrt — so ist immer eindeutig, welcher Modus gilt.

## Datenmodell
- Neue Spalte `event_inquiries.deposit_amount NUMERIC(10,2) NULL` (Brutto, EUR).
- Regel: Genau eines von `deposit_percent` / `deposit_amount` ist gesetzt. Kein DB-CHECK (Konformität mit Memory zu Validation-Triggern wäre Overkill — Regel wird im UI/Backend erzwungen).

## Backend / Folgewirkung
- `supabase/functions/create-payment-session`: Falls `deposit_amount` gesetzt ist, wird dieser fixe Betrag (gedeckelt auf Total) als Stripe-Session-Amount verwendet, statt `total * percent`. Produkttitel: `Anzahlung 500 € — Event …`. `remaining_amount = total - deposit_amount`.
- `supabase/functions/create-event-quotation` (LexOffice Anschreiben/Bemerkung): Wenn fester Betrag → Text „Anzahlung 500 € innerhalb X Tagen", sonst wie bisher Prozent.
- `ProposalView` / `FinalOfferView` (Public Offer): Anzahlungs-Button zeigt entweder „Anzahlung 20 %" oder „Anzahlung 500 €". Logik `showDeposit` bleibt analog (deposit > 0 und < total).
- `useOfferHistory` / E-Mail-Versand: keine Änderung nötig (Konditionen-Text wird neu generiert).

## Geltungsbereich
- Nur die Anzahlungs-Variante. „Vorauszahlung", „Vor Ort", „Rechnung" bleiben unverändert.
- Keine Änderung an `site_settings`-Defaults — Defaults bleiben prozentbasiert.

## Technische Punkte
- Migration: `ALTER TABLE event_inquiries ADD COLUMN deposit_amount NUMERIC(10,2);` plus Update der `public_offer`-RPC, falls sie deposit-Felder zurückgibt.
- TypeScript-Typen werden nach Migration automatisch regeneriert.
- `ProposalView` `depositAmount`-Berechnung wird umgestellt: `inquiry.deposit_amount ?? Math.round(total * percent)/100`.
- `ReturnType<typeof setTimeout>` ist hier nicht relevant.

## Betroffene Dateien
- `supabase/migrations/<neu>.sql`
- `src/components/admin/refine/InquiryEditor/PaymentTermsBlock.tsx`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx` (Props durchreichen)
- `src/components/admin/refine/InquiryEditor/types.ts`
- `src/pages/public-offer/types.ts`, `ProposalView.tsx`, `FinalOfferView.tsx`
- `supabase/functions/create-payment-session/index.ts`
- `supabase/functions/create-event-quotation/index.ts`
- evtl. RPC-Migration für `get_public_offer`