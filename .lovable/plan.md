
# Erweiterung Menü-Kompositions-System: Globale Suche, Workflow & Navigation 2026

## Zusammenfassung

Dieses Update transformiert das Menü-Kompositions-System in ein flexibles, nicht-lineares Werkzeug mit globaler Suchfunktion und nahtlosem Übergang zur Angebotserstellung. Die Navigation erhält ein modernes "2026"-Design mit Pill-Navigation, Command-Palette und kontextabhängigen Aktionen.

---

## Teil 1: Globale Suchfunktion für alle Gänge

### Problemstellung
Aktuell filtert der `CourseSelector` strikt nach `allowed_sources` und `allowed_categories` aus der Paket-Konfiguration. Mitarbeiter können keine Gerichte außerhalb dieser Logik hinzufügen.

### Lösung: Dual-Mode Suche

```text
┌─────────────────────────────────────────────────────────────┐
│ 🍽️ HAUPTGANG (FLEISCH/FISCH)                               │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔍 Gericht suchen...                          [⌘K]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Empfohlen] [Alle Speisen durchsuchen]  ← Toggle           │
│                                                             │
│ ┌──────────────────┐ ┌──────────────────┐                  │
│ │ Secondi di pesce │ │ Secondi di carne │   ← Kategorien   │
│ │ Branzino         │ │ Tagliata         │                  │
│ │ Salmone          │ │ Ossobuco         │                  │
│ └──────────────────┘ └──────────────────┘                  │
│                                                             │
│ [+ Freie Position hinzufügen]  ← Custom Entry              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technische Umsetzung

**1. Erweiterung CourseSelector.tsx**

- Neuer State: `searchMode: 'recommended' | 'global'`
- Bei `global`: Alle Items aus `useCombinedMenuItems()` werden durchsucht
- Keyboard-Shortcut `⌘K` / `Ctrl+K` öffnet Command-Dialog

**2. Neue Komponente: GlobalItemSearch.tsx**

```typescript
// Nutzt die vorhandene Command-Palette (cmdk)
<CommandDialog open={isOpen} onOpenChange={setIsOpen}>
  <CommandInput placeholder="Alle Speisen & Getränke durchsuchen..." />
  <CommandList>
    <CommandGroup heading="Ristorante">
      {ristoranteItems.map(item => (
        <CommandItem onSelect={() => onSelect(item)}>
          {item.name}
        </CommandItem>
      ))}
    </CommandGroup>
    <CommandGroup heading="Catering-Katalog">
      {cateringItems.map(item => (...))}
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

**3. Freie Positionen**

- Button "+ Freie Position" ermöglicht manuelle Eingabe
- Felder: Name, Beschreibung (optional)
- Wird als `isCustom: true, itemSource: 'manual'` gespeichert

### Anpassungen für Getränke

Der `DrinkPackageSelector` erhält dieselbe Logik:
- Standard: Vorkonfigurierte Optionen (Spritz/Wein etc.)
- Erweitert: "Anderes Getränk wählen" → Globale Getränke-Suche

---

## Teil 2: Workflow-Optimierung → PDF nach Getränken

### Neues 3-Stufen-Modell

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐        │
│  │   Gänge    │ ─→ │  Getränke  │ ─→ │  Angebot   │        │
│  │            │    │            │    │            │        │
│  │     ✓      │    │     ✓      │    │     →      │        │
│  └────────────┘    └────────────┘    └────────────┘        │
│                                                             │
│  Frei navigierbar mit Tab-Leiste                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Neue Komponente: MenuWorkflow.tsx

Ersetzt den bisherigen linearen Flow im `MenuComposer`:

```typescript
type WorkflowStep = 'courses' | 'drinks' | 'finalize';

const MenuWorkflow = ({ ... }) => {
  const [activeStep, setActiveStep] = useState<WorkflowStep>('courses');
  
  return (
    <div>
      {/* Pill-Navigation */}
      <div className="flex gap-2 p-1 bg-muted rounded-full">
        <PillTab active={activeStep === 'courses'} onClick={() => setActiveStep('courses')}>
          🍽️ Gänge {coursesComplete && '✓'}
        </PillTab>
        <PillTab active={activeStep === 'drinks'} onClick={() => setActiveStep('drinks')}>
          🍷 Getränke {drinksComplete && '✓'}
        </PillTab>
        <PillTab active={activeStep === 'finalize'} onClick={() => setActiveStep('finalize')}>
          📄 Angebot
        </PillTab>
      </div>
      
      {/* Step Content */}
      {activeStep === 'courses' && <CoursesPanel />}
      {activeStep === 'drinks' && <DrinksPanel />}
      {activeStep === 'finalize' && <FinalizePanel />}
    </div>
  );
};
```

