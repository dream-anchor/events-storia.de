## Ursache

Die Edge Function `get-lexoffice-document-by-id` (genutzt von der neuen Belege-Card für Vorschau & Download) ruft LexOffice mit dem alten 1-Schritt-Flow auf:

```
GET /v1/{invoices|quotations}/{id}/document   Accept: application/pdf
```

LexOffice antwortet hier seit einiger Zeit mit **500 Internal server error** (Logs bestätigt: mehrere `LexOffice API error 500` für Angebote & Rechnungen). Die Funktion gibt deshalb 404/500 zurück → Frontend zeigt „Edge Function returned a non-2xx status code".

Die parallel vorhandene Funktion `get-lexoffice-document` nutzt bereits den korrekten **2-Step-Flow mit Retry** (Memory: „LexOffice Retrievals — 2-step fetch, 3 retries"):

1. `GET /v1/{endpoint}/{id}/document` mit `Accept: application/json` → liefert `documentFileId`
2. `GET /v1/files/{documentFileId}` mit `Accept: application/pdf` → PDF-Binary
3. Retry (3×) bei Status 500/429, mit `Retry-After` Berücksichtigung

## Fix

`supabase/functions/get-lexoffice-document-by-id/index.ts` an `get-lexoffice-document` angleichen:

- `fetchWithRetry`-Helper übernehmen (3 Versuche, 500/429 retryable)
- 1-Step `/document` mit `Accept: application/pdf` ersetzen durch 2-Step-Flow (JSON → `documentFileId` → `/files/{id}`)
- `endpointMap` um `creditnote → credit-notes` ergänzen (bereits vorhanden, beibehalten)
- Auth-Check, Response-Shape (`{ pdf, documentType, filename }`) unverändert lassen — Frontend bleibt kompatibel
- Bei harten Fehlern weiterhin sauberen JSON-Error mit Status 404/502/500 zurückgeben (kein Throw nach außen)

Keine Frontend-Änderungen nötig. Kein DB-Schema betroffen.

## Verifikation

Nach Deploy in der Belege-Card auf „Angebot AG0142" und „Schlussrechnung RE0026" klicken → Vorschau & Download liefern PDFs. Logs sollten `Step 1: Rendering…` / `Step 2: Downloading…` zeigen.
