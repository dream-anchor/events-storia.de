
# Plan: Optimierte Schriftgrößen für CateringGrid-Kacheln

## Problemanalyse
Die letzte Änderung war zu drastisch:
- **Vorher**: `text-2xl md:text-3xl` (Titel) und `text-lg md:text-xl` (Beschreibung) – zu groß
- **Aktuell**: `text-lg md:text-xl` (Titel) und `text-sm md:text-base` (Beschreibung) – zu klein, schlechte Lesbarkeit

## Lösung: Goldener Mittelweg
Ich werde die Schriftgrößen auf einen ausgewogenen Wert setzen:

| Element | Aktuell | Neu |
|---------|---------|-----|
| **Titel** | `text-lg md:text-xl` | `text-xl md:text-2xl` |
| **Beschreibung** | `text-sm md:text-base` | `text-base md:text-lg` |

Zusätzliche Verbesserungen für bessere Lesbarkeit der Beschreibung:
- Stärkerer Text-Shadow für besseren Kontrast gegen das Hintergrundbild
- Leicht höhere Deckkraft: `text-white` statt `text-white/90`

## Technische Änderung

```tsx
// Zeile 110-114 ändern von:
<h3 className="text-lg md:text-xl font-serif font-semibold mb-0.5 text-white drop-shadow-lg">
  {title}
</h3>
<p className="text-sm md:text-base text-white/90 leading-snug drop-shadow-md line-clamp-2">
  {description}
</p>

// zu:
<h3 className="text-xl md:text-2xl font-serif font-semibold mb-1 text-white drop-shadow-lg">
  {title}
</h3>
<p className="text-base md:text-lg text-white leading-relaxed drop-shadow-lg line-clamp-2">
  {description}
</p>
```

## Zusammenfassung der Verbesserungen
1. **Titel**: Eine Stufe größer (`text-xl md:text-2xl`)
2. **Beschreibung**: Eine Stufe größer (`text-base md:text-lg`)
3. **Beschreibungsfarbe**: Volle Deckkraft (`text-white` statt `text-white/90`)
4. **Schatten**: Stärkerer Schatten für Beschreibung (`drop-shadow-lg` statt `drop-shadow-md`)
5. **Zeilenhöhe**: `leading-relaxed` für bessere Lesbarkeit
6. **Abstand**: Titel-Margin auf `mb-1` erhöht
