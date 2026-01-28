
# Typografie-Optimierung für bessere Lesbarkeit

## Analyse der aktuellen Situation

Die Website verwendet aktuell oft zu kleine Schriftgrößen, besonders auf Desktop-Geräten. Die Hauptprobleme:
- Body-Text häufig `text-sm` (14px) statt `text-base` (16px)
- Beschreibungen oft `text-xs` (12px) 
- Überschriften könnten größer sein für bessere visuelle Hierarchie
- Footer und Service-Bereiche verwenden kleine Schriftgrößen

## Konzept: Lesbarkeits-Optimierung

### 1. Globale Basis-Schriftgröße
**Ort:** `src/index.css`

Die Body-Schriftgröße wird global von 16px auf 18px erhöht:
```css
body {
  font-size: 18px; /* von 16px */
  line-height: 1.6;
}
```

### 2. Komponenten-Updates

| Komponente | Aktuell | Neu |
|------------|---------|-----|
| **CateringGrid** | text-xl/text-2xl (Titel) | text-2xl/text-3xl |
| **CateringGrid** | text-base/text-lg (Beschreibung) | text-lg/text-xl |
| **Footer** | text-base/text-lg | text-lg/text-xl |
| **Footer Kontakt** | text-sm | text-base |
| **CateringCTA** | text-xl/text-2xl | text-2xl/text-3xl |
| **Catering-Seiten** | text-lg (Untertitel) | text-xl |
| **MenuDisplay** | text-lg (Items) | text-xl |
| **Kontakt** | text-muted-foreground | text-lg |
| **Legal Pages** | prose-lg | prose-xl |
| **ServiceInfoCard** | text-sm/text-xs | text-base/text-sm |

### 3. Detaillierte Änderungen pro Bereich

#### Homepage (Index.tsx)
- Bewertungen-Überschrift: `text-2xl → text-3xl` (Desktop: `text-3xl → text-4xl`)
- Bewertungen-Text: Standard → `text-lg`
- Bildunterschrift: `text-xs → text-sm`

#### CateringGrid.tsx
- Kategorie-Überschrift: `text-sm → text-base` (Desktop: `text-base → text-lg`)
- Beschreibungstext: `text-sm → text-base`
- Card-Titel: `text-xl → text-2xl` (Desktop: `text-2xl → text-3xl`)
- Card-Beschreibung: `text-base → text-lg` (Desktop: `text-lg → text-xl`)

#### Footer.tsx
- Service-Titel: `text-2xl → text-3xl` (Desktop: `text-3xl → text-4xl`)
- Service-Beschreibungen: `text-base → text-lg`
- Kontakt-Bereich: `text-sm → text-base`
- Kontakt-Details: Mindestens 16px

#### Catering-Seiten (BuffetFingerfood, etc.)
- Seitenüberschrift: `text-3xl → text-4xl` (Desktop: `text-4xl → text-5xl`)
- Untertitel: `text-lg → text-xl`
- Card-Titel: `text-lg → text-xl`
- Card-Beschreibung: `text-sm → text-base`
- Preise: `text-lg → text-xl`
- Serving-Info: `text-xs → text-sm`

#### CateringCTA.tsx
- Überschrift: `text-xl → text-2xl` (Desktop: `text-2xl → text-3xl`)
- Beschreibung: Standard → `text-lg`

#### MenuDisplay.tsx (Speisekarte, Getränke, Mittagsmenü)
- Menü-Titel: `text-3xl → text-4xl` (Desktop: `text-4xl → text-5xl`)
- Kategorie-Namen: `text-2xl → text-3xl`
- Item-Namen: `text-lg → text-xl`
- Item-Beschreibungen: `text-base → text-lg`
- Preise: `text-lg → text-xl`

#### Kontakt.tsx
- Seitentitel: `text-4xl → text-5xl`
- Beschreibungstext: Standard → `text-lg`
- Kontakt-Details: `text-muted-foreground → text-base`

#### Legal Pages (Impressum, Datenschutz, AGB)
- Überschriften: `text-xl → text-2xl`
- Body-Text: `prose-lg → prose-xl` (18px statt 16px)

#### ServiceInfoCard.tsx
- Highlight-Titel: `text-lg → text-xl`
- Service-Titel: `text-sm → text-base`
- Service-Untertitel: `text-xs → text-sm`

### 4. Checkout-Seite
Die Checkout-Seite beibehält kompaktere Schriftgrößen für Formularelemente (UX-Standard), aber:
- Labels: `text-sm → text-base`
- Zusammenfassung: `text-xs → text-sm`
- Überschriften: Größer

### 5. Nicht betroffen (wie gewünscht)
- **Header auf der Startseite** (Hero.tsx)
- **Navigation** (bleibt kompakt für UX)

## Technische Umsetzung

Die Änderungen erfolgen durch Anpassung der Tailwind-Klassen in den jeweiligen Komponenten:
1. `src/index.css` - Globale Basis
2. `src/components/CateringGrid.tsx`
3. `src/components/Footer.tsx`
4. `src/components/CateringCTA.tsx`
5. `src/components/MenuDisplay.tsx`
6. `src/components/catering/ServiceInfoCard.tsx`
7. `src/pages/Index.tsx`
8. `src/pages/Kontakt.tsx`
9. `src/pages/Impressum.tsx`
10. `src/pages/Datenschutz.tsx` (und alle Legal-Seiten)
11. `src/pages/catering/BuffetFingerfood.tsx` (Template für alle Catering-Seiten)
12. `src/pages/Speisekarte.tsx`
13. `src/pages/Mittagsmenu.tsx`
14. `src/pages/Getraenke.tsx`
15. `src/pages/UeberUns.tsx`
16. `src/pages/Checkout.tsx` (nur Labels/Summaries)

## Ergebnis

Nach der Umsetzung:
- Mindest-Schriftgröße für Fließtext: 16px (statt 12-14px)
- Standard-Body-Text: 18px
- Überschriften deutlich größer für bessere Hierarchie
- Bessere Lesbarkeit auf allen Geräten
- Konsistente Typografie-Skala

