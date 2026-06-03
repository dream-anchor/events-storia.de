## Problem
Im Angebots-Editor (`InlineCourseEditor`) lässt sich der Einzelpreis nicht leeren: Wenn man "54" löscht, setzt die Logik zwar `overridePrice = null`, das Input zeigt aber sofort wieder den Katalogpreis als Fallback an. Ergebnis: Preis erscheint unlöschbar.

Aktuelle Logik (Zeile 343–347):
```
value = hasOverride ? overridePrice : (catalogPrice > 0 ? catalogPrice : '')
```
→ Leeren wird visuell ignoriert.

## Ziel
Der Operator muss den Einzelpreis explizit leeren können — egal ob Katalogpreis existiert. Eine geleerte Zeile fließt mit 0 in Zwischensumme/Errechnet gesamt ein (bzw. wird ausgeblendet bei der Summenbildung).

## Änderungen

### `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineCourseEditor.tsx`
1. **Lokaler Input-State**: Statt direkt aus `course.overridePrice`/`catalogPrice` abzuleiten, einen lokalen String-State `priceInput` einführen, der den Roh-Wert des Inputs hält.
2. **Sync-Regel**:
   - Beim Mount und immer wenn `course.itemId` wechselt (neue Speise gewählt) → `priceInput` aus neuem `overridePrice ?? catalogPrice ?? ''` befüllen.
   - Bei reinem Re-Render (gleiches Item) → lokaler State bleibt erhalten, damit "leer" leer bleibt.
3. **onChange**: Lokalen String setzen + `onUpdatePrice(idx, parsedOrNull)`. Leerer String → `null` (gilt als explizit geleert).
4. **Platzhalter**: Bleibt der Katalogpreis als visueller Hinweis (`placeholder=catalogPrice.toFixed(2)`), so sieht der Operator, was der Default wäre, ohne dass die Zeile zwangsweise damit gefüllt ist.
5. **unitPrice / lineTotal**: Nur noch aus `overridePrice` ableiten (nicht mehr aus Katalog fallback), damit eine geleerte Zeile auch tatsächlich 0 bzw. nicht zur Summe beiträgt. Das matcht das Verhalten "einzelne Speisen ohne Summe" beim Menü-Anlegen.

### Auswirkung auf Summen (`useOfferBuilder` o.ä.)
Kurz prüfen, ob die Zwischensummen-Berechnung bereits auf `overridePrice == null` korrekt mit 0 umgeht. Falls sie noch auf catalogPrice zurückfällt, dort denselben Fix: leere Override = 0 € Zeile, keine implizite Katalog-Annahme.

### Konsistenz "überall"
Andere Preis-Inputs (z.B. `PackageEdit`, `EventModules`, `WizardConfigurator`) verwenden direkt `value={field ?? ''}` ohne Katalog-Fallback — dort tritt das Problem nicht auf. Kein Eingriff nötig, solange kein Bericht vorliegt. Der Fix bleibt fokussiert auf den Offer-Builder.

## Out of scope
- Anzeige-/Layout-Änderungen am Editor.
- Migration: keine Schema-Änderung nötig, `override_price` bleibt nullable wie bisher.