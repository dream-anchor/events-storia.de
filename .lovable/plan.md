

# Plan: "Anschreiben generieren" nur bei vollständigem Menü erlauben

## Problem

Der Button "Anschreiben generieren" erscheint, obwohl das Menü nicht vollständig ist:

| Paket | Pflichtgänge | Konfiguriert | Button zeigt |
|-------|--------------|--------------|--------------|
| Business Dinner – Exclusive | 3 (Vorspeise, Hauptgang, Dessert) | 1 (nur Vorspeise) | "Anschreiben generieren" |

Die aktuelle Prüfung ist zu nachsichtig:
```text
configuredCourses > 0 || configuredDrinks > 0
→ "Mindestens 1 Element vorhanden" = fertig
```

Das ist falsch – alle **Pflichtgänge** des Pakets müssen konfiguriert sein.

---

## Lösung

Die Menü-Vollständigkeitsprüfung muss die **Paket-Konfiguration** berücksichtigen:

```text
VORHER (falsch):
Menü fertig = mindestens 1 Gang ODER 1 Getränk

NACHHER (korrekt):
Menü fertig = ALLE Pflichtgänge des Pakets sind konfiguriert
```

---

## Technische Änderungen

### 1. Neue Hilfsfunktion: `isMenuComplete`

Prüft für jede Option, ob alle Pflichtgänge konfiguriert sind:

```typescript
const isMenuComplete = (opt: OfferOption, packages: Package[]) => {
  const pkg = packages.find(p => p.id === opt.packageId);
  if (!pkg) return false;
  
  // Hole die Pflichtgänge aus der Paket-Konfiguration
  const requiredCourses = pkg.courseConfigs?.filter(c => c.is_required) || [];
  
  // Prüfe für jeden Pflichtgang, ob er konfiguriert ist
  const configuredCourseTypes = new Set(
    opt.menuSelection.courses
      .filter(c => c.itemId || c.itemName)
      .map(c => c.courseType)
  );
  
  return requiredCourses.every(rc => 
    configuredCourseTypes.has(rc.course_type)
  );
};
```

### 2. allMenusConfigured aktualisieren

```typescript
// VORHER (Zeile 87-91):
const allMenusConfigured = activeOptionsWithPackage.every(opt => {
  const configuredCourses = opt.menuSelection.courses.filter(c => c.itemId || c.itemName).length;
  return configuredCourses > 0 || configuredDrinks > 0;  // ← Zu nachsichtig
});

// NACHHER:
const allMenusConfigured = activeOptionsWithPackage.every(opt => 
  isMenuComplete(opt, packages)
);
```

### 3. Paket-Konfiguration in OfferOption laden

Die `packages` werden bereits als Prop übergeben. Die Konfiguration (courseConfigs) muss beim Laden der Pakete mit abgerufen werden.

---

## Workflow nach Änderung

```text
Option A: Business Dinner – Exclusive
├── Pflichtgänge: Vorspeise ✓, Hauptgang ✗, Dessert ✗
├── Status: UNVOLLSTÄNDIG
└── Button: "Konfigurieren" (scrollt zu Option A, öffnet Menü-Editor)

Nach Konfiguration aller Gänge:
├── Pflichtgänge: Vorspeise ✓, Hauptgang ✓, Dessert ✓  
├── Status: VOLLSTÄNDIG
└── Button: "Anschreiben generieren" ← Erst jetzt verfügbar!
```

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `MultiOfferComposer.tsx` | `allMenusConfigured` mit Pflichtgang-Prüfung |
| `useEventPackages.ts` oder Query | Paket-Konfiguration (courseConfigs) mit laden |

---

## UI-Feedback (optional)

Zeige visuell, welche Gänge noch fehlen:

```text
┌─────────────────────────────────────────────────────────────┐
│ Option A: Business Dinner – Exclusive                       │
├─────────────────────────────────────────────────────────────┤
│ GÄNGE                                          2/3 fehlen   │
│ ✓ Vorspeise: Vorspeisenplatte                               │
│ ○ Hauptgang: nicht konfiguriert ← Visueller Hinweis        │
│ ○ Dessert: nicht konfiguriert                               │
│                                                             │
│                               [Menü vervollständigen]       │
└─────────────────────────────────────────────────────────────┘
```

---

## Zusammenfassung

- **Anschreiben erst bei vollständigem Menü** – alle Pflichtgänge müssen konfiguriert sein
- **Klare Aktion** – "Konfigurieren" statt "Anschreiben generieren" bei unvollständigem Menü
- **Optionales visuelles Feedback** – zeigt welche Gänge noch fehlen