### Finalize-Panel (Neuer Schritt 3)

```text
┌─────────────────────────────────────────────────────────────┐
│ 📄 ANGEBOT ERSTELLEN                                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ MENÜ-ZUSAMMENFASSUNG                                    │ │
│ │                                                         │ │
│ │ 🍽️ Vorspeise: Vorspeisenplatte                         │ │
│ │ 🥩 Hauptgang: Tagliata di Manzo (Ristorante)           │ │
│ │ 🍰 Dessert: Tiramisù (Ristorante)                       │ │
│ │                                                         │ │
│ │ 🍷 Getränke: Wein-Paket (0,7l p.P.)                    │ │
│ │    inkl. Wasser, Kaffee                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💬 Persönliches Anschreiben                             │ │
│ │                                                         │ │
│ │ [AI generieren]  [Vorlage wählen]                       │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Sehr geehrte/r Herr/Frau Müller,                    │ │ │
│ │ │                                                     │ │ │
│ │ │ vielen Dank für Ihre Anfrage...                     │ │ │
│ │ │ [Editierbar]                                        │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ [PDF Vorschau]     [✉️ Per E-Mail senden]             │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Integration in SmartInquiryEditor

Der bisherige 2-Tab-Ansatz (Kalkulation / Kommunikation) wird angepasst:

- **Kalkulation-Tab**: Paket-Auswahl + MenuWorkflow (Gänge → Getränke → Angebot)
- **Kommunikation-Tab**: Nur noch für Follow-ups und Status-Updates

Der `AIComposer` und PDF-Generierung werden in das neue Finalize-Panel integriert.

---

## Teil 3: Navigation 2026 - State of the Art

### Konzept: Pill-Based Contextual Navigation

```text
┌─────────────────────────────────────────────────────────────┐
│ [STORIA Logo]                                               │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📊 Dashboard │ 📅 Events (3) │ 📦 Bestellungen │ ...    │ │
│ │              │               │                 │        │ │
│ │   Floating Pill-Bar mit Glasmorphism                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Im Editor-Kontext:                                          │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ← Zurück │ Mueller GmbH │ 📅 12.03.2026 │ 35 Gäste     │ │
│ │                                                         │ │
│ │ Kontextuelle Info-Bar                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⌘K → Spotlight-Suche für schnelle Aktionen                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Features

**1. Floating Pill-Bar**

```css
/* Glasmorphism + Floating Design */
.nav-pill-bar {
  backdrop-filter: blur(16px);
  background: rgba(255, 255, 255, 0.8);
  border-radius: 9999px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  padding: 4px;
}

.nav-pill {
  border-radius: 9999px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-pill[data-active="true"] {
  background: var(--primary);
  color: white;
}
```

**2. Command Palette (⌘K)**

Global verfügbar im Admin-Bereich:

- Schnell-Navigation zu jeder Seite
- Suche nach Events/Bestellungen
- Aktionen: "Neue Anfrage erstellen", "PDF exportieren"

**3. Contextual Breadcrumb-Bar**

Im Editor zeigt eine zweite Leiste:
- Zurück-Button
- Kundenname + Event-Details
- Status-Badge
- Quick-Actions

### Technische Umsetzung

**AdminLayout.tsx Refactoring**

```typescript
// Neue Struktur
<AdminLayout>
  {/* Floating Nav */}
  <FloatingPillNav activeKey={activeTab} items={navigation} />
  
  {/* Command Palette - Global */}
  <CommandPaletteProvider>
    <CommandPalette />
  </CommandPaletteProvider>
  
  {/* Context Bar (optional) */}
  {contextInfo && <ContextBar {...contextInfo} />}
  
  {/* Main Content */}
  <main>{children}</main>
</AdminLayout>
```

---

## Dateiänderungen

### Neue Dateien

