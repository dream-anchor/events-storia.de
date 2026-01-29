
# Button-Text und Dokumentname für Event-Buchungen anpassen

## Problem
1. **Button-Label falsch**: Nach einer Event-Paket-Bestellung zeigt der Button "Angebot herunterladen" statt "Bestellbestätigung herunterladen"
2. **Fehler "Dokument nicht verfügbar"**: Das Dokument existiert in LexOffice (ID: `04f7b599-de19-4691-81d4-1fde58ed0df5`), aber möglicherweise gibt es ein Timing-Problem oder der Dateiname ist irreführend

## Analyse

Die aktuelle Logik in `CustomerProfile.tsx` (Zeile 551-553):
```
if document_type === 'invoice' → "Rechnung herunterladen"
else → "Angebot herunterladen"
```

Für Event-Buchungen ist dies irreführend, da es sich um eine direkte Buchung handelt, nicht um ein Angebot.

---

## Technische Lösung

### 1. Frontend: `src/pages/CustomerProfile.tsx`

Der Button-Text wird basierend auf dem **Bestellnummer-Präfix** angepasst:

| Bestellnummer-Präfix | Button-Text (DE) | Button-Text (EN) |
|---------------------|------------------|------------------|
| `EVT-BUCHUNG` | Bestellbestätigung herunterladen | Download Confirmation |
| `CAT-BESTELLUNG` / `*-RECHNUNG` | Rechnung herunterladen | Download Invoice |
| `CAT-ANGEBOT` / `*-ANGEBOT` | Angebot herunterladen | Download Quotation |

Änderungen an Zeile 551-553:
```typescript
// Neue Logik basierend auf order_number Präfix
const isEventBooking = order.order_number.startsWith('EVT-BUCHUNG');
const isInvoice = order.lexoffice_document_type === 'invoice' || 
                  order.order_number.includes('-RECHNUNG') || 
                  order.order_number.includes('-BESTELLUNG');

// Button-Text:
// Event-Buchung → "Bestellbestätigung herunterladen"
// Rechnung/Bestellung → "Rechnung herunterladen"  
// Angebot → "Angebot herunterladen"
```

### 2. Backend: `supabase/functions/get-lexoffice-document/index.ts`

Der Dateiname wird ebenfalls angepasst (Zeile 129):

| Bestellnummer-Präfix | Dateiname |
|---------------------|-----------|
| `EVT-BUCHUNG` | `STORIA_Bestellbestaetigung_EVT-BUCHUNG-....pdf` |
| Rechnung | `STORIA_Rechnung_....pdf` |
| Angebot | `STORIA_Angebot_....pdf` |

---

## Dateien die geändert werden

1. **`src/pages/CustomerProfile.tsx`** – Button-Text-Logik anpassen (Zeile 551-553)
2. **`supabase/functions/get-lexoffice-document/index.ts`** – Dateinamen-Logik anpassen (Zeile 129-130)

---

## Hinweis zum "Dokument nicht verfügbar" Fehler

Die Bestellung `EVENTS-ANGEBOT-29-01-2026-851` hat bereits eine gültige LexOffice-ID (`04f7b599-de19-4691-81d4-1fde58ed0df5`). Falls der Fehler weiterhin auftritt, sollte nach der Code-Änderung ein Test durchgeführt werden, um die Edge Function Logs zu prüfen. Mögliche Ursachen:
- LexOffice benötigt einige Sekunden um das PDF zu rendern
- Authentifizierungsproblem beim Download
