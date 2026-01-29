
# Plan: Locations-Tab aus dem Frontend entfernen

## Übersicht

Der "Locations"-Tab wird aus der öffentlichen Events-Seite (`/events`) entfernt. Die Location-Verwaltung bleibt vollständig im Admin-Bereich (StoriaMaestro) für interne Zuordnungen (z.B. Paket-Location-Mapping, Event-Buchungen) erhalten.

---

## Änderungen

### 1. `src/pages/catering/EventsImStoria.tsx`

**Import entfernen:**
```typescript
// Zeile 8 entfernen:
import EventLocationCard from "@/components/events/EventLocationCard";

// Zeile 101 – Hook-Aufruf entfernen:
const { data: locations, isLoading: locationsLoading } = useEventLocations();
```

**Tabs auf Single-Content umstellen:**

Die gesamte Tab-Struktur wird vereinfacht – statt Tabs nur noch die Pakete-Sektion anzeigen:

```text
VORHER (Zeilen 308-398):
├── Tabs (packages | locations)
│   ├── TabsList mit 2 Tabs
│   ├── TabsContent "packages" → Pakete-Grid
│   └── TabsContent "locations" → Locations-Grid

NACHHER:
└── Nur Pakete-Grid (ohne Tabs-Wrapper)
```

**Konkrete Zeilen:**

| Zeile | Aktion |
|-------|--------|
| 8 | `EventLocationCard` Import löschen |
| 18 | `TabsContent, TabsList, TabsTrigger` aus Import entfernen (nur `Tabs` wird nicht mehr benötigt) |
| 101 | `useEventLocations()` Hook-Aufruf löschen |
| 308-318 | Tabs-Wrapper + TabsList komplett entfernen |
| 320 | `TabsContent value="packages"` öffnend → entfernen |
| 381 | `</TabsContent>` schließend → entfernen |
| 383-397 | Kompletter `TabsContent value="locations"` Block löschen |
| 398 | Schließendes `</Tabs>` entfernen |

---

## Was bleibt unverändert

| Komponente | Status |
|------------|--------|
| `src/components/events/EventLocationCard.tsx` | Bleibt (könnte später für Admin-Preview genutzt werden) |
| `src/hooks/useEventPackages.ts` (`useEventLocations`) | Bleibt (wird im Admin verwendet) |
| `src/components/admin/refine/LocationEdit.tsx` | Unverändert |
| `src/components/admin/refine/PackagesList.tsx` | Unverändert (Package-Location-Mapping) |
| `locations` Datenbanktabelle | Unverändert |

---

## Ergebnis

Die Events-Seite zeigt nur noch die buchbaren Pakete ohne Tab-Navigation. Die "Max. Gäste: 180" Zahl im Trust-Bar bleibt als statische Information erhalten – sie stammt nicht aus den Locations-Daten.

```text
Frontend (/events):
├── Hero
├── Trust Bar (statisch: 180 Max. Gäste)
├── Pakete-Grid (ohne Tabs)
├── Galerie
└── Kontaktformular

Admin (StoriaMaestro):
├── Locations verwalten ✓
├── Pakete → Locations zuordnen ✓
└── Event-Buchungen → Location auswählen ✓
```
