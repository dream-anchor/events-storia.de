## Ziel
Im PublicOffer ganz oben (direkt unter dem Hero, vor Anschreiben/Vorschlag) eine Restaurant-Galerie einblenden, damit Kunden – die das STORIA noch nicht kennen – einen visuellen Eindruck bekommen. Bilder per Klick als Lightbox vergrößern.

## Bildquelle
Wir nutzen die **bereits im Projekt vorhandenen** Restaurant-Fotos aus `src/assets/` (gleiche Bilder wie im öffentlichen `ImageGrid`):
- `haus-aussen-2.webp` (Gebäude/Außen)
- `aussen.webp` (Terrasse Tag)
- `menschen-aussen.jpeg` (Gäste Terrasse)
- `weinservice.webp` (Bar/Weinregal)
- `cocktails.webp` (Bar/Drinks)
- `meeresfruchte.webp` (Antipasti)
- `ravioli.webp` (Pasta)
- `tiramisu.webp` (Dessert)

Die zwei hochgeladenen Collagen sind nur Referenz für die Bildauswahl/Stimmung – keine neuen Assets nötig.

## Neue Komponente
`src/pages/public-offer/RestaurantGallery.tsx`

- Editorial Layout, passend zum bestehenden PublicOffer-Stil (Container, Serif-Display Headline, dezente Captions).
- Desktop: 4-spaltiges Masonry-artiges Grid (asymmetrisch: 1 großes Bild links + kleinere Kacheln, oder schlichtes 4×2 mit `aspect-[4/5]` und einem `md:col-span-2` Hero). Mobile: 2 Spalten, Hero `col-span-2`.
- Kopfzeile: kleine Eyebrow „Ristorante Storia · München-Maxvorstadt", Headline „Lernen Sie unser Haus kennen" (oder vergleichbar), 1 Satz Subline.
- Jedes Bild: `<button>` mit `aria-label`, `loading="lazy"`, `decoding="async"`, hover-Zoom (`group-hover:scale-[1.03]`), Caption-Overlay nur dezent (kleine Label unten links, monochrom).
- Klick öffnet **shadcn `Dialog`** als Lightbox:
  - Großes Bild zentriert (`max-h-[85vh] object-contain`), schwarzer Hintergrund (`bg-black/95`).
  - Pfeile links/rechts (Buttons) + Tastatur (`ArrowLeft`/`ArrowRight`/`Escape`).
  - Zähler „3 / 8" und Caption unten.
  - Keine externen Lightbox-Pakete – nur shadcn Dialog + lokaler State.

## Integration in `src/pages/PublicOffer.tsx`
Ein einziger Einfügepunkt, direkt nach `<HeroSection .../>` und **vor** `OfferLanguageSwitcher`:

```tsx
<HeroSection inquiry={inquiry} phase={renderPhase} />
<RestaurantGallery />
<OfferLanguageSwitcher ... />
```

- Wird in **allen** Phasen (proposal_sent, final_sent, confirmed, paid, customer_responded) angezeigt – das Kennenlernen schadet auch nach Buchung nicht. Falls gewünscht, später per Prop `phase` ausblenden.
- Komponente ist statisch (keine DB/Props) → kein Refactor anderer Stellen.

## Design-Prinzipien
- Premium UI 2026, monochrom (kein neues Grün/Gelb), `rounded-2xl`, `border-border/40`, `shadow-[var(--shadow-card)]`.
- Inter (body) + bestehende Display-Font für Headline.
- Keine Floating-Buttons. Lightbox-Close ist die Standard-shadcn-Schließen-Aktion + ESC.
- A11y: `role="dialog"`, Fokus-Trap durch shadcn, alle Buttons mit `aria-label`, alt-Texte deutsch (analog zu `ImageGrid.tsx`).

## Out of scope
- Keine neuen Bilder generieren oder hochladen.
- Keine Backend-/Schema-Änderungen.
- Keine Änderung an Hero, Anschreiben oder Phasenlogik.
