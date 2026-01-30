
# Plan: Floating Buttons → Bottom-Left Integration (Apple 2026)

## Übersicht

Alle zentrierten Floating Buttons im StoriaMaestro Admin werden entfernt und durch kontextuelle Inline-Buttons am unteren linken Rand ersetzt. Dies folgt dem **F-Schema Lesefluss** (Apple 2026 UX) und reduziert visuellen Ballast.

## Betroffene Komponenten

| Komponente | Aktueller Zustand | Neuer Zustand |
|------------|-------------------|---------------|
| `CourseSelector.tsx` | `fixed bottom-6 left-1/2 -translate-x-1/2` (2× Instanzen) | Inline-Button unten links im Card-Container |
| `MenuWorkflow.tsx` | `flex justify-end` (rechts ausgerichtet) | `flex justify-start` (links ausgerichtet) |
| `FloatingActionBar.tsx` | `fixed bottom-24 left-1/2 -translate-x-1/2` | `fixed bottom-6 left-6` (linke Ecke) |

## Technische Änderungen

### 1. CourseSelector.tsx (2 Stellen)

**Zeilen 349-369** (Custom Item Branch):
- Entferne `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`
- Ersetze durch relativen Container innerhalb der Card
- Positioniere links ausgerichtet mit Glassmorphism-Styling

**Zeilen 634-654** (Standard Item Branch):
- Identische Anpassung wie oben
- Button wird Teil des `CardContent` Layouts

**Neues Markup (beide Stellen):**
```tsx
{/* Inline Action Bar - unten links */}
<AnimatePresence>
  {hasSelection && (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="mt-6 flex justify-start"
    >
      <Button 
        onClick={onNext} 
        size="lg"
        className="px-6 h-12 rounded-2xl shadow-lg text-base gap-2 bg-primary"
      >
        {isLastCourse ? "Weiter zu Getränke" : "Nächster Gang"}
        <ChevronRight className="h-5 w-5" />
      </Button>
    </motion.div>
  )}
</AnimatePresence>
```

### 2. MenuWorkflow.tsx

**Zeilen 213-225** (Courses → Drinks Button):
```tsx
// Alt: <div className="flex justify-end">
// Neu:
<div className="flex justify-start">
```

**Zeilen 252-264** (Drinks → Finalize Button):
```tsx
// Alt: <div className="flex justify-end">
// Neu:
<div className="flex justify-start">
```

### 3. FloatingActionBar.tsx (Bulk Actions)

**Zeilen 23-29**:
```tsx
// Alt: className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40"
// Neu:
className="fixed bottom-6 left-6 z-40"
```

Entferne `-translate-x-1/2` da Button nicht mehr zentriert.

## Visueller Vergleich

```text
┌─────────────────────────────────────────────────┐
│  VORHER (Floating zentriert)                    │
│                                                 │
│             ┌───────────────────┐               │
│             │  Nächster Gang  > │  ← Floating   │
│             └───────────────────┘               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  NACHHER (Inline links)                         │
│                                                 │
│  ┌───────────────────┐                          │
│  │  Nächster Gang  > │  ← Inline, links         │
│  └───────────────────┘                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Vorteile

1. **F-Schema Konformität**: Primäre Aktionen folgen dem natürlichen Lesefluss (oben-links → unten-links)
2. **Kein Overlay-Konflikt**: Buttons überlagern keine anderen UI-Elemente mehr
3. **Mobile Optimierung**: Keine Kollision mit der MobileBottomNav (fixed bottom-0)
4. **Konsistente Interaktion**: Alle CTAs im Admin folgen demselben Pattern

## Nicht betroffen (bleiben unverändert)

- **MobileBottomNav** (`FloatingPillNav.tsx`): Dies ist die Hauptnavigation, kein Action-Button
- **CookieSettingsButton**: Bereits korrekt positioniert (`bottom-4 left-4`)
- **FloatingActions** (Telefon/WhatsApp): Nur auf Public-Seiten, nicht im Admin

## Dateien zur Bearbeitung

1. `src/components/admin/refine/InquiryEditor/MenuComposer/CourseSelector.tsx`
2. `src/components/admin/refine/InquiryEditor/MenuComposer/MenuWorkflow.tsx`
3. `src/components/admin/motion/FloatingActionBar.tsx`
