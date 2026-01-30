
# StoriaMaestro UX Modernisierung: Navigation & User Flows

## Analyse des aktuellen Zustands

### 1. Hauptnavigation (FloatingPillNav)
**Aktuell:** 7 Navigationspunkte horizontal angeordnet
- Dashboard, Inbox, Anfragen, Events, Catering, Pakete, Speisen

**Probleme:**
- Zu viele gleichwertige Elemente ohne Hierarchie
- "Anfragen" und "Events" sind semantisch ähnlich, aber getrennt
- Keine visuelle Gruppierung nach Workflow-Kontext
- Mobile Version ist ein horizontaler Scroll ohne Priorisierung

### 2. Dashboard → Listen → Editor Flow
**Aktuell:**
```
Dashboard → Events-Liste → SmartInquiryEditor
```

**Probleme:**
- Kein Breadcrumb oder Context-Trail
- Der Zurück-Button ist ein einfacher Ghost-Button (subtil)
- Kein klarer visueller Übergang zwischen Hierarchieebenen

### 3. Inbox vs. Editor-Dualität
**Aktuell:** Zwei parallele Workflows existieren:
1. Inbox (Master-Detail) → Schnelle Übersicht
2. Listen (DataTable) → Details via Edit-Button

**Problem:** Nutzer wissen nicht, welchen Einstiegspunkt sie nutzen sollen

### 4. MenuWorkflow (3-Step Wizard)
**Aktuell:** Gänge → Getränke → Angebot als Pill-Navigation

**Positiv:** Modernes Design mit Step-Indikatoren
**Verbesserungspotenzial:** Könnte als Muster für alle Multi-Step-Prozesse dienen

### 5. Command Palette (⌘K)
**Aktuell:** Basic Navigation + Schnellaktionen

**Fehlt:**
- Suche nach echten Daten (Events, Bestellungen)
- Kontextuelle Aktionen basierend auf aktuellem Bereich

---

## Lösung: Unified Navigation Architecture 2026

### Konzept: "Focused Context System"

Statt vieler gleichwertiger Tabs: **Drei Kontexte** mit Tiefennavigation

```
┌────────────────────────────────────────────────────────┐
│  [Logo]    [Context Pill] ──▶ [Suche]    [⌘K] [User]  │
│                                                         │
│  Inbox  ◀────────▶  Anfragen  ◀────────▶  Stammdaten   │
│  (Triage)           (Workflow)           (Katalog)     │
└────────────────────────────────────────────────────────┘
```

### Phase 1: Navigation Redesign

**Datei: `src/components/admin/refine/AdminLayout.tsx`**

Neue Navigation mit 3 Hauptbereichen + Context-Trail:

```typescript
const navigationContexts = [
  { 
    name: 'Inbox', 
    href: '/admin/inbox', 
    icon: Inbox, 
    key: 'inbox',
    description: 'Triage & Schnellaktionen'
  },
  { 
    name: 'Anfragen', 
    href: '/admin/events', 
    icon: CalendarDays, 
    key: 'workflow',
    description: 'Event & Catering Workflows',
    children: [
      { name: 'Events', href: '/admin/events', badge: 'events' },
      { name: 'Buchungen', href: '/admin/bookings', badge: 'bookings' },
      { name: 'Catering', href: '/admin/orders', badge: 'orders' },
    ]
  },
  { 
    name: 'Stammdaten', 
    href: '/admin/packages', 
    icon: Database, 
    key: 'catalog',
    description: 'Pakete, Speisen, Locations',
    children: [
      { name: 'Pakete', href: '/admin/packages' },
      { name: 'Speisen', href: '/admin/menu' },
    ]
  },
];
```

### Phase 2: Context-Aware Header

**Datei: `src/components/admin/refine/ContextHeader.tsx`** (neu)

Ein intelligenter Header, der den aktuellen Kontext anzeigt:

```typescript
// Beispiel für Events-Liste
<ContextHeader
  breadcrumb={[
    { label: 'Anfragen', href: '/admin/events' },
    { label: 'Event-Anfragen', current: true }
  ]}
  title="Event-Anfragen"
  subtitle="23 offene Anfragen"
  actions={<Button>Neue Anfrage</Button>}
  quickFilters={['Neu', 'Angebot', 'Bestätigt']}
/>

// Beispiel für Editor
<ContextHeader
  breadcrumb={[
    { label: 'Anfragen', href: '/admin/events' },
    { label: 'Event-Anfragen', href: '/admin/events' },
    { label: 'Firma XY', current: true }
  ]}
  title="Firma XY - Weihnachtsfeier"
  subtitle="50 Gäste • 15.12.2026"
  actions={<StatusBadge />}
/>
```

