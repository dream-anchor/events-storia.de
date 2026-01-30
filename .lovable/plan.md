
## Farbschema-Standardisierung: Nur Orange/Amber

### Problem
An verschiedenen Stellen im Admin-Bereich wurden rote Farben eingeführt (sichtbar in den Screenshots):
- **Logout-Button** "Abmelden" mit rotem Text und Icon
- **Status-Badges** für "Abgelehnt" und "Storniert" 
- **Warn-Hinweise** und **Lösch-Dialoge**

Dies widerspricht dem Premium UI Framework 2026, das Amber/Gold als Akzentfarbe definiert.

### Design-Lösung
Beschränkung auf **eine Akzentfarbe: Amber/Orange** mit Varianten durch:
- Unterschiedliche Transparenzstufen (`amber-500/10`, `amber-500/20`, etc.)
- Unterschiedliche Helligkeitsstufen (`amber-400`, `amber-500`, `amber-600`, `amber-700`)
- Unterschiedliche Hintergründe (`bg-amber-50`, `bg-amber-100`)

### Betroffene Dateien und Änderungen

#### 1. UserProfileDropdown.tsx
**Zeile 306** - Logout-Button von Rot auf dezentes Grau/Neutral:
```tsx
// Von:
className="text-destructive focus:text-destructive focus:bg-destructive/10"
// Zu:
className="text-foreground focus:text-foreground focus:bg-accent/10"
```
**Zeilen 219, 269** - Cancel-Buttons: `hover:text-destructive` → `hover:text-muted-foreground`

#### 2. Dashboard.tsx
**Zeilen 153-157** - Neue-Anfragen-Card von Rot auf Amber:
```tsx
// Von:
border-l-destructive/50, text-destructive/70
// Zu:
border-l-amber-500/50, text-amber-600
```

#### 3. EventsList.tsx
**Zeilen 129-134** - Status-Badges für "Abgelehnt" und "Neu":
```tsx
// Von:
'border-destructive/50 text-destructive bg-destructive/10'
// Zu (Abgelehnt):
'border-muted-foreground/50 text-muted-foreground bg-muted'
// Oder Amber-Variante für "Neu":
'border-amber-500/50 text-amber-700 bg-amber-50'
```

#### 4. CateringOrdersManager.tsx
**Zeile 21** - Storniert-Status:
```tsx
// Von:
cancelled: { label: "Storniert", color: "text-red-700", bg: "bg-red-100" }
// Zu:
cancelled: { label: "Storniert", color: "text-muted-foreground", bg: "bg-muted" }
```

#### 5. EventInquiriesManager.tsx
**Zeile 21** - Abgelehnt-Status:
```tsx
// Von:
declined: { label: "Abgelehnt", color: "text-red-700", bg: "bg-red-100" }
// Zu:
declined: { label: "Abgelehnt", color: "text-muted-foreground", bg: "bg-muted" }
```

#### 6. OfferOptionCard.tsx
**Zeile 145** - X-Button:
```tsx
// Von:
hover:text-destructive
// Zu:
hover:text-amber-600
```

#### 7. CateringOrderEditor.tsx
**Zeilen 225-230** - Storniert-Notice:
```tsx
// Von:
border-destructive/50, bg-destructive/5, text-destructive
// Zu:
border-muted-foreground/30, bg-muted/50, text-muted-foreground
```

#### 8. PackageEdit.tsx
**Zeile 535** - Entfernen-Button:
```tsx
// Von:
hover:text-destructive
// Zu:
hover:text-amber-600
```

#### 9. EventModules.tsx
**Zeilen 358-359** - Minimum-Warnung:
```tsx
// Von:
text-destructive
// Zu:
text-amber-600
```

### Farb-Richtlinie (nach Umsetzung)

| Verwendung | Farbe |
|------------|-------|
| Primär-Akzent | `amber-500` |
| Hover auf Buttons | `amber-600` |
| Text-Warnung | `amber-600` / `amber-700` |
| Leichte Hintergründe | `amber-50` / `amber-100` |
| Borders | `amber-500/50` |
| Deaktiviert/Abgelehnt | `muted-foreground` + `bg-muted` |
| Logout/Neutral-Action | `text-foreground` (kein Rot) |

### Lösch-Dialoge bleiben unverändert
Die `AlertDialogAction` für echte Lösch-Vorgänge kann als einzige Ausnahme `destructive` behalten, da Löschen eine unwiderrufliche Aktion ist. Alternativ auch hier auf Amber umstellen.

### Zusammenfassung
9 Dateien werden angepasst, um alle roten Farben durch Amber-Töne oder neutrale Grautöne zu ersetzen. Das Ergebnis ist ein konsistentes, warmes Farbschema im gesamten Admin-Bereich.
