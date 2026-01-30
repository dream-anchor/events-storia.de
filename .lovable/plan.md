
# StoriaMaestro Premium UI Framework

## Übersicht: Von "Verwaltungstool" zu "Premium-App"

Das Ziel ist ein durchgängig helles, elegantes Interface im Apple-Stil, das Komplexität durch visuelle Einfachheit versteckt. Der Nutzer soll sich wie in einer Premium-App fühlen, nicht in einem Verwaltungstool.

---

## Phase 1: Dependencies & Foundation

### Neue Abhängigkeit: framer-motion
```bash
npm install framer-motion
```

Framer Motion ist die Kern-Bibliothek für:
- List Stagger (Items erscheinen nacheinander)
- Hover/Tap Feedback
- Page Transitions
- Swipe-to-Action Gesten

---

## Phase 2: Visuelle Sprache überarbeiten

### 2.1 Farbpalette: Amber/Gold als Akzent

**Datei: `src/index.css`**

Das aktuelle Blau (`221 83% 53%`) wird durch Amber/Gold ersetzt – ein warmer, einladender Akzent, der Professionalität ausstrahlt:

```css
.admin-layout {
  /* Strikte Light-Mode Durchsetzung */
  --background: 0 0% 99%;           /* Fast reines Weiß */
  --foreground: 222 47% 11%;        /* Tiefes Slate */
  --card: 0 0% 100%;                /* Reines Weiß für Cards */
  --card-foreground: 222 47% 11%;
  
  /* Amber/Gold Akzent statt Blau */
  --primary: 38 92% 50%;            /* Amber-500 */
  --primary-foreground: 26 83% 14%; /* Amber-950 */
  --accent: 38 92% 50%;
  
  /* Weichere Borders */
  --border: 220 13% 93%;            /* Noch heller */
  --input: 220 13% 93%;
  --ring: 38 92% 50%;               /* Amber Focus Ring */
  
  /* Größerer Radius für alle Elemente */
  --radius: 1rem;                   /* 16px = rounded-2xl */
}
```

### 2.2 Glassmorphism Utility

**Datei: `src/index.css`**

Neue CSS-Klasse für glasartige Oberflächen:

```css
.admin-layout .glass-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.08);
}

.admin-layout .glass-header {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}
```

### 2.3 Ecken: rounded-2xl überall

Alle Buttons, Cards, Modals und Inputs erhalten `rounded-2xl` (16px):

**Datei: `src/components/ui/button.tsx`**

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium ...",
  // ... Rest bleibt gleich
);
```

**Datei: `src/components/ui/card.tsx`**

```tsx
const Card = React.forwardRef<...>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      "rounded-2xl border bg-card text-card-foreground shadow-sm",
      className
    )} 
    {...props} 
  />
));
```

---

## Phase 3: Motion Design mit framer-motion

### 3.1 Neue Komponente: MotionCard

**Datei: `src/components/admin/motion/MotionCard.tsx` (neu)**

```tsx
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  index?: number;
}

export const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  ({ className, index = 0, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ 
          duration: 0.3,
          delay: index * 0.05,
          ease: [0.25, 0.1, 0.25, 1]
        }}
        whileHover={{ 
          y: -4, 
          scale: 1.02,
          boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.15)"
        }}
        whileTap={{ scale: 0.98 }}
        {...props}
      >
        <Card className={cn("cursor-pointer transition-shadow", className)}>
          {children}
        </Card>
      </motion.div>
    );
  }
);
```

### 3.2 List Stagger Pattern

**Datei: `src/components/admin/motion/StaggerList.tsx` (neu)**

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface StaggerListProps {
  children: ReactNode[];
}

export const StaggerList = ({ children }: StaggerListProps) => {
  return (
    <AnimatePresence mode="popLayout">
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ delay: index * 0.05 }}
        >
          {child}
        </motion.div>
      ))}
    </AnimatePresence>
  );
};
```

### 3.3 Page Transitions

**Datei: `src/components/admin/motion/PageTransition.tsx` (neu)**

```tsx
import { motion } from "framer-motion";
import { ReactNode } from "react";

export const PageTransition = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
```

---

## Phase 4: Mobile-First PWA Patterns

### 4.1 BottomNav mit Safe-Area

**Datei: `src/components/admin/refine/FloatingPillNav.tsx`**

Update der `MobileBottomNav`:

```tsx
export const MobileBottomNav = ({ getBadgeCount }: Props) => {
  return (
    <motion.nav 
      className="fixed bottom-0 inset-x-0 z-50 md:hidden glass-header"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 20 }}
    >
      <div className="grid grid-cols-3 h-16">
        {items.map((item) => (
          <motion.div
            key={item.key}
            whileTap={{ scale: 0.9 }}
          >
            <Link to={item.href} className="...">
              {/* ... */}
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.nav>
  );
};
```

