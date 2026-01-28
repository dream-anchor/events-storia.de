

# Menü-Kompositions-System für Event-Pakete

## Zusammenfassung

Ein intelligentes, paketbasiertes Menü-Zusammenstellungssystem, das Mitarbeitern ermöglicht, schnell und fehlerfrei Event-Menüs zu konfigurieren. Das System leitet durch die Gangauswahl basierend auf dem gewählten Paket und generiert automatisch professionelle Angebote.

---

## Geschäftslogik der Pakete

### Network-Aperitivo (69€ p.P.)
```text
┌─────────────────────────────────────────────────────────────┐
│ ESSEN                                                       │
│ ├── Fingerfood (Catering-Katalog)                          │
│ └── Pasta-Auswahl (Ristorante: Kategorie "Paste")          │
├─────────────────────────────────────────────────────────────┤
│ GETRÄNKE (pro Person)                                       │
│ ├── 1× Aperitif (Spritz ODER Cocktail)                     │
│ ├── 0,7l Flaschenwein ODER 5× Bier                         │
│ ├── 1× Wasser (mit/ohne)                                   │
│ └── 1× Kaffee-Spezialität                                  │
└─────────────────────────────────────────────────────────────┘
```

### Business Dinner – Exclusive (99€ p.P.)
```text
┌─────────────────────────────────────────────────────────────┐
│ ESSEN (3 Gänge)                                             │
│ ├── Gang 1: Vorspeisenplatte (Custom-Position)             │
│ ├── Gang 2: Hauptgericht (Fleisch ODER Fisch)              │
│ └── Gang 3: Dessert                                        │
├─────────────────────────────────────────────────────────────┤
│ GETRÄNKE (pro Person)                                       │
│ ├── 4× Spritz ODER 0,7l offener Wein                       │
│ ├── Wasser (mit/ohne, unbegrenzt)                          │
│ └── Kaffee-Spezialitäten                                   │
└─────────────────────────────────────────────────────────────┘
```

### Gesamte Location (8.500€ pauschal)
```text
┌─────────────────────────────────────────────────────────────┐
│ ESSEN (4 Gänge)                                             │
│ ├── Gang 1: Vorspeisenplatte (Custom-Position)             │
│ ├── Gang 2: Fischgericht                                   │
│ ├── Gang 3: Fleischgericht                                 │
│ └── Gang 4: Dessert                                        │
├─────────────────────────────────────────────────────────────┤
│ GETRÄNKE (pro Person)                                       │
│ ├── 4× Spritz ODER 0,7l offener Wein                       │
│ ├── Wasser (mit/ohne, unbegrenzt)                          │
│ └── Kaffee-Spezialitäten                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Lösungsarchitektur

### Neue Komponente: `MenuComposer`

Eine geführte Gang-für-Gang Auswahl, die:
- Automatisch die richtigen Kategorien filtert
- Bereits ausgewählte Gänge markiert
- Nur noch fehlende Gänge zur Auswahl anzeigt
- Getränke-Kontingente verwaltet

```text
┌──────────────────────────────────────────────────────────────┐
│ MENÜ-ZUSAMMENSTELLUNG                                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ Business Dinner – Exclusive │ 35 Gäste                       │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🍽️ GANG 1: VORSPEISE                            ✓ Gewählt │ │
│ │    Vorspeisenplatte (hausgemacht)                        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🥩 GANG 2: HAUPTGERICHT                    ⚠ Auswählen   │ │
│ │                                                          │ │
│ │  ┌─────────────────┐  ┌─────────────────┐               │ │
│ │  │ 🐟 FISCH        │  │ 🥩 FLEISCH      │               │ │
│ │  │                 │  │                 │               │ │
│ │  │ Branzino       │  │ Tagliata        │               │ │
│ │  │ Kabeljau       │  │ Ossobuco        │               │ │
│ │  │ Salmone        │  │ Filetto         │               │ │
│ │  └─────────────────┘  └─────────────────┘               │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🍰 GANG 3: DESSERT                         ○ Noch offen  │ │
│ │    (Nach Hauptgang-Auswahl)                              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ 🍷 GETRÄNKE-PAUSCHALE                                        │
│                                                              │
│  ○ Spritz-Paket (4 Spritz p.P.)                             │
│  ● Wein-Paket (0,7l offener Wein p.P.)      ← Ausgewählt    │
│                                                              │
│  ✓ Wasser (inkl.)                                           │
│  ✓ Kaffee-Spezialitäten (inkl.)                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Datenbank-Erweiterungen

