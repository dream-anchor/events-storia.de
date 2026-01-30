
# Navigation-Korrektur: Semantisch korrekte Menüstruktur

## Problem

Der Haupt-Navigationsbutton heißt "Anfragen", aber enthält:
- Event-Anfragen ✓ (passt zum Namen)
- Buchungen ✗ (sind keine "Anfragen")
- Catering ✗ (sind keine "Anfragen")

## Lösung: Zwei getrennte Haupt-Kategorien

```text
Vorher:
[Dashboard] [Anfragen ▼]        [Stammdaten ▼]
             └── Event-Anfragen
             └── Buchungen
             └── Catering

Nachher:
[Dashboard] [Events ▼]          [Catering] [Stammdaten ▼]
             └── Anfragen
             └── Buchungen
```

### Semantik gemäß Business-Logik

| Kategorie | Unterpunkte | Beschreibung |
|-----------|-------------|--------------|
| **Events** | Anfragen, Buchungen | Alles rund um Restaurant-Events |
| **Catering** | (keine Unterpunkte) | Shop-Bestellungen für Lieferung |
| **Stammdaten** | Pakete, Speisen & Getränke | Konfiguration |

## Technische Änderungen

### Datei: `src/components/admin/refine/FloatingPillNav.tsx`

**Desktop-Navigation (Zeilen 29-58):**
```tsx
const navigationContexts: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/admin', 
    icon: LayoutDashboard, 
    key: 'dashboard' 
  },
  { 
    name: 'Events',       // Vorher: "Anfragen"
    href: '/admin/events', 
    icon: CalendarDays, 
    key: 'events',
    children: [
      { name: 'Anfragen', href: '/admin/events', key: 'events', badge: 'events', icon: CalendarDays },
      { name: 'Buchungen', href: '/admin/bookings', key: 'bookings', badge: 'bookings', icon: CheckCircle2 },
    ]
  },
  { 
    name: 'Catering',     // Eigene Haupt-Kategorie (ohne Dropdown)
    href: '/admin/orders', 
    icon: FileText, 
    key: 'orders',
    badge: 'orders',
  },
  { 
    name: 'Stammdaten', 
    href: '/admin/packages', 
    icon: Database, 
    key: 'catalog',
    children: [
      { name: 'Pakete', href: '/admin/packages', key: 'packages', icon: Package },
      { name: 'Speisen & Getränke', href: '/admin/menu', key: 'menu', icon: UtensilsCrossed },
    ]
  },
];
```

**Mobile-Navigation (MobileBottomNav, Zeilen 209-213):**
```tsx
const mobileItems = [
  { name: 'Events', href: '/admin/events', icon: CalendarDays, key: 'events', badge: 'events' },
  { name: 'Catering', href: '/admin/orders', icon: FileText, key: 'orders', badge: 'orders' },
  { name: 'Stammdaten', href: '/admin/packages', icon: Database, key: 'catalog' },
];
```

**Mobile-Pill-Navigation (MobilePillNav, Zeilen 283-288):**
```tsx
const shortcuts = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, key: 'dashboard' },
  { name: 'Anfragen', href: '/admin/events', icon: CalendarDays, key: 'events', badge: 'events' },
  { name: 'Buchungen', href: '/admin/bookings', icon: CheckCircle2, key: 'bookings', badge: 'bookings' },
  { name: 'Catering', href: '/admin/orders', icon: FileText, key: 'orders', badge: 'orders' },
];
```

**Active-Context-Logik anpassen (Zeile 76):**
```tsx
const getActiveContext = () => {
  const path = location.pathname;
  if (path === '/admin' || path === '/admin/') return 'dashboard';
  if (path.includes('/admin/events') || path.includes('/admin/bookings')) return 'events';
  if (path.includes('/admin/orders')) return 'orders';  // Separate Kategorie
  if (path.includes('/admin/packages') || path.includes('/admin/menu') || path.includes('/admin/locations')) return 'catalog';
  return activeKey;
};
```

## Ergebnis

- **Events** (Dropdown): Anfragen + Buchungen = kompletter Event-Workflow
- **Catering** (Direkt-Link): Shop-Bestellungen = separater Verkaufskanal
- Klare semantische Trennung der beiden Geschäftsbereiche
