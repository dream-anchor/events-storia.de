

# LexOffice 429 Rate-Limit beheben — Doppel-Fetch + Retry-Logik

## Befund

Edge-Logs zeigen: Quotation wurde **korrekt erstellt** (`9cd7c1bf-...`), aber `get-lexoffice-document` wurde **zweimal innerhalb von ~140ms** aufgerufen. Der erste Aufruf bekam **HTTP 429 „Rate limit exceeded"** von LexOffice → Frontend zeigt „Edge Function returned a non-2xx status code".

**Ursache 1 — Doppel-Aufruf in `OfferSendPreview.tsx`:**
Der PDF-Lade-Effect (Zeile 173) hat `[inquiry?.id, inquiry?.lexoffice_quotation_id]` als Dependencies. Beim Lazy-Create wird via `setInquiry(...)` die `lexoffice_quotation_id` aktualisiert → der Effect läuft **erneut** und startet einen **zweiten parallelen Fetch**, während der erste noch läuft.

**Ursache 2 — `get-lexoffice-document` retried nur bei 500:**
Die `fetchWithRetry`-Helper in `supabase/functions/get-lexoffice-document/index.ts` (Zeile 22) prüft `response.status !== 500`. 429 wird sofort als Fehler weitergereicht.

## Lösung

### Fix 1 — Doppel-Aufruf verhindern (Frontend)

In `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` Effect-Dependencies auf `[inquiry?.id]` reduzieren. Der Lazy-Create-Pfad wird **innerhalb** des Effects abgehandelt (Zeile 182–202) — die `quotationId` ist als lokale Variable bereits verfügbar, der State-Update via `setInquiry` ist nur für nachgelagerte Komponenten relevant. Der Effect muss nicht erneut laufen, wenn er die Quotation gerade selbst angelegt hat.

```ts
}, [inquiry?.id]); // statt [inquiry?.id, inquiry?.lexoffice_quotation_id]
```

Damit fällt der zweite parallele Fetch komplett weg → kein Rate-Limit mehr durch Selbst-Konkurrenz.

### Fix 2 — 429 in Retry-Logik aufnehmen (Edge Function)

In `supabase/functions/get-lexoffice-document/index.ts` `fetchWithRetry` (Zeile 17–35) erweitern: bei `429` UND `500` retryen. LexOffice schickt im 429-Response idR auch `Retry-After`-Header — wenn vorhanden, diesen respektieren, sonst exponentielles Backoff (3s, 6s, 9s).

```ts
const isRetryable = response.status === 500 || response.status === 429;
if (!isRetryable || attempt === MAX_RETRIES) { ... }
const retryAfterHeader = response.headers.get('Retry-After');
const delay = retryAfterHeader 
  ? Math.min(parseInt(retryAfterHeader) * 1000, 10_000)
  : RETRY_DELAY_MS * attempt; // exponentiell
await sleep(delay);
```

Gleichen Patch in `supabase/functions/download-public-offer-pdf/index.ts` anwenden, falls dort dieselbe Helper-Funktion existiert (für Konsistenz).

### Fix 3 — Defensiver Guard im Effect (Frontend, kleiner Polish)

Falls der Effect trotzdem doppelt feuert (z.B. React StrictMode), `useRef`-basiertes „in-flight"-Flag, das nur einen aktiven Fetch pro `inquiry.id` zulässt:

```ts
const inFlightRef = useRef<string | null>(null);
// ...
if (inFlightRef.current === inquiry.id) return;
inFlightRef.current = inquiry.id;
// am Ende (finally): inFlightRef.current = null;
```

Verhindert auch zukünftige Regressionen durch Re-Renders.

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` — Effect-Dependencies + `useRef`-Guard (~5 Zeilen)
- `supabase/functions/get-lexoffice-document/index.ts` — `fetchWithRetry` um 429 + `Retry-After` erweitern (~8 Zeilen)
- `supabase/functions/download-public-offer-pdf/index.ts` — gleicher Patch (falls vorhanden, ~8 Zeilen)

Keine DB-Migration. Keine Änderungen an `create-event-quotation`, `MultiOfferComposer`, `SmartInquiryEditor`.

## Verifikation

1. Vorschau für Inquiry **ohne** `lexoffice_quotation_id` öffnen → genau **ein** Eintrag in Edge-Logs für `get-lexoffice-document` (statt zwei).
2. PDF wird beim ersten Versuch geladen, kein 429.
3. Bei tatsächlichem Rate-Limit (z.B. mehrere Tabs): Function retried automatisch mit Backoff, PDF erscheint nach ~3–9s.
4. Edge-Logs zeigen bei 429: `[LexOffice /quotations/document] Status 429, Versuch 1/3 — warte 3000ms...`

