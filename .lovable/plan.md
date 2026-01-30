

# Plan: Menü-Auswahl mit Inline-Editing & 2026 UX-Optimierung

## Problemanalyse

Nach der Analyse des aktuellen Workflows wurden folgende Punkte identifiziert:

### Was bereits gut ist (✓ State of the Art)
- **3-Stufen-Workflow**: Gänge → Getränke → Angebot (klar strukturiert)
- **Pill-Navigation**: Moderne, runde Navigation zwischen den Schritten
- **Keyboard Shortcuts**: ⌘K für globale Suche vorhanden
- **Empfohlen/Alle Speisen Toggle**: Intelligente Filterung
- **Auto-Save**: Debounced Speicherung bereits implementiert
- **Progress-Indicator**: Zeigt Fortschritt visuell an

### Was fehlt (✗ Nicht 2026-konform)
1. **Kein Inline-Edit in der Zusammenfassung**: Nach Abschluss aller Gänge gibt es keine Möglichkeit, einzelne Gerichte direkt zu bearbeiten
2. **Statische Menü-Übersicht im FinalizePanel**: Nur Anzeige, keine Interaktion
3. **Fehlende Hover-Aktionen**: Keine Edit-Icons bei getroffener Auswahl
4. **Keine Swipe/Drag-Aktionen**: Mobile-Optimierung fehlt
5. **Getränke-Auswahl hat keine Edit-Option**: Einmal gewählt, muss man komplett zurück

---

## Lösung: Interaktive Menü-Karten mit Inline-Edit

### 1. FinalizePanel: Klickbare Gänge mit Edit-Funktionalität

Jeder Gang in der Zusammenfassung erhält einen Edit-Button und öffnet bei Klick einen Dialog zur Änderung:

```text
┌──────────────────────────────────────────────────────┐
│  🥗 Vorspeise                          [✏️ Bearbeiten] │
│  ─────────────────────────────────────────────────── │
│  Insalata mista                                      │
│  Mit Balsamico-Dressing                              │
│  📍 Restaurant                                        │
└──────────────────────────────────────────────────────┘
```

**Interaktion:**
- Klick auf die Karte oder "Bearbeiten" → GlobalItemSearch öffnet sich
- Neue Auswahl ersetzt die alte direkt
- Keine Navigation zum Gänge-Schritt nötig

### 2. Neue Komponente: `EditableCourseCard`

```typescript
interface EditableCourseCardProps {
  course: CourseSelection;
  courseConfig: CourseConfig;
  onEdit: (newSelection: CourseSelection) => void;
  menuItems: MenuItem[];
}
```

**Features:**
- Hover-State mit Edit-Icon
- Click → GlobalItemSearch Dialog
- Smooth Animation bei Änderung
- Confirmation-Badge nach Edit

### 3. Getränke: Ebenfalls inline editierbar

Gleiche Logik für Getränke:
- Klick auf Getränke-Badge → GlobalItemSearch (filterType: 'drinks')
- Direktes Ersetzen ohne Schrittwechsel

### 4. Schnellzugriff via Keyboard

Erweiterte Shortcuts im FinalizePanel:
- `E` + `1-5` → Bearbeite Gang 1-5
- `E` + `D` → Bearbeite Getränke

---

## Technische Änderungen

### Datei: `FinalizePanel.tsx`

**Neue Imports:**
```typescript
import { Pencil } from "lucide-react";
import { GlobalItemSearch } from "./GlobalItemSearch";
import { CourseConfig, CourseSelection } from "./types";
```

**Neue Props:**
```typescript
interface FinalizePanelProps {
  // ... bestehende Props
  courseConfigs?: CourseConfig[];
  drinkConfigs?: DrinkConfig[];
  onCourseEdit?: (courseType: string, newSelection: CourseSelection) => void;
  onDrinkEdit?: (drinkGroup: string, newSelection: DrinkSelection) => void;
}
```

**Neue State-Variablen:**
```typescript
const [editingCourse, setEditingCourse] = useState<string | null>(null);
const [editingDrink, setEditingDrink] = useState<string | null>(null);
```

**UI-Änderung (Zeile 114-142):**
```typescript
{menuSelection.courses.map((course, idx) => (
  <div 
    key={idx} 
    className="group flex items-start justify-between p-3 bg-muted/50 rounded-lg 
               hover:bg-muted cursor-pointer transition-all"
    onClick={() => setEditingCourse(course.courseType)}
  >
    {/* ... bestehender Inhalt ... */}
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => {
        e.stopPropagation();
        setEditingCourse(course.courseType);
      }}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  </div>
))}
```

**Neuer GlobalItemSearch für Editing:**
```typescript
<GlobalItemSearch
  open={!!editingCourse}
  onOpenChange={(open) => !open && setEditingCourse(null)}
  onSelect={(item) => {
    if (editingCourse && onCourseEdit) {
      const config = courseConfigs?.find(c => c.course_type === editingCourse);
      onCourseEdit(editingCourse, {
        courseType: editingCourse,
        courseLabel: config?.course_label || editingCourse,
        itemId: item.id,
        itemName: item.name,
        itemDescription: item.description,
        itemSource: item.source,
        isCustom: false,
      });
    }
    setEditingCourse(null);
  }}
  filterType="food"
/>
```

### Datei: `MenuWorkflow.tsx`

**Neue Props an FinalizePanel übergeben:**
```typescript
<FinalizePanel
  // ... bestehende Props
  courseConfigs={courseConfigs}
  drinkConfigs={drinkConfigs}
  onCourseEdit={(courseType, newSelection) => handleCourseSelect(newSelection)}
  onDrinkEdit={(drinkGroup, newSelection) => handleDrinkSelect(newSelection)}
/>
```

---

## UX-Flow nach Änderung

```text
Nutzer im "Angebot"-Schritt
        ↓
Klickt auf "Hauptgang" Karte
        ↓
GlobalItemSearch öffnet sich (⌘K Stil)
        ↓
Sucht und wählt neues Gericht
        ↓
Dialog schließt, Karte aktualisiert sich
        ↓
Auto-Save speichert automatisch (800ms debounce)
        ↓
Nutzer kann E-Mail generieren
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `FinalizePanel.tsx` | Edit-States, hover-Buttons, GlobalItemSearch-Integration, onEdit-Callbacks |
| `MenuWorkflow.tsx` | Neue Props an FinalizePanel durchreichen |
| `types.ts` | Keine Änderungen nötig (Typen existieren bereits) |

---

## Weitere 2026-Optimierungen (optional)

Diese Features sind bereits vorhanden und müssen nicht geändert werden:
- ✓ Pill-Navigation mit animierten Übergängen
- ✓ Command-Palette für globale Suche (⌘K)
- ✓ Progress-Indicator pro Gang
- ✓ Source-Filter (Catering/Restaurant)
- ✓ Auto-Save mit visuellem Feedback
- ✓ Responsive Design

**Mögliche zukünftige Verbesserungen:**
- Drag-and-Drop Reihenfolge der Gänge
- Undo/Redo für letzte Änderungen
- AI-Vorschläge basierend auf Gästezahl

