

## Spatial Design & Apple HIG 2026 Optimierung

### Design-Prinzipien für diese Überarbeitung

1. **Visuelle Hierarchie** – Klare Abstufung von Primär → Sekundär → Tertiär
2. **Massiver Whitespace** – Mehr Luft zwischen Elementen, weniger Dichte
3. **Subtile Tiefe (Glassmorphism)** – Sanfte Schatten, Blur-Effekte für Layer-Trennung
4. **Progressive Disclosure** – Komplexität verstecken, nur Relevantes zeigen
5. **Haptisches Feedback** – Micro-Interactions bei jeder Aktion

---

### Konkrete Änderungen

#### 1. Design-Tokens erweitern (index.css)

**Neue CSS-Variablen für Spatial Design:**

```css
.admin-layout {
  /* Erweiterte Spacing-Tokens für großzügigeren Whitespace */
  --space-section: 3rem;      /* 48px zwischen großen Sektionen */
  --space-group: 2rem;        /* 32px innerhalb von Gruppen */
  --space-element: 1.5rem;    /* 24px zwischen Elementen */
  
  /* Tiefe/Elevation-Tokens */
  --shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.03);
  --shadow-card: 0 4px 12px -2px rgba(0, 0, 0, 0.06);
  --shadow-elevated: 0 8px 32px -4px rgba(0, 0, 0, 0.1);
  --shadow-floating: 0 16px 48px -8px rgba(0, 0, 0, 0.12);
  
  /* Glassmorphism-Stufen */
  --glass-light: rgba(255, 255, 255, 0.6);
  --glass-medium: rgba(255, 255, 255, 0.75);
  --glass-strong: rgba(255, 255, 255, 0.9);
}
```

#### 2. Card-Komponente: Mehr Tiefe & Spacing (card.tsx)

**Vorher:**
```tsx
className="rounded-2xl border bg-card text-card-foreground shadow-sm"
```

**Nachher:**
```tsx
className="rounded-2xl border border-border/40 bg-card text-card-foreground shadow-[var(--shadow-card)]"
```

**CardHeader & CardContent mit mehr Padding:**
- CardHeader: `p-6` → `p-8`
- CardContent: `p-6 pt-0` → `p-8 pt-0`

#### 3. Dashboard: Spatial Layout (Dashboard.tsx)

**Verbesserungen:**

a) **Sektionsabstände vergrößern:**
```tsx
// Von: space-y-8
// Zu: space-y-12 (48px statt 32px)
<div className="space-y-12">
```

b) **Stat-Cards mit subtilerem Hover-Effekt:**
```tsx
// MotionCard Anpassung: sanftere Animation
whileHover={{ 
  y: -2,           // Reduziert von -4
  scale: 1.01,     // Reduziert von 1.02
  boxShadow: "var(--shadow-elevated)"
}}
```

c) **Drei-Spalten-Layout: Mehr Lücke zwischen Cards:**
```tsx
// Von: gap-6
// Zu: gap-8
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
```

d) **Progressive Disclosure: Leere States subtiler:**
```tsx
// Leerer State mit weniger visueller Präsenz
<p className="text-sm text-muted-foreground/60 text-center py-8">
  Keine neuen Anfragen
</p>
```

#### 4. OfferOptionCard: Klarere Hierarchie (OfferOptionCard.tsx)

**Verbesserungen:**

a) **Option-Label größer und prominenter:**
```tsx
// Von: w-11 h-11 text-lg
// Zu: w-14 h-14 text-xl (mehr visuelle Anker)
<div className="w-14 h-14 rounded-full flex items-center justify-center font-semibold text-xl">
```

b) **Pricing-Section mit Tiefenebene:**
```tsx
// Mehr Innenabstand, subtilerer Hintergrund
<div className="p-5 rounded-2xl bg-muted/20 border border-border/30 shadow-[var(--shadow-subtle)]">
```

