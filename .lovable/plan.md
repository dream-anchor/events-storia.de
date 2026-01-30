
# Typographie-Konzept: STORIA Catering Website

## Übersicht

Dieses Konzept definiert ein konsistentes Schriftgrößen-System für alle Bereiche der Webseite. Es basiert auf Tailwind CSS Klassen und unterscheidet zwischen **Serif** (Playfair Display für Überschriften) und **Sans-Serif** (Inter für UI/Body).

---

## Schriftarten-Zuordnung

| Schriftart | Tailwind-Klasse | Verwendung |
|------------|-----------------|------------|
| Playfair Display | `font-serif` | Hauptüberschriften, Preise |
| Cormorant Garamond | `font-display` | Elegante Taglines, Kategorietitel |
| Inter | `font-sans` | Body-Text, UI-Elemente, Buttons |
| Great Vibes | `font-signature` | Spezielle Akzente (sparsam) |

---

## Schriftgrößen-Hierarchie

### Hero-Bereich (Startseite & Landingpages)

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Logo | h-32 (128px) | h-40 (160px) | – (Bild) |
| Tagline | 14px | 16px | `text-sm md:text-base` |
| H1 Haupttitel | 18px | 20px | `text-lg md:text-xl` |

### Sektionsüberschriften (H2)

| Kontext | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Standard-Sektionen | 24px | 30px | `text-2xl md:text-3xl` |
| Hero-Landingpages | 36px | 72px | `text-4xl md:text-6xl lg:text-7xl` |
| Footer Service-Bereich | 30px | 36px | `text-3xl md:text-4xl` |

### Untertitel & Lead-Text

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Sektions-Subline | 18px | 18px | `text-lg` |
| Lead-Paragraph | 20px | 20px | `text-xl` |
| Service-Beschreibungen | 18px | 18px | `text-lg` |

### Content-Bereich

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Fließtext | 18px | 18px | `text-base` (Root: 18px) |
| Produktbeschreibungen | 16px | 16px | `text-base` |
| Card-Titel (H3) | 20px | 24px | `text-xl md:text-2xl` |
| Kategorietitel | 20px | 24px | `text-xl md:text-2xl` |

### Menükarten & Produktkarten

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Produktname | 20px | 20px | `text-xl` |
| Preis | 20px | 20px | `text-xl` |
| Serving-Info | 14px | 14px | `text-sm` |
| Beschreibung | 16px | 16px | `text-base` |
| Min. Bestellung | 14px | 14px | `text-sm` |

### Speisekarten-Anzeige (MenuDisplay)

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Menü-Titel | 36px | 48px | `text-4xl md:text-5xl` |
| Menü-Untertitel | 20px | 20px | `text-xl` |
| Kategorie-Titel | 30px | 30px | `text-3xl` |
| Kategorie-Beschreibung | 18px | 18px | `text-lg` |
| Gericht-Name | 20px | 20px | `text-xl` |
| Gericht-Preis | 20px | 20px | `text-xl` |
| Gericht-Beschreibung | 18px | 18px | `text-lg` |

### Navigation & Header

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Logo-Text "STORIA" | 24.8px | 31.2px | `text-[1.55rem] md:text-[1.95rem]` |
| Kontaktinfo | 16px | 16px | `text-base` |
| Nav-Links | 16px | 16px | `text-base` |

### Footer

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Service-Titel (H2) | 30px | 36px | `text-3xl md:text-4xl` |
| Service-Subline | 18px | 20px | `text-lg md:text-xl` |
| Anker-Titel (H3) | 20px | 20px | `text-xl` |
| Anker-Beschreibung | 18px | 18px | `text-lg` |
| Kontakt-Label (H3) | 16px | 16px | `text-base` |
| Kontaktdaten | 16px | 16px | `text-base` |
| Copyright | 14px | 14px | `text-sm` |
| Legal-Links | 14px | 14px | `text-sm` |

