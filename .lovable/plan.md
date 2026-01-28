
# Konzept: Hinweistext + Erweiterte Typografie-Optimierung

## Problem 1: Fehlender Hinweistext auf /events

Der Hinweistext wurde in `EventPricingCards.tsx` hinzugefügt, aber diese Komponente wird **nicht** auf der `/events`-Seite verwendet. Die Events-Seite (`EventsImStoria.tsx`) nutzt stattdessen direkt die `EventPackageShopCard`-Komponenten.

### Lösung
Der Hinweistext muss in `EventsImStoria.tsx` nach dem Packages-Grid eingefügt werden (nach Zeile 361, vor dem Trust Note).

```text
+----------------------------------+
|       [Package Cards Grid]       |
+----------------------------------+
|                                  |
|   "Gerne können Sie weitere      |
|    Gänge und Getränke-Pakete     |
|    dazubuchen..."                |
|                                  |
+----------------------------------+
|         [Trust Note Bar]         |
+----------------------------------+
```

---

## Problem 2: Typografie noch nicht überall optimiert

Trotz der ersten Optimierungsrunde gibt es noch Bereiche mit zu kleiner Schrift:

### Aktuelle Schriftgrößen (zu klein)
| Bereich | Aktuell | Problem |
|---------|---------|---------|
| Events-Seite: Process Steps | `text-base` / `text-sm` | Zu klein für Desktop |
| Events-Seite: Event Types | `text-sm` | Beschreibungen schwer lesbar |
| Events-Seite: Included Services | `text-xs` | Viel zu klein |
| EventPackageShopCard: Includes | `text-base` | Könnte größer |
| Catering.tsx | `text-muted-foreground` | Kein expliziter Größen-Faktor |

### Neue Typografie-Skala für Inhalte

| Element | Aktuell | Neu |
|---------|---------|-----|
| **Body-Text (Beschreibungen)** | `text-sm` / `text-base` | `text-lg` |
| **Überschriften h2** | `text-2xl md:text-3xl` | `text-3xl md:text-4xl` |
| **Überschriften h3** | `text-base md:text-lg` | `text-lg md:text-xl` |
| **Sub-Beschreibungen** | `text-xs` / `text-sm` | `text-sm` / `text-base` |
| **Trust Badges/Notes** | `text-sm` | `text-base` |

---

## Technische Umsetzung

### Datei 1: EventsImStoria.tsx
- Hinweistext nach Package-Grid einfügen
- Process Steps: Titel `text-base → text-lg`, Beschreibung `text-sm → text-base`
- Event Types: Beschreibung `text-sm → text-base`
- Included Services: Beschreibung `text-xs → text-sm`
- Gallery Überschrift: `text-2xl → text-3xl` / `text-3xl → text-4xl`
- Trust Note: `text-sm → text-base`

### Datei 2: EventPackageShopCard.tsx
- Includes-Liste: `text-base → text-lg`
- Dietary options Text: `text-sm → text-base`
- Guest label: `text-sm → text-base`

### Datei 3: Catering.tsx
- Hauptbeschreibung: explizit `text-lg` setzen
- Überschriften: auf neue Skala anpassen
- Listen-Items: `text-muted-foreground → text-lg text-muted-foreground`

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `EventsImStoria.tsx` | + Hinweistext, + Schriftgrößen erhöhen |
| `EventPackageShopCard.tsx` | + Schriftgrößen erhöhen |
| `Catering.tsx` | + Explizite Schriftgrößen setzen |

## Ergebnis
- Hinweistext unter den Paketen sichtbar
- Mindest-Schriftgröße für Fließtext: 16px
- Beschreibungstexte: 18px (text-lg)
- Konsistente, lesbare Typografie auf allen Inhaltsseiten
