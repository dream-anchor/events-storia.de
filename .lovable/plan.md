
# Plan: Benutzer-Dropdown im Admin Header

## Aktuelle Situation

Der Admin-Header zeigt derzeit:
- Name/E-Mail als statischen Text
- Separaten "Webseite" Link
- Separaten Logout-Button

## Gewünschte Änderung

1. **Entfernen**: "Webseite" Link oben rechts
2. **Neues Benutzer-Dropdown** mit:
   - Klickbarer Avatar mit Initialen
   - Im Dropdown: Name, E-Mail, Logout-Button
   - Alles in einem modernen 2026-Style

## Design

```text
┌─────────────────────────────────────────────────────────────┐
│  StoriaMaestro    [ Events | Buchungen | Catering ]   [⌘K] │
│                                                        [DS]◀─┐
└─────────────────────────────────────────────────────────────┘
                                                               │
                    ┌──────────────────────────────────────────┘
                    │
                    ▼
         ┌─────────────────────────────┐
         │  ┌────┐                     │
         │  │ DS │  Domenico Speranza  │
         │  └────┘  mimmo2905@yahoo.de │
         │  ─────────────────────────  │
         │  🚪 Abmelden                │
         └─────────────────────────────┘
```

## Technische Umsetzung

### Datei: `src/components/admin/refine/AdminLayout.tsx`

**Zu entfernende Elemente** (Zeilen 71-89):
- Statischer Name/E-Mail Text
- "Webseite" Button mit Link
- Separater Logout-Button

**Neues Element**: Benutzer-Dropdown mit DropdownMenu

```tsx
// Import hinzufügen
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown } from "lucide-react";

// Initialen-Berechnung
const getInitials = (name?: string) => {
  if (!name) return 'A';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Neues Dropdown im Right Actions Bereich
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button 
      variant="ghost" 
      className="flex items-center gap-2 rounded-2xl px-2"
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
          {getInitials(identity?.name)}
        </AvatarFallback>
      </Avatar>
      <span className="hidden lg:block text-sm font-medium max-w-[120px] truncate">
        {identity?.name}
      </span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-64">
    <DropdownMenuLabel className="font-normal">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(identity?.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-medium">{identity?.name}</span>
          <span className="text-xs text-muted-foreground">
            {identity?.email}
          </span>
        </div>
      </div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem 
      onClick={() => logout()}
      className="text-destructive focus:text-destructive cursor-pointer"
    >
      <LogOut className="h-4 w-4 mr-2" />
      Abmelden
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Ergebnis

- Cleaner Header ohne unnötigen "Webseite" Link
- Modernes Benutzer-Dropdown mit Avatar, Name und E-Mail
- Logout-Funktion integriert im Dropdown
- State-of-the-Art 2026 Design mit Glassmorphism-Stil
