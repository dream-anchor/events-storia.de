
# StoriaMaestro Visual Redesign 2026

## Analyse: Aktuelle Problemstellen

### 1. Typografie wirkt "Windows-like"
- **Cormorant Garamond** (Serifenschrift) wird für alle Überschriften im Admin verwendet
- Diese verschnörkelte, dekorative Schrift passt zum Frontend (Restaurant-Flair), aber wirkt im Backend altmodisch und schwer lesbar
- Beispiel: `text-4xl font-serif font-semibold` für Dashboard-Titel

### 2. Farbschema zu warm/rustikal
- Die primäre Farbe (`--primary: 358 65% 35%`) ist ein warmes Rot/Bordeaux - passend für Restaurant, aber nicht für ein modernes Admin-Tool
- Hintergrund (`bg-muted/30`) und Cards wirken wie ein altes ERP-System

### 3. Fehlende "State of the Art" Elemente
- Keine Subtle Gradients oder moderne Shadows
- Keine visuellen Hierarchien durch Tiefe
- Standard-Borders statt weiche, moderne Übergänge

---

## Lösung: Maestro Design System

### Design-Philosophie
Ein **professionelles Maestro-System** für Event & Catering Management:
- **Klarheit**: Sans-Serif-Typografie für alle Texte
- **Tiefe**: Layered UI mit subtilen Shadows und Glassmorphism
- **Monochrom**: Neutrales Slate/Zinc-Farbschema mit einem dezenten Akzent
- **2026 Ästhetik**: Große Weißräume, weiche Ecken, Micro-Interactions

---

## Technische Änderungen

### Phase 1: Admin-spezifisches Farbschema

**Datei: `src/index.css`**

Neues Admin-Theme mit eigenen CSS-Variablen:

```css
/* Admin-specific modern theme */
.admin-layout {
  --background: 220 14% 96%;      /* Cool neutral gray */
  --foreground: 224 71% 4%;       /* Near black */
  --card: 0 0% 100%;              /* Pure white cards */
  --muted: 220 14% 92%;           /* Subtle gray */
  --muted-foreground: 220 9% 46%;
  --primary: 221 83% 53%;         /* Professional blue accent */
  --primary-foreground: 0 0% 100%;
  --border: 220 13% 91%;
  --ring: 221 83% 53%;
}

.admin-layout.dark {
  --background: 224 71% 4%;
  --foreground: 210 20% 98%;
  --card: 222 47% 11%;
  --muted: 215 28% 17%;
  --muted-foreground: 217 10% 64%;
  --primary: 217 91% 60%;
  --border: 215 28% 17%;
}
```

### Phase 2: Typografie modernisieren

**Datei: `src/index.css`**

Admin-spezifische Typografie-Overrides:

```css
.admin-layout {
  font-family: 'Inter', system-ui, sans-serif;
}

.admin-layout h1,
.admin-layout h2,
.admin-layout h3 {
  @apply font-sans font-semibold tracking-tight;
}
```

### Phase 3: AdminLayout modernisieren

**Datei: `src/components/admin/refine/AdminLayout.tsx`**

Änderungen:
- Hintergrund von `bg-muted/30` zu einem subtilen Gradient
- Header mit mehr Tiefe und modernem Look
- Weichere Shadows und Borders

```tsx
// Hauptcontainer mit modernem Background
<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 admin-layout">

// Header mit mehr Tiefe
<header className="sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
```

### Phase 4: Dashboard-Header

**Datei: `src/components/admin/refine/Dashboard.tsx`**

Von dekorativ zu modern:

```tsx
// ALT: Verschnörkelt
<h1 className="text-4xl font-serif font-semibold">StoriaMaestro</h1>

// NEU: Clean & Modern
<h1 className="text-3xl font-semibold tracking-tight">StoriaMaestro</h1>
```

### Phase 5: Stat-Cards mit Tiefe

**Datei: `src/components/admin/refine/Dashboard.tsx`**

Moderne Card-Styles mit Hover-Effekten:

```tsx
<Card className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-slate-200/60 dark:border-slate-800/60">
```

### Phase 6: FloatingPillNav modernisieren

**Datei: `src/components/admin/refine/FloatingPillNav.tsx`**

Subtilere, modernere Navigation:

```tsx
<nav className="hidden md:flex items-center gap-0.5 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
```

### Phase 7: DataTable modernisieren

**Datei: `src/components/admin/refine/DataTable.tsx`**

- Weichere Zeilen-Hovers
- Modernere Filter-Pills
- Subtilere Pagination

```tsx
// Modernere Filter Pills
<button
  className={cn(
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all",
    pill.active
      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
  )}
>
```

### Phase 8: Event/Order Listen

Alle Listen-Seiten erhalten den modernen Header-Style:

```tsx
// EventsList.tsx, OrdersList.tsx, etc.
<h1 className="text-2xl font-semibold tracking-tight">Event-Anfragen</h1>
```

---

## Zusammenfassung der Änderungen

| Bereich | Alt | Neu |
|---------|-----|-----|
| **Schrift Headings** | Cormorant Garamond (Serif) | Inter (Sans-Serif) |
| **Primary Color** | Bordeaux-Rot | Professionelles Blau |
| **Background** | Warmes Beige | Kühles Slate-Gradient |
| **Cards** | Flach, harte Borders | Subtle Shadows, weiche Borders |
| **Navigation** | Standard Pill | Layered Glassmorphism |
| **Interaktionen** | Statisch | Micro-Animations (Hover/Lift) |

---

## Betroffene Dateien

1. `src/index.css` - Admin-spezifische Theme-Variablen
2. `src/components/admin/refine/AdminLayout.tsx` - Layout-Container
3. `src/components/admin/refine/Dashboard.tsx` - Dashboard-Styles
4. `src/components/admin/refine/FloatingPillNav.tsx` - Navigation
5. `src/components/admin/refine/DataTable.tsx` - Tabellen-Styles
6. `src/components/admin/refine/EventsList.tsx` - Listen-Header
7. `src/components/admin/refine/OrdersList.tsx` - Listen-Header
8. `src/components/admin/refine/ContextBar.tsx` - Editor-Header
9. `src/components/admin/refine/SmartInquiryEditor.tsx` - Editor-Styles

---

## Das Frontend bleibt unverändert

Das warme, italienische Restaurant-Design (Cormorant Garamond, Bordeaux-Töne) bleibt für alle kundenorientierten Seiten erhalten. Die Änderungen betreffen **ausschließlich** den Admin-Bereich (`.admin-layout`).