### Testimonials & Bewertungen

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Sektions-Titel | 24px | 30px | `text-2xl md:text-3xl` |
| Zitat-Text | 14px | 14px | `text-sm` |
| Autor-Name | 14px | 14px | `text-sm` |
| Firma | 12px | 12px | `text-xs` |

### Checkout & Formulare

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Seiten-Titel | 24px | 30px | `text-2xl md:text-3xl` |
| Formular-Labels | 16px | 16px | `text-base` |
| Input-Felder | 16px | 16px | `text-base` (min 16px für iOS) |
| Fehlermeldungen | 14px | 14px | `text-sm` |
| Hilfetext | 14px | 14px | `text-sm` |

### Statistiken & Trust-Bars

| Element | Mobile | Desktop | Klassen |
|---------|--------|---------|---------|
| Zahl/Wert | 30px | 36px | `text-3xl md:text-4xl` |
| Label | 16px | 16px | `text-base` |

### Buttons

| Variante | Größe | Klassen |
|----------|-------|---------|
| Standard | 14px | `text-sm` |
| Large | 16px | `text-base` |
| CTA Primary | 16px | `text-base` |

---

## Responsive Scaling-Prinzipien

1. **Mobile-First**: Basisgröße ist für Mobile definiert
2. **Desktop-Skalierung**: +2-4px für wichtige Überschriften
3. **Konsistente Abstufung**: Immer 1 Tailwind-Stufe (z.B. `sm` → `base` → `lg`)
4. **iOS-Kompatibilität**: Formularfelder mindestens 16px (verhindert Auto-Zoom)

---

## Empfohlene Anpassungen

### Inkonsistenzen beheben

| Bereich | Aktuell | Empfohlen |
|---------|---------|-----------|
| CateringCTA Body | `text-lg` | `text-base md:text-lg` |
| Testimonial Zitate | `text-sm` | `text-base` |
| EventTypes Card-Titel | `text-lg md:text-xl` | `text-xl` (konsistent) |

### Optimierungen

1. **Einheitliche Produktkarten**: Alle Catering-Seiten nutzen `text-xl` für Titel und `text-base` für Beschreibungen
2. **Footer vereinheitlichen**: Kontakt- und Lieferzeiten-Labels konsistent auf `text-base` mit `tracking-[0.2em]`
3. **Testimonial-Lesbarkeit**: Zitat-Text von `text-sm` auf `text-base` erhöhen

---

## Technische Details

### Root-Basisgröße (index.css)

```css
body {
  font-size: 18px;
  line-height: 1.6;
}
```

### Tailwind-Größen-Referenz

| Klasse | Pixel | rem |
|--------|-------|-----|
| `text-xs` | 12px | 0.75rem |
| `text-sm` | 14px | 0.875rem |
| `text-base` | 16px* | 1rem |
| `text-lg` | 18px | 1.125rem |
| `text-xl` | 20px | 1.25rem |
| `text-2xl` | 24px | 1.5rem |
| `text-3xl` | 30px | 1.875rem |
| `text-4xl` | 36px | 2.25rem |
| `text-5xl` | 48px | 3rem |
| `text-6xl` | 60px | 3.75rem |
| `text-7xl` | 72px | 4.5rem |

*Hinweis: Die Root-Schriftgröße ist 18px, daher erscheinen relative Größen entsprechend größer.

---

## Zusammenfassung

Dieses Konzept etabliert eine klare typographische Hierarchie:

- **Große Überschriften** (H1/H2): Playfair Display, 24-72px
- **Elegante Akzente**: Cormorant Garamond für Taglines
- **Body & UI**: Inter, 16-18px für optimale Lesbarkeit
- **Kleine Elemente**: 12-14px für Metadaten und rechtliche Hinweise

Die Implementierung erfordert minimale Änderungen, da die meisten Bereiche bereits konsistent sind.