c) **Menü-Konfiguration: Collapsed by default (Progressive Disclosure):**
```tsx
// Zeigt nur Zusammenfassung, Details auf Klick
{!showMenuEditor && hasMenuConfig && (
  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/10">
    <span className="text-sm">{configuredCourses} Gänge, {configuredDrinks} Getränke</span>
    <Button variant="ghost" size="sm">Details</Button>
  </div>
)}
```

#### 5. MultiOfferComposer: Fokus-Flow (MultiOfferComposer.tsx)

**Verbesserungen:**

a) **Header mit mehr Breathing Room:**
```tsx
// Von: space-y-8
// Zu: space-y-10
<div className="space-y-10">
```

b) **Summary-Card: Floating-Effekt für CTA:**
```tsx
<Card className="bg-card/80 backdrop-blur-xl border-border/30 shadow-[var(--shadow-elevated)]">
```

c) **Email-Draft: Sanftes Einblenden:**
```tsx
{emailDraft && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
  >
    <Card>...</Card>
  </motion.div>
)}
```

#### 6. FloatingPillNav: Mehr Tiefe (FloatingPillNav.tsx)

**Verbesserungen:**

a) **Nav-Container mit stärkerem Glass-Effekt:**
```tsx
// Von: glass-card rounded-2xl shadow-lg shadow-slate-200/40
// Zu: Mehr Blur, subtilerer Schatten
className="p-2 bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[var(--shadow-floating)] border border-white/50"
```

b) **Nav-Items mit größeren Touch-Targets:**
```tsx
// Von: px-4 py-2.5 rounded-xl
// Zu: px-5 py-3 rounded-2xl (mehr Polster)
className="px-5 py-3 rounded-2xl text-sm font-medium"
```

#### 7. MotionCard: Subtilere Animationen (MotionCard.tsx)

**Apple-typische, zurückhaltende Micro-Interactions:**

```tsx
whileHover={{ 
  y: -2,                    // Sanfter als -4
  scale: 1.005,             // Fast unmerklich
  boxShadow: "0 12px 24px -8px rgba(0, 0, 0, 0.1)"
}}
whileTap={{ scale: 0.995 }} // Subtiles Feedback
transition={{ 
  type: "spring",
  stiffness: 400,           // Schnellere Reaktion
  damping: 30               // Weniger Bouncing
}}
```

#### 8. Utility-Klassen hinzufügen (index.css)

**Neue Spatial-Utilities:**

```css
/* Spatial Design Utilities */
.admin-layout .section-spacing {
  padding-block: var(--space-section);
}

.admin-layout .group-spacing {
  gap: var(--space-group);
}

.admin-layout .element-spacing {
  gap: var(--space-element);
}

/* Elevated Card Variant */
.admin-layout .card-elevated {
  box-shadow: var(--shadow-elevated);
  border-color: transparent;
}

/* Focus States - Haptisches Feedback */
.admin-layout button:focus-visible,
.admin-layout [role="button"]:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
  transition: outline-offset 0.1s ease;
}

.admin-layout button:active,
.admin-layout [role="button"]:active {
  transform: scale(0.98);
}
```

---

### Dateien, die geändert werden

| Datei | Änderungen |
|-------|------------|
| `src/index.css` | Neue Design-Tokens, Utilities |
| `src/components/ui/card.tsx` | Erhöhtes Padding, subtilere Shadows |
| `src/components/admin/motion/MotionCard.tsx` | Sanftere Hover-Animationen |
| `src/components/admin/refine/Dashboard.tsx` | Mehr Whitespace, größere Abstände |
| `src/components/admin/refine/FloatingPillNav.tsx` | Stärkerer Glass-Effekt |
| `src/components/admin/refine/InquiryEditor/MultiOffer/OfferOptionCard.tsx` | Klarere Hierarchie |
| `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx` | Besserer Flow |

---

### Erwartetes Ergebnis

- **Mehr Ruhe** durch großzügigen Whitespace
- **Klarere Fokus-Punkte** durch visuelle Hierarchie
- **Premium-Gefühl** durch subtile Tiefe und Glassmorphism
- **Bessere Touch-Targets** auf Mobile
- **Sanfteres Feedback** bei allen Interaktionen

