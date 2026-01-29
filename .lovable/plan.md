
# Plan: StoriaMaestro Typografie-Upgrade für bessere Lesbarkeit

## Problem-Analyse

Das Admin-Dashboard verwendet an vielen Stellen zu kleine Schriftgrößen, die auf dem Bildschirm schwer lesbar sind:
- `text-xs` (12px) für Badges, Pagination, Hinweise
- `text-sm` (14px) für viele Tabellen-Inhalte und Beschreibungen
- Überschriften teilweise zu klein (text-2xl statt größer)

## Lösung: Systemische Typografie-Skalierung

Die Schriftgrößen im gesamten StoriaMaestro-Admin werden um eine Stufe erhöht:

| Element | Vorher | Nachher |
|---------|--------|---------|
| Seitenüberschriften | `text-2xl` / `text-3xl` | `text-3xl` / `text-4xl` |
| Abschnittsüberschriften | `text-sm` | `text-base` |
| Fließtext & Tabellen | `text-sm` | `text-base` |
| Badges & kleine Hinweise | `text-xs` | `text-sm` |
| Navigation-Items | `text-sm` / `text-xs` | `text-base` / `text-sm` |
| Pagination & Metadaten | `text-xs` | `text-sm` |

## Betroffene Dateien & Änderungen

### 1. `src/components/admin/refine/Dashboard.tsx`

**Seitenüberschrift größer:**
```tsx
// Zeile 52: "StoriaMaestro" Titel
text-3xl → text-4xl

// Zeile 76, 92, 106, 120: Stat-Zahlen
text-3xl → text-4xl
```

**Stat-Cards Beschreibungen:**
```tsx
// Zeilen 69, 85, 99, 113: CardTitle
text-sm → text-base

// Zeilen 77, 93, 107, 121: Unter den Zahlen
text-xs → text-sm
```

### 2. `src/components/admin/refine/EventsList.tsx`

**Seitenüberschrift:**
```tsx
// Zeile 177
text-2xl → text-3xl
```

**Tabellen-Zellen:**
```tsx
// Zeilen 99, 111, 130, 144, 149: Datumsanzeige, Kontaktdaten
text-sm text-muted-foreground → text-base text-muted-foreground
```

### 3. `src/components/admin/refine/EventBookingsList.tsx`

**Seitenüberschrift:**
```tsx
// Zeile 70
text-3xl → text-4xl
```

**Buchungskarten:**
```tsx
// Zeilen 131, 139, 147, 153: Alle text-sm
text-sm → text-base
```

### 4. `src/components/admin/refine/FloatingPillNav.tsx`

**Desktop Navigation:**
```tsx
// Zeile 37: Nav-Links
text-sm → text-base

// Zeile 49: Badge-Zähler
text-[10px] → text-xs
```

**Mobile Navigation:**
```tsx
// Zeile 83: Mobile Nav-Links
text-xs → text-sm

// Zeile 93: Mobile Badge
text-[10px] → text-xs
```

### 5. `src/components/admin/refine/DataTable.tsx`

**Filter Pills:**
```tsx
// Zeile 114
text-sm → text-base
```

**Aktive Filter Text:**
```tsx
// Zeile 131
text-sm → text-base
```

**Pagination:**
```tsx
// Zeile 199, 213
text-sm → text-base
```

### 6. `src/components/admin/refine/AdminLayout.tsx`

**Header-Elemente:**
```tsx
// Zeile 77: ⌘K Shortcut
text-xs → text-sm

// Zeile 80: User E-Mail
text-sm → text-base
```

### 7. `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`

**Editor-Überschriften:**
```tsx
// Zeile 343
text-2xl → text-3xl
```

**Status-Anzeige:**
```tsx
// Zeile 361
text-sm → text-base
```

### 8. Admin-weite CSS-Regel (Optional)

Alternativ könnte in `index.css` ein Admin-spezifischer Typografie-Override hinzugefügt werden:

```css
/* Admin-spezifische Typografie */
[class*="/admin"] .text-sm,
main[data-admin="true"] .text-sm {
  @apply text-base;
}

[class*="/admin"] .text-xs,
main[data-admin="true"] .text-xs {
  @apply text-sm;
}
```

## Visuelle Vorschau

```text
┌─────────────────────────────────────────────────────────────┐
│                       VORHER                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  StoriaMaestro                    (text-3xl = 30px)         │
│  Willkommen im Event- & Catering-Management  (text-sm)     │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │ Neue Anfragen│ │ Menü offen │  (text-sm = 14px Titel)   │
│  │     3       │ │     5      │  (text-3xl = 30px Zahl)    │
│  │ Warten...   │ │ Buchungen..│  (text-xs = 12px)          │
│  └─────────────┘ └─────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       NACHHER                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  StoriaMaestro                    (text-4xl = 36px)         │
│  Willkommen im Event- & Catering-Management  (text-base)   │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │ Neue Anfragen│ │ Menü offen │  (text-base = 18px Titel) │
│  │     3       │ │     5      │  (text-4xl = 36px Zahl)    │
│  │ Warten...   │ │ Buchungen..│  (text-sm = 14px)          │
│  └─────────────┘ └─────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Zusammenfassung der Änderungen

| Datei | Änderungen |
|-------|------------|
| `Dashboard.tsx` | Überschrift, Stat-Cards, Beschreibungen größer |
| `EventsList.tsx` | Überschrift, Tabellen-Texte größer |
| `EventBookingsList.tsx` | Überschrift, Karten-Texte größer |
| `FloatingPillNav.tsx` | Navigation Desktop + Mobile größer |
| `DataTable.tsx` | Filter Pills, Pagination größer |
| `AdminLayout.tsx` | Header-Elemente größer |
| `SmartInquiryEditor.tsx` | Editor-Überschriften größer |
| `OfferCreate/index.tsx` | Form-Texte größer |

**Ergebnis:** Ein durchgehend lesbares Admin-Dashboard mit professioneller Typografie, die auch bei längerer Nutzung angenehm für die Augen ist.
