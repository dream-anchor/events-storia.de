import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, CalendarDays, FileText, Package, 
  UtensilsCrossed, Search, Plus, ArrowRight 
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate();

  const handleSelect = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Suche nach Seiten, Events, Bestellungen..." />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect('/admin')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/events')}>
            <CalendarDays className="mr-2 h-4 w-4" />
            <span>Events</span>
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/orders')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Bestellungen</span>
            <CommandShortcut>⌘O</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/packages')}>
            <Package className="mr-2 h-4 w-4" />
            <span>Pakete</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/menu')}>
            <UtensilsCrossed className="mr-2 h-4 w-4" />
            <span>Speisen & Getränke</span>
            <CommandShortcut>⌘M</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Schnellaktionen">
          <CommandItem onSelect={() => handleSelect('/admin/packages/create')}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Neues Paket erstellen</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/locations/create')}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Neue Location erstellen</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Extern">
          <CommandItem onSelect={() => window.open('/', '_blank')}>
            <ArrowRight className="mr-2 h-4 w-4" />
            <span>Webseite öffnen</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

// Hook for global keyboard shortcut
export const useCommandPalette = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
};