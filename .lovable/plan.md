## Zwei kleine Änderungen

### 1. Lieferlogik > 8 km anpassen

In `supabase/functions/calculate-delivery/index.ts` (Branch `else` ab Zeile 164):

**Neu:** Pauschale 50 € netto pro Fahrt **zusätzlich** zu den km-Kosten.

```
netCost = (50 € + oneWayDistanceKm × 1,20 €) × tripMultiplier
```

- Pizza-only (× 1 Fahrt): 50 € + km × 1,20 €
- Mit Equipment (× 2 Fahrten): (50 € + km × 1,20 €) × 2

**Beispiele (Brutto, 19 % MwSt):**
| km | Pizza-only | mit Equipment |
|---|---|---|
| 10 | (50 + 12) = 62 € netto → **73,78 €** | 124 € netto → **147,56 €** |
| 20 | (50 + 24) = 74 € netto → **88,06 €** | 148 € netto → **176,12 €** |
| 30 | (50 + 36) = 86 € netto → **102,34 €** | 172 € netto → **204,68 €** |

Message-Texte werden ergänzt: `"Lieferung (X km, inkl. Anfahrtspauschale)"` bzw. `"× 2 Fahrten"`.

Bereiche ≤ 1 km und 1–8 km bleiben unverändert.

### 2. Sonderzeichen-Fix in der Vorschau-Mail

Die Vorschau zeigt `â€"`, `Ã¤`, `Â`, `âŸ"` – klassisches Mojibake (UTF-8-Bytes als Latin-1 interpretiert). Ursache: Die `<meta charset="utf-8">` steht im `<head>` der HTML-E-Mail, aber das Vorschau-File wird ohne BOM gespeichert und Lovable's File-Viewer rät die Kodierung falsch.

**Fix:**
- Sonderzeichen im Template `supabase/functions/send-payment-confirmation-v2/index.ts` durch HTML-Entities ersetzen, damit auch bei falscher Charset-Erkennung korrekt:
  - `–` → `&ndash;`
  - `·` (Middle Dot) → `&middot;` (ist teils schon so)
  - `&middot;` ist OK – bleibt
  - Anführungszeichen / Auslassungspunkte ggf. ASCII-äquivalente
- Beim Generieren der Vorschau-HTML-Datei in `/mnt/documents/` mit UTF-8-BOM speichern (`\uFEFF` voranstellen), damit Browser/Viewer die Kodierung garantiert als UTF-8 lesen.

Tatsächlicher E-Mail-Versand via Resend ist nicht betroffen (Resend versendet sauberes UTF-8 mit korrektem Content-Type-Header). Es handelt sich ausschließlich um ein Vorschau-Anzeige-Problem.

### Was NICHT geschickt wird
Keine Mail-Versendung an Kunden in diesem Schritt – nur Code-Anpassung + neue saubere Vorschau-HTMLs für Cyim und Rigshospitalet zur Freigabe.