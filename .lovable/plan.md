## Ziel

Wenn der Einzelpreis eines Gerichts (in jedem Modus: Menü, Paket, Network Aperitivo) gelöscht wird:
1. Input zeigt **"inkl."** als Placeholder.
2. Die Zeile trägt **0 €** zur Summe bei — keine implizite Katalogpreis-Übernahme.
3. **Angebotspreis / Person** (bzw. gesamt) passt sich sofort entsprechend an.

## Änderungen

### 1. `PriceBreakdown.tsx` — Katalogpreis-Fallback entfernen
Zeilen 267–269: `unitPrice` darf nicht mehr auf `catalogPrice` zurückfallen.

```ts
// vorher
const unitPrice = c.overridePrice != null && c.overridePrice > 0
  ? c.overridePrice
  : (catalogPrice && catalogPrice > 0 ? catalogPrice : null);
// nachher
const unitPrice = c.overridePrice != null && c.overridePrice > 0
  ? c.overridePrice
  : null;
```

Damit fließt eine geleerte Zeile mit 0 in `dishAbs`, der Subtotal sinkt, und `netDisplay` (= Errechnet/Person + Placeholder für Angebotspreis) reagiert direkt.

### 2. `InlineCourseEditor.tsx` — Placeholder vereinheitlichen
Zeile 379–383: Placeholder ist immer `'inkl.'`, sobald kein Override gesetzt ist (egal ob `packageMode`). Italic/muted Styling auch im Menü-Modus aktivieren, damit es klar als "inkludiert" erkennbar ist.

### 3. `MobileCourseSheet.tsx` — analoge Korrekturen
- Zeilen 83–88: `unitPrice` Fallback auf Katalogpreis entfernen.
- Zeilen 245–247: Placeholder im Preis-Input ebenfalls auf `'inkl.'` setzen.
- Zeile 260: `lineTotal != null` bleibt — wenn null, keine Zeilen-Total-Anzeige.

### 4. `useOfferBuilder.ts` — Konsistenz prüfen
Zeile 660–662 berechnet `dishAbs` für die persistierte Gesamtsumme bereits korrekt nur aus `overridePrice` (kein Katalog-Fallback). Keine Änderung nötig — das bestätigt, dass die UI-Anzeige in `PriceBreakdown` der einzige Inkonsistenz-Punkt war.

## Validierung

- Im offenen Inquiry `a14872bb…` ein Gericht leeren: Input zeigt "inkl.", Subtotal/Angebotspreis sinken um den Wert des entfernten Preises × Gäste.
- Network Aperitivo: Verhalten unverändert (Paket-Modus war bereits korrekt).
- Mobile Sheet: gleiches Verhalten beim Leeren.
- Gespeicherter Gesamtbetrag bleibt konsistent mit der UI-Anzeige.