### 1. Neue Tabelle: `package_course_config`

Definiert die Gang-Struktur pro Paket:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `package_id` | UUID | Referenz zum Paket |
| `course_type` | TEXT | 'starter', 'pasta', 'main_fish', 'main_meat', 'dessert', 'fingerfood' |
| `course_label` | TEXT | "Vorspeise", "Hauptgang (Fleisch/Fisch)" |
| `is_required` | BOOLEAN | Pflichtgang? |
| `allowed_sources` | TEXT[] | ['catering', 'ristorante'] |
| `allowed_categories` | TEXT[] | ['Secondi di pesce', 'Secondi di carne'] |
| `is_custom_item` | BOOLEAN | Für "Vorspeisenplatte" (nicht im Katalog) |
| `custom_item_name` | TEXT | "Vorspeisenplatte" |
| `sort_order` | INT | Reihenfolge |

### 2. Neue Tabelle: `package_drink_config`

Definiert die Getränke-Optionen pro Paket:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `package_id` | UUID | Referenz zum Paket |
| `drink_group` | TEXT | 'aperitif', 'wine', 'water', 'coffee' |
| `options` | JSONB | Kategorien/Mengen pro Option |
| `quantity_per_person` | TEXT | "1", "0.7l", "unlimited" |
| `is_choice` | BOOLEAN | Entweder/oder Auswahl? |

### 3. Erweiterung: `event_inquiries`

Neues JSON-Feld für die Menü-Konfiguration:

```json
{
  "menu_selection": {
    "courses": [
      { "course_type": "starter", "item_id": null, "custom_name": "Vorspeisenplatte" },
      { "course_type": "main_fish", "item_id": "ristorante_xxx", "name": "Branzino" },
      { "course_type": "dessert", "item_id": "ristorante_yyy", "name": "Tiramisù" }
    ],
    "drinks": {
      "aperitif_choice": "wine",
      "selected_wine": "Montepulciano d'Abruzzo"
    }
  }
}
```

---

## Komponenten-Architektur

### Neue Dateien

```text
src/components/admin/refine/InquiryEditor/
├── MenuComposer/
│   ├── index.tsx              # Hauptkomponente
│   ├── CourseSelector.tsx     # Gang-Auswahl mit Kategorien
│   ├── DrinkPackageSelector.tsx  # Getränke-Pauschale
│   ├── CourseProgress.tsx     # Fortschrittsanzeige
│   ├── CustomItemInput.tsx    # Für Vorspeisenplatte etc.
│   └── types.ts               # MenuSelection, CourseConfig
│
├── hooks/
│   └── usePackageMenuConfig.ts  # Lädt Gang-Konfiguration
```

### Komponenten-Hierarchie

```text
SmartInquiryEditor
└── EventModules
    ├── PackageSelector (existiert)
    └── MenuComposer (NEU)
        ├── CourseProgress
        ├── CourseSelector (pro Gang)
        │   ├── CategoryFilter
        │   └── ItemGrid
        └── DrinkPackageSelector
            ├── ChoiceToggle (Spritz/Wein)
            └── IncludedItems (Wasser, Kaffee)
```

---

## Workflow Integration

### Mitarbeiter-Workflow

```text
1. ANFRAGE ÖFFNEN
   └─→ Paket auswählen (z.B. "Business Dinner")
       └─→ MenuComposer wird aktiviert

2. MENÜ ZUSAMMENSTELLEN
   ├─→ Gang 1: "Vorspeisenplatte" (automatisch vorausgefüllt)
   ├─→ Gang 2: Fleisch ODER Fisch wählen
   │           └─→ Filtert automatisch Restaurant-Karte
   └─→ Gang 3: Dessert wählen

3. GETRÄNKE KONFIGURIEREN
   └─→ Spritz-Paket ODER Wein-Paket wählen

4. ANGEBOT GENERIEREN
   ├─→ AI-Composer erstellt personalisierte E-Mail
   └─→ PDF zeigt komplettes Menü + Getränke

5. VERSAND
   └─→ LexOffice Angebot + E-Mail mit einem Klick
```

