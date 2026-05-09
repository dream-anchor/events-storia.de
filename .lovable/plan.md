## Zwei Fixes in einem Patch

### 1. Heuristik komplett entfernen
Wie besprochen — Buchstaben-Match ist unzuverlässig (z.B. `pdabelstein` ≠ "Domenico", aber das `p` steht für Preeti). Stattdessen:

- **Keine** automatische Mismatch-Erkennung.
- **Bestätigungs-Dialog** vor jedem Angebots-Versand mit klar lesbarem Empfänger-Block.

### 2. Formular-Fehler "Fehler beim Senden" — Root Cause: CORS

**Diagnose** (verifiziert per direkter Edge-Function-Test):
- Edge Function `receive-event-inquiry` antwortet erfolgreich mit Status 200, Inquiry wird in DB angelegt.
- ABER: `supabase/functions/_shared/cors.ts` erlaubt als `Access-Control-Allow-Origin` ausschließlich `events-storia.de`, `www.events-storia.de` und `localhost:*`.
- Preview-URLs (`*.lovableproject.com`, `*.lovable.app`, `id-preview--*.lovable.app`) sind **nicht** in der Whitelist.
- Browser blockiert die Response → der Client sieht einen Fehler → roter Toast `"Fehler beim Senden"`.
- Auf der Live-Domain `https://events-storia.de` funktioniert das Formular weiterhin.

**Fix**: `supabase/functions/_shared/cors.ts` erweitern, sodass folgende Origins erlaubt sind:
- `https://events-storia.de`, `https://www.events-storia.de` (unverändert)
- `http://localhost:*` (unverändert)
- `https://*.lovableproject.com` (Preview)
- `https://*.lovable.app` (Preview & sandbox)
- `https://*.sandbox.lovable.dev` (interne Sandboxes)

Implementierung als Regex-Whitelist, damit Subdomain-Wildcards sauber matchen — kein generisches `*` (das würde Sicherheit aushöhlen).

Diese Änderung wirkt automatisch für **alle** Edge Functions, die `getCorsHeaders` benutzen, also auch andere Formulare (Catering, Kontakt, Package-Inquiry).

## Plan im Detail

### Datei A: `src/components/admin/refine/InquiryEditor/SendConfirmDialog.tsx` (neu)
Wiederverwendbare Komponente:
- Props: `open`, `onConfirm`, `onCancel`, `recipientName`, `recipientEmail`, `subject`, `activeOptionsCount`, `versionLabel` (z.B. "Erstversand" / "Version 2").
- Layout (Light-Mode, rounded-2xl, monochrome):
  ```
  Angebot wirklich senden?
  ─────────────────────────
  An:        Preeti
             pdabelstein@simscale.com
  Betreff:   Ihr Angebot von Storia · Firmenfeier
  Versand:   Erstversand · 2 Optionen aktiv (A, B)
  ─────────────────────────
  [Abbrechen]            [Senden bestätigen]
  ```
- Basiert auf `AlertDialog` aus `@/components/ui/alert-dialog`.
- Empfänger-Block in `font-mono text-sm` für gute Lesbarkeit der E-Mail-Adresse.

### Datei B: `src/components/admin/refine/InquiryEditor/OfferBuilder/SendControls.tsx`
- State `confirmOpen` einführen.
- `handleSendProposal` / `handleSendFinalOffer` öffnen den Dialog statt direkt zu senden.
- Erst nach `onConfirm` den eigentlichen Send-Call ausführen.
- Empfänger-Daten aus `inquiry` durchreichen.

### Datei C: Preview-Send-Stelle
Suche & Anpassung: dort wo `triggerSendProposal` / `triggerSendFinalOffer` via OfferBuilderHandle aus der Public-Offer-Preview-Seite aufgerufen wird → gleichen `<SendConfirmDialog>` einbauen. (Alternativ: Logik komplett im OfferBuilder kapseln, sodass Aufrufe von außen den Dialog automatisch durchlaufen — bevorzugt, weniger Duplizierung.)

### Datei D: `supabase/functions/_shared/cors.ts`
- Whitelist als Array von Regex-Patterns:
  ```ts
  const ALLOWED_ORIGIN_PATTERNS = [
    /^https:\/\/(www\.)?events-storia\.de$/,
    /^http:\/\/localhost:\d+$/,
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
    /^https:\/\/[a-z0-9-]+\.sandbox\.lovable\.dev$/,
  ];
  ```
- `isAllowed` matched gegen alle Patterns.
- Fallback bleibt: `events-storia.de` als Default-Origin, falls Origin nicht erlaubt.

### Out-of-Scope
- Keine DB-Änderungen.
- Kein Eingriff in Resend/SMTP-Logik.
- Kein Auto-Korrigieren der E-Mail-Adresse.
- Keine Server-seitige Pflicht-Bestätigung — Dialog ist UI-only.

## Risiken & Verifikation

- CORS-Regex muss keine Schreibfehler haben → mit zwei manuellen Tests verifizieren (Preview-Domain + Live-Domain).
- Nach Deploy der Edge Function im Preview-Browser nochmal das Event-Formular absenden → Toast muss jetzt "Vielen Dank!" zeigen.
- Bestätigungs-Dialog: einmal in Edit-Modus, einmal aus Preview-Seite testen.