### 4.2 Touch Targets: Mindestens 44x44px

**Datei: `src/index.css`**

```css
/* Touch-optimierte Targets */
.admin-layout button,
.admin-layout [role="button"],
.admin-layout a {
  min-height: 44px;
  min-width: 44px;
}

.admin-layout .action-button {
  min-height: 48px;
  padding-inline: 1.25rem;
}
```

### 4.3 Responsive Dialogs: Modal → Bottom Sheet

**Datei: `src/components/admin/motion/ResponsiveDialog.tsx` (neu)**

```tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReactNode } from "react";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export const ResponsiveDialog = ({ 
  open, 
  onOpenChange, 
  children 
}: ResponsiveDialogProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="rounded-t-2xl">
          {children}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        {children}
      </DialogContent>
    </Dialog>
  );
};
```

---

## Phase 5: Interaktions-Patterns

### 5.1 SwipeableCard für Listen

**Datei: `src/components/admin/motion/SwipeableCard.tsx` (neu)**

```tsx
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ReactNode, useState } from "react";
import { Trash2 } from "lucide-react";

interface SwipeableCardProps {
  children: ReactNode;
  onDelete?: () => void;
  onArchive?: () => void;
}

export const SwipeableCard = ({ 
  children, 
  onDelete,
  onArchive 
}: SwipeableCardProps) => {
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-150, 0, 150],
    ["#ef4444", "#ffffff", "#22c55e"]
  );
  const opacity = useTransform(x, [-150, 0, 150], [1, 0, 1]);
  
  const handleDragEnd = (event: MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.x < -100) {
      onDelete?.();
    } else if (info.offset.x > 100) {
      onArchive?.();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete Action (links) */}
      <motion.div 
        className="absolute inset-y-0 left-0 w-24 flex items-center justify-center bg-red-500"
        style={{ opacity }}
      >
        <Trash2 className="h-5 w-5 text-white" />
      </motion.div>
      
      {/* Archive Action (rechts) */}
      <motion.div 
        className="absolute inset-y-0 right-0 w-24 flex items-center justify-center bg-green-500"
        style={{ opacity }}
      >
        <CheckCircle2 className="h-5 w-5 text-white" />
      </motion.div>
      
      {/* Swipeable Content */}
      <motion.div
        style={{ x, background }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-card rounded-2xl touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};
```

### 5.2 Floating Action Bar bei Mehrfachauswahl

**Datei: `src/components/admin/motion/FloatingActionBar.tsx` (neu)**

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trash2, Archive, Mail, X } from "lucide-react";

interface FloatingActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onEmail?: () => void;
}