### Phase 3: Unified Workflow Indicator

**Konzept:** Der MenuWorkflow-Pill-Style als universelles Muster

Alle mehrstufigen Prozesse bekommen einen einheitlichen Step-Indicator:

```
┌─────────────────────────────────────────────────┐
│  ● Kontakt  ──  ○ Kalkulation  ──  ○ Angebot   │
│    ✓ abgeschlossen   aktiv        ausstehend   │
└─────────────────────────────────────────────────┘
```

**Anwendung:**
- SmartInquiryEditor: Kontakt → Kalkulation → Kommunikation
- Catering-Bestellung: Produkte → Lieferung → Zahlung
- Paket-Erstellung: Basis → Inhalt → Locations

### Phase 4: Smart Command Palette

**Datei: `src/components/admin/refine/CommandPalette.tsx`**

Erweiterte Suche mit echten Daten:

```typescript
// Neue Struktur
<CommandGroup heading="Schnellzugriff">
  {/* Dynamische Ergebnisse aus der Datenbank */}
  {recentEvents.map(event => (
    <CommandItem onSelect={() => navigate(`/admin/events/${event.id}/edit`)}>
      <CalendarDays className="mr-2 h-4 w-4" />
      {event.company_name || event.contact_name}
      <CommandShortcut>{event.preferred_date}</CommandShortcut>
    </CommandItem>
  ))}
</CommandGroup>

<CommandGroup heading="Aktionen">
  <CommandItem>Neue Anfrage erstellen</CommandItem>
  <CommandItem>E-Mail-Entwurf öffnen</CommandItem>
  <CommandItem>Zur Kalkulation springen</CommandItem>
</CommandGroup>
```

### Phase 5: Transition Animations

**Datei: `src/index.css`**

Sanfte Übergänge zwischen Hierarchieebenen:

```css
.admin-layout {
  /* Page transitions */
  .page-enter {
    @apply opacity-0 translate-x-4;
  }
  .page-enter-active {
    @apply opacity-100 translate-x-0 transition-all duration-200;
  }
  
  /* Card hover lift */
  .interactive-card {
    @apply transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5;
  }
}
```

### Phase 6: Mobile-First Navigation

**Datei: `src/components/admin/refine/MobileNav.tsx`** (neu)

Bottom-Tab-Navigation für Mobile mit Swipe-Gesten:

```typescript
// Drei primäre Tabs am unteren Rand
<nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t">
  <div className="grid grid-cols-3 h-16">
    <NavTab icon={Inbox} label="Inbox" href="/admin/inbox" />
    <NavTab icon={CalendarDays} label="Anfragen" href="/admin/events" />
    <NavTab icon={Database} label="Katalog" href="/admin/packages" />
  </div>
</nav>
```

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `AdminLayout.tsx` | Navigation auf 3 Kontexte reduzieren |
| `FloatingPillNav.tsx` | Dropdown für Sub-Navigation |
| `CommandPalette.tsx` | Echte Datensuche + kontextuelle Aktionen |
| `ContextBar.tsx` → `ContextHeader.tsx` | Erweiterter Breadcrumb-Header |
| `EventsList.tsx` | Neuer ContextHeader |
| `SmartInquiryEditor.tsx` | Workflow-Indicator hinzufügen |
| `InboxPage.tsx` | Als primärer Einstiegspunkt optimieren |
| `index.css` | Transition-Animationen |
| `MobileNav.tsx` (neu) | Bottom-Tab-Navigation |

---

## Vorher / Nachher Vergleich

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| **Navigationspunkte** | 7 gleichwertige Tabs | 3 Kontexte mit Dropdown |
| **Orientierung** | Flach, keine Hierarchie | Breadcrumb-Trail |
| **Mobile** | Horizontaler Scroll | Bottom-Tab + Swipe |
| **Suche (⌘K)** | Nur Navigation | Echte Daten + Aktionen |
| **Übergänge** | Hart, sofort | Sanfte Animations |
| **Workflow-Status** | Nur im MenuWorkflow | Überall konsistent |

---

## Priorisierung

1. **High Impact, Low Effort:** Navigation auf 3 Kontexte + Breadcrumb
2. **High Impact, Medium Effort:** Smart Command Palette mit Datensuche
3. **Medium Impact:** Workflow-Indicator als universelles Muster
4. **Polish:** Transition-Animationen, Mobile Bottom-Nav
