
# Plan: LexOffice Datumsformat-Fix für Event-Angebote

## Problem

Die LexOffice API lehnt das Datum `2026-01-30` für `voucherDate` ab mit der Fehlermeldung:
```
"The date value '2026-01-30' for 'voucherDate' cannot be parsed."
```

## Ursache

In der `create-event-quotation` Edge Function wird das Datum mit `.split('T')[0]` abgeschnitten:
```typescript
voucherDate: new Date().toISOString().split('T')[0],  // → "2026-01-30" ❌
```

Die funktionierende `create-lexoffice-invoice` Function verwendet hingegen das vollständige ISO 8601 Format:
```typescript
voucherDate: new Date().toISOString(),  // → "2026-01-30T02:10:45.830Z" ✓
```

LexOffice erwartet für alle Datumsfelder das **volle ISO 8601 DateTime-Format**.

---

## Lösung

### Datei: `supabase/functions/create-event-quotation/index.ts`

**Zeile 83-84 ändern:**

```typescript
// ALT (fehlerhaft):
voucherDate: new Date().toISOString().split('T')[0],
expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],

// NEU (korrekt):
voucherDate: new Date().toISOString(),
expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
```

---

## Technische Details

| Feld | Aktuelles Format | Korrigiertes Format |
|------|------------------|---------------------|
| `voucherDate` | `2026-01-30` | `2026-01-30T02:10:45.830Z` |
| `expirationDate` | `2026-02-13` | `2026-02-13T02:10:45.830Z` |

---

## Nach der Änderung

Die Edge Function wird automatisch neu deployed. Danach sollte der "Angebot & E-Mail senden" Button ohne Fehlermeldung funktionieren.
