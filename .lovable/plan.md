Analyse (keine Änderung)

Erzeugt von: Edge Function `supabase/functions/receive-event-inquiry/index.ts`
- Text: `generateRestaurantEmailText` Z. 98–132 ("Quelle: Website contact form" entsteht in `getSourceLabel` Z. 87–96 aus `website_contact_form`)
- Versand: Z. 341–349 (Betreff Z. 342, Absender "STORIA Anfragen", Reply-To = Gast), via `sendEmail` Z. 141–220 (Resend, Fallback IONOS)
- Log: Z. 352–364

Ausgelöst von: `src/components/events/EventContactFormNative.tsx` Z. 110 (`source` Z. 124). Gleiche Function auch von `EventPackageInquiryDialog.tsx` Z. 165, Admin `OfferCreate/index.tsx` Z. 549, `ai-catering-assistant/index.ts` Z. 1905.

Weitere Mails aus diesem Formular:
- Gast-Bestätigung Z. 310–335: aus, weil `SEND_CUSTOMER_CONFIRMATION = false` (Z. 8); nur bei `skipInsert` (Admin-Erfassung) aktiv.
- Keine weitere Betreiber-Mail; zusätzlich WhatsApp-Alarm Z. 418–449 (keine Mail).

MAESTRO: `forwardToMaestro` Z. 378–416 läuft unabhängig vom Mail-Ergebnis (nur Bedingung `!skipInsert`), per `EdgeRuntime.waitUntil`.