export const FloatingActionBar = ({
  selectedCount,
  onClear,
  onDelete,
  onArchive,
  onEmail,
}: FloatingActionBarProps) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40"
        >
          <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl">
            <span className="text-sm font-medium">
              {selectedCount} ausgewählt
            </span>
            
            <div className="flex items-center gap-1">
              {onEmail && (
                <Button size="sm" variant="ghost" onClick={onEmail}>
                  <Mail className="h-4 w-4" />
                </Button>
              )}
              {onArchive && (
                <Button size="sm" variant="ghost" onClick={onArchive}>
                  <Archive className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button size="sm" variant="ghost" className="text-red-500" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Button size="sm" variant="ghost" onClick={onClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

### 5.3 Direct Selection (Klick = Auswahl)

Das InboxItem und DataTable-Rows werden so angepasst, dass ein einfacher Klick sofort auswählt (kein separater Checkbox-Klick nötig).

---

## Phase 6: Light-Mode Enforcement

**Datei: `src/index.css`**

```css
/* Strikte Light-Mode Durchsetzung im Admin */
.admin-layout,
.admin-layout * {
  color-scheme: light !important;
}

/* Override für alle Radix UI Popover/Dropdowns */
[data-radix-popper-content-wrapper] {
  z-index: 10001 !important;
}

.admin-layout [role="menu"],
.admin-layout [role="dialog"],
.admin-layout [role="listbox"] {
  background-color: #ffffff !important;
  color: #111827 !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
}
```

**Datei: `src/components/admin/refine/AdminLayout.tsx`**

Entfernung des Dark-Mode-Toggles und forcierter Light-Mode:

```tsx
// Dark Mode Toggle entfernen
// useTheme und Theme-Toggle werden nicht mehr benötigt

return (
  <div className="min-h-screen admin-layout admin-light-mode">
    {/* ... */}
  </div>
);
```

---

## Phase 7: Dashboard Redesign

**Datei: `src/components/admin/refine/Dashboard.tsx`**

Integration aller neuen Patterns:

```tsx
import { motion } from "framer-motion";
import { MotionCard } from "@/components/admin/motion/MotionCard";
import { PageTransition } from "@/components/admin/motion/PageTransition";

export const Dashboard = () => {
  // ... existing hooks
  
  return (
    <AdminLayout activeTab="dashboard">
      <PageTransition>
        <div className="space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between"
          >
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                StoriaMaestro
              </h1>
              <p className="text-base text-muted-foreground">
                Willkommen im Event- & Catering-Management
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="rounded-2xl shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                Neue Anfrage
              </Button>
            </motion.div>
          </motion.div>

          {/* Stats Cards mit Stagger */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <MotionCard key={stat.id} index={index}>
                <CardHeader>...</CardHeader>
                <CardContent>...</CardContent>
              </MotionCard>
            ))}
          </div>
          
          {/* ... */}
        </div>
      </PageTransition>
    </AdminLayout>
  );
};
```

---

## Phase 8: Header Redesign mit Glassmorphism

**Datei: `src/components/admin/refine/AdminLayout.tsx`**

```tsx
<header className="sticky top-0 z-50 glass-header">
  <div className="container mx-auto px-4 py-3">
    <div className="flex items-center justify-between gap-4">
      {/* Logo mit subtle Animation */}
      <motion.div whileHover={{ scale: 1.02 }}>
        <Link to="/admin" className="flex items-center gap-3">
          <img src={storiaLogo} alt="STORIA" className="h-7" />
        </Link>
      </motion.div>
      
      {/* Navigation mit Animation */}
      <FloatingPillNav activeKey={activeTab} getBadgeCount={getBadgeCount} />
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button variant="outline" size="sm" className="rounded-2xl">
            <Command className="h-3.5 w-3.5 mr-1" />
            ⌘K
          </Button>
        </motion.div>
        {/* ... weitere Actions */}
      </div>
    </div>
  </div>
</header>
```

---

## Zusammenfassung der Änderungen

| Komponente | Vorher | Nachher |
|------------|--------|---------|
| **Motion Library** | Nur CSS Transitions | framer-motion |
| **Border Radius** | rounded-xl (12px) | rounded-2xl (16px) |
| **Primary Color** | Blau | Amber/Gold |
| **Dark Mode** | Toggle vorhanden | Strikt Light Mode |
| **Card Hover** | CSS translate-y | Framer Scale + Shadow |
| **List Animation** | Sofort sichtbar | Stagger Effect |
| **Mobile Dialogs** | Standard Modals | Bottom Sheets (Drawer) |
| **Swipe Actions** | Nicht vorhanden | SwipeableCard |
| **Multi-Select** | Checkboxen | Direct Click + Floating Bar |
| **Header Style** | backdrop-blur-xl | Glassmorphism class |

---

## Betroffene Dateien

### Neue Dateien
1. `src/components/admin/motion/MotionCard.tsx`
2. `src/components/admin/motion/StaggerList.tsx`
3. `src/components/admin/motion/PageTransition.tsx`
4. `src/components/admin/motion/SwipeableCard.tsx`
5. `src/components/admin/motion/FloatingActionBar.tsx`
6. `src/components/admin/motion/ResponsiveDialog.tsx`
7. `src/components/admin/motion/index.ts` (Barrel Export)

### Zu ändernde Dateien
1. `package.json` → framer-motion hinzufügen
2. `src/index.css` → Glassmorphism, Light-Mode, Amber Palette
3. `src/components/ui/button.tsx` → rounded-2xl
4. `src/components/ui/card.tsx` → rounded-2xl
5. `src/components/admin/refine/AdminLayout.tsx` → Glass Header, Light Mode
6. `src/components/admin/refine/Dashboard.tsx` → Motion Integration
7. `src/components/admin/refine/FloatingPillNav.tsx` → Motion + Safe Area
8. `src/components/admin/refine/DataTable.tsx` → rounded-2xl, Motion Rows
9. `src/components/admin/inbox/InboxItem.tsx` → SwipeableCard
10. `src/components/ui/drawer.tsx` → rounded-2xl für Bottom Sheet

---

## Implementierungs-Reihenfolge

1. **Foundation**: framer-motion installieren, CSS Utilities
2. **Visual**: Amber Palette, rounded-2xl, Glassmorphism
3. **Motion Components**: MotionCard, StaggerList, PageTransition
4. **Interaktionen**: SwipeableCard, FloatingActionBar
5. **Layout**: AdminLayout, BottomNav, Header
6. **Integration**: Dashboard, DataTable, Inbox