---

## PDF-Erweiterung

Das Angebot-PDF zeigt das komplette Menü strukturiert:

```text
┌──────────────────────────────────────────────────────────────┐
│                         ANGEBOT                              │
│                                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ MENÜ FÜR 35 PERSONEN                                         │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ VORSPEISE                                              │   │
│ │ Vorspeisenplatte                                       │   │
│ │ (Auswahl italienischer Antipasti)                      │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ HAUPTGANG                                              │   │
│ │ Tagliata di Manzo                                      │   │
│ │ (Geschnittenes Rinderfilet mit Rucola und Parmesan)   │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ DESSERT                                                │   │
│ │ Tiramisù                                               │   │
│ │ (Hausgemacht nach Original-Rezept)                     │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ GETRÄNKE-PAUSCHALE (pro Person)                              │
│ • 0,7l offener Wein (Rot/Weiß/Rosé)                         │
│ • Wasser mit und ohne Kohlensäure                           │
│ • Kaffee-Spezialitäten                                       │
│                                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ Business Dinner – Exclusive         35 × 99,00 €  3.465,00 € │
│                                                              │
│ Zwischensumme (netto)                             3.465,00 € │
│ MwSt. 7%                                            242,55 € │
│ ─────────────────────────────────────────────────────────── │
│ GESAMTBETRAG                                      3.707,55 € │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementierungsplan

### Phase 1: Datenbank & Konfiguration
1. Migration für `package_course_config` und `package_drink_config`
2. Seed-Daten für die drei Pakete
3. Erweiterung `event_inquiries.menu_selection` (JSONB)

### Phase 2: Kernkomponenten
1. `usePackageMenuConfig` Hook
2. `MenuComposer` Hauptkomponente
3. `CourseSelector` mit Kategorie-Filterung
4. `DrinkPackageSelector` für Getränke-Auswahl

### Phase 3: Integration
1. Einbindung in `EventModules`
2. State-Management im `SmartInquiryEditor`
3. Speichern der Menü-Auswahl in der Datenbank

### Phase 4: Ausgabe
1. AI-Composer erhält Menü-Daten
2. PDF-Template für Menü-Darstellung
3. LexOffice-Integration mit Menü-Details

---

## Technische Details

### Kategorie-Mapping für Restaurant

| Gang-Typ | Restaurant-Kategorien |
|----------|----------------------|
| `pasta` | "Paste" |
| `main_fish` | "Secondi di pesce" |
| `main_meat` | "Secondi di carne" |
| `dessert` | "I nostri Dolci" |
| `starter` | "Antipasti", "Insalate" |
| `aperitif` | "Cocktai list", "Glamour im Glas" |
| `wine` | "Weißweine", "ROSÉWEINE", "Rotweine" |

### Catering-Katalog Kategorien

| Gang-Typ | Catering-Kategorien |
|----------|---------------------|
| `fingerfood` | Fingerfood, Häppchen |
| `platten` | Platten & Sharing |
| `dessert` | Desserts |

### State-Struktur

```typescript
interface MenuSelection {
  courses: CourseSelection[];
  drinks: DrinkSelection;
}

interface CourseSelection {
  courseType: 'starter' | 'pasta' | 'main_fish' | 'main_meat' | 'dessert' | 'fingerfood';
  itemId: string | null;
  itemName: string;
  itemSource: 'catering' | 'ristorante' | 'custom';
  isCustom: boolean;
}

interface DrinkSelection {
  aperitifChoice: 'spritz' | 'cocktail' | 'wine' | 'beer';
  selectedItems: { id: string; name: string; quantity: number }[];
}
```

---

## Vorteile der Lösung

| Aspekt | Vorteil |
|--------|---------|
| **Geschwindigkeit** | Menü in < 2 Minuten zusammengestellt |
| **Fehlerfreiheit** | Nur gültige Kombinationen möglich |
| **Konsistenz** | Gleiche Struktur für alle Mitarbeiter |
| **Flexibilität** | Gang-Konfiguration in DB, nicht im Code |
| **Professionalität** | Vollständiges Menü im Angebot |
| **Skalierbarkeit** | Neue Pakete ohne Code-Änderungen |

