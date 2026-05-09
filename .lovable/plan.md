## Problem
Angebote wurden in der Vergangenheit versehentlich an `info@events-storia.de`, `info@ristorantestoria.de` oder ähnliche Betreiber-Adressen geschickt — statt an den Kunden. Aktuell prüft weder das UI noch die Edge Function, ob der `customerEmail` gleich einer eigenen Domain ist.

## Lösung: Mehrstufiger Schutz

### 1. Zentrale Blocklist (neu)
Neue Datei `src/lib/operatorEmailGuard.ts` mit:
- Liste der Betreiber-Domains: `events-storia.de`, `ristorantestoria.de`, `storia-events.de` (+ www-Varianten)
- Liste konkreter Adressen: `info@`, `kontakt@`, `office@`, `events@`, `catering@`, `noreply@`, `bestellung@`
- Funktion `checkOperatorEmail(email): { isOperator: boolean; reason: string }`
- Domain-Match case-insensitive, trimmt Whitespace

### 2. Frontend-Validierung (Hard Block)
Vor jedem `supabase.functions.invoke('send-offer-email', …)` Aufruf in:
- `SmartInquiryEditor.tsx` (3 Call-Sites: Z. 477, 661, 923)
- `OfferBuilder/useOfferBuilder.ts` (2 Call-Sites: Z. 1123 = sendProposal, Z. 1266 = sendFinalOffer)

→ `checkOperatorEmail(customerEmail)` aufrufen. Bei Treffer:
- **Bestätigungs-Dialog** (AlertDialog, nicht nur Toast) mit klarer Warnung:
  > „Die Empfänger-Adresse **{email}** gehört zum Betreiber, nicht zum Kunden. Soll das Angebot wirklich an diese Adresse gehen?"
- Buttons: „Abbrechen" (default) / „Trotzdem senden" (destructive variant, requires explicit confirm)
- Ohne Bestätigung: Versand wird hart abgebrochen.

### 3. Backend-Guard (Defense in Depth)
In `supabase/functions/send-offer-email/index.ts` direkt nach dem Body-Parse:
- Gleiche Prüfung serverseitig
- Wenn Operator-Adresse UND kein neues Flag `confirmedOperatorOverride: true` im Body → 400 zurückgeben mit `{ error: 'OPERATOR_EMAIL_BLOCKED', message: ... }`
- Versand-Versuch wird in `email_send_log` mit Status `blocked_operator_recipient` geloggt (Audit-Trail)

### 4. Visueller Hinweis im OfferSendPreview
- Wenn `customerEmail` = Operator-Adresse → roter Warn-Banner über dem Preview („⚠️ Achtung: Empfänger ist Betreiber-Adresse")
- Sende-Button bekommt `disabled` + Tooltip-Hinweis bis Override gesetzt ist

### 5. Inquiry-Erfassung absichern
Im `EventContactForm` und ähnlichen öffentlichen Formularen — falls jemand info@events-storia.de als Kontakt-Email einträgt, soll das eingehend nicht blockiert (Inquiries sind ok), aber beim späteren Angebotsversand greift Schritt 2.

## Technische Details
- Keine Änderungen an Datenbank-Schema nötig
- `email_send_log.status` neuer Wert `blocked_operator_recipient` (Free-Text, kein Enum)
- Test-Modus (`isTest: true`) bleibt unangetastet — dort darf an `info@` gesendet werden weil das Test-Routing eh überschreibt

## Out of Scope
- Kein Re-Routing automatisch auf andere Adresse — wir wollen explizite Admin-Entscheidung
- Keine Migration historischer Sendungen

## Dateien (geschätzt)
- Neu: `src/lib/operatorEmailGuard.ts`
- Edit: `SmartInquiryEditor.tsx`, `useOfferBuilder.ts`, `OfferSendPreview.tsx`, `supabase/functions/send-offer-email/index.ts`
