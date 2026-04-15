# Lovable Prompt: Email-Safety für Testbestellungen

Erstelle eine neue shared Utility `supabase/functions/_shared/test-safety.ts`:

```typescript
// System-User E-Mail-Adressen — nur diese erhalten Test-Emails
const SYSTEM_EMAILS = [
  "antoine@monot.com",
  "info@ristorantestoria.de", 
  "info@events-storia.de",
];

const TEST_REDIRECT_EMAIL = "antoine@monot.com";

/**
 * Prüft ob eine Anfrage eine Testbestellung ist und gibt die sichere
 * Empfänger-Email zurück. Bei Testbestellungen wird die Kunden-Email
 * durch die System-Email ersetzt.
 */
export function getSafeRecipientEmail(
  customerEmail: string,
  isTest: boolean
): string {
  if (!isTest) return customerEmail;
  // Test-Email geht NUR an System-User
  console.log(`[TEST SAFETY] Redirecting email: ${customerEmail} → ${TEST_REDIRECT_EMAIL}`);
  return TEST_REDIRECT_EMAIL;
}

/**
 * Markiert den Email-Betreff als Test
 */
export function getSafeSubject(subject: string, isTest: boolean): string {
  if (!isTest) return subject;
  return `[TEST] ${subject}`;
}
```

Dann aktualisiere folgende Edge Functions, sodass sie die `is_test`-Spalte der zugehörigen inquiry/order prüfen und die Email umleiten:

1. **send-offer-email**: Lade `is_test` aus `event_inquiries` WHERE `id = inquiryId`. Wenn `is_test = true`, ersetze `customerEmail` mit `getSafeRecipientEmail()`.

2. **send-payment-email**: Lade `is_test` aus der zugehörigen `event_inquiries` (über `inquiry_id` in `event_payments`). Wenn `is_test = true`, ersetze Empfänger.

3. **receive-event-inquiry** (Bestätigungsmail): Prüfe `is_test` aus der inquiry. Wenn true, sende Bestätigung nur an System-Email.

4. **send-order-notification**: Prüfe `is_test` aus `catering_orders`. Wenn true, redirect.

Importiere in jeder dieser Functions:
```typescript
import { getSafeRecipientEmail, getSafeSubject } from '../_shared/test-safety.ts';
```

WICHTIG: Die Prüfung passiert IN der Edge Function, nicht nur im Frontend. Das ist die Sicherheitsebene — selbst wenn das Frontend einen Bug hat, geht keine Test-Email an echte Kunden.