| Datei | Beschreibung |
|-------|--------------|
| `MenuComposer/GlobalItemSearch.tsx` | Command-Palette für globale Suche |
| `MenuComposer/MenuWorkflow.tsx` | 3-Stufen Wizard (Gänge → Getränke → Angebot) |
| `MenuComposer/FinalizePanel.tsx` | Zusammenfassung + AI-Text + PDF-Vorschau |
| `MenuComposer/CustomItemInput.tsx` | Freie Positionseingabe |
| `admin/refine/FloatingPillNav.tsx` | Moderne Pill-Navigation |
| `admin/refine/CommandPalette.tsx` | ⌘K Spotlight-Suche |
| `admin/refine/ContextBar.tsx` | Kontextuelle Infoleiste |

### Zu modifizierende Dateien

| Datei | Änderungen |
|-------|------------|
| `CourseSelector.tsx` | Toggle für "Empfohlen" vs "Alle Speisen" |
| `DrinkPackageSelector.tsx` | Option "Anderes Getränk wählen" |
| `MenuComposer/index.tsx` | Integration MenuWorkflow |
| `SmartInquiryEditor.tsx` | Anpassung Tab-Struktur |
| `AdminLayout.tsx` | Neue Navigation + Command Palette |
| `types.ts` | Erweiterung für manuelle Einträge |

---

## Implementierungsreihenfolge

### Phase 1: Globale Suche (Priorität: Hoch)
1. `GlobalItemSearch.tsx` erstellen
2. `CourseSelector.tsx` erweitern um Dual-Mode
3. `DrinkPackageSelector.tsx` erweitern
4. `CustomItemInput.tsx` für freie Positionen
5. Types erweitern für `itemSource: 'manual'`

### Phase 2: Workflow-Optimierung (Priorität: Hoch)
1. `MenuWorkflow.tsx` erstellen
2. `FinalizePanel.tsx` mit AI-Composer Integration
3. `MenuComposer/index.tsx` refactoren
4. `SmartInquiryEditor.tsx` anpassen

### Phase 3: Navigation 2026 (Priorität: Mittel)
1. `FloatingPillNav.tsx` erstellen
2. `CommandPalette.tsx` mit Keyboard-Shortcuts
3. `ContextBar.tsx` für Editor-Kontext
4. `AdminLayout.tsx` komplett refactoren

---

## UI-Vorschau: Finaler Workflow

```text
┌────────────────────────────────────────────────────────────────┐
│ [STORIA]  ┌──────────────────────────────────┐  [Max M.]  [⚙] │
│           │ 📊 │ 📅 Events (3) │ 📦 │ 🍽️ │ │                  │
│           └──────────────────────────────────┘                 │
├────────────────────────────────────────────────────────────────┤
│ ← │ Mueller GmbH │ Business Dinner │ 12.03.26 │ 35 Gäste      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │  🍽️ Gänge ✓  │  🍷 Getränke ✓  │  📄 Angebot →           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ MENÜ-ZUSAMMENFASSUNG                                    │    │
│ │                                                         │    │
│ │ Vorspeise    Vorspeisenplatte (im Paket)               │    │
│ │ Hauptgang    Tagliata di Manzo                         │    │
│ │ Dessert      Tiramisù                                  │    │
│ │                                                         │    │
│ │ Getränke     Wein-Paket + Wasser + Kaffee              │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 💬 ANSCHREIBEN                    [🤖 AI generieren]   │    │
│ │                                                         │    │
│ │ Sehr geehrte Frau Müller,                              │    │
│ │                                                         │    │
│ │ vielen Dank für Ihre Anfrage zu Ihrem Business         │    │
│ │ Dinner am 12. März 2026. Gerne unterbreiten wir        │    │
│ │ Ihnen folgendes Angebot:                               │    │
│ │                                                         │    │
│ │ [Vollständig editierbarer Text...]                     │    │
│ │                                                         │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │              [PDF Vorschau]    [✉️ Angebot senden]        │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Vorteile

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| Flexibilität | Nur vordefinierte Kategorien | Globale Suche + freie Positionen |
| Workflow | 2 separate Tabs | Durchgehender 3-Stufen-Prozess |
| Navigation | Standard-Links | Moderne Pill-Bar + ⌘K |
| Geschwindigkeit | Mehrere Klicks zum PDF | Direkter Übergang nach Getränken |
| UX | 2020-Standard | 2026 State of the Art |
