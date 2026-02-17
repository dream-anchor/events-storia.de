import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

interface DishPickerProps {
  value: { id: string; name: string } | null;
  onSelect: (dish: { id: string; name: string; description: string | null; source: string }) => void;
  onClear?: () => void;
  menuItems: CombinedMenuItem[];
  filterCategories?: string[];
  placeholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
}

export function DishPicker({
  value,
  onSelect,
  onClear,
  menuItems,
  filterCategories,
  placeholder = "Gericht wählen...",
  allowCustom = true,
  disabled = false,
}: DishPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filtere Items nach erlaubten Kategorien
  const filteredItems = useMemo(() => {
    if (!filterCategories || filterCategories.length === 0) return menuItems;
    return menuItems.filter(item =>
      filterCategories.some(cat =>
        item.category_name.toLowerCase().includes(cat.toLowerCase())
      )
    );
  }, [menuItems, filterCategories]);

  // Gruppiere nach Source
  const grouped = useMemo(() => {
    const catering = filteredItems.filter(i => i.source === 'catering');
    const ristorante = filteredItems.filter(i => i.source === 'ristorante');
    return { catering, ristorante };
  }, [filteredItems]);

  const handleSelect = (item: CombinedMenuItem) => {
    onSelect({
      id: item.id,
      name: item.name,
      description: item.description,
      source: item.source,
    });
    setOpen(false);
    setSearch("");
  };

  const handleCustom = () => {
    if (!search.trim()) return;
    onSelect({
      id: `custom_${Date.now()}`,
      name: search.trim(),
      description: null,
      source: 'custom',
    });
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal h-9 rounded-xl",
            "min-w-[200px] max-w-full",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {value ? value.name : placeholder}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && onClear && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Suchen..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustom && search.trim() ? (
                <button
                  onClick={handleCustom}
                  className="flex items-center gap-2 w-full px-2 py-2 text-sm text-left hover:bg-accent rounded-sm"
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <span>"{search}" als Freitext hinzufügen</span>
                </button>
              ) : (
                <span>Kein Gericht gefunden.</span>
              )}
            </CommandEmpty>

            {grouped.catering.length > 0 && (
              <CommandGroup heading="Catering">
                {grouped.catering.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.category_name}`}
                    onSelect={() => handleSelect(item)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.id === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm">{item.name}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.price != null && (
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {item.price.toFixed(2)} €
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {grouped.catering.length > 0 && grouped.ristorante.length > 0 && (
              <CommandSeparator />
            )}

            {grouped.ristorante.length > 0 && (
              <CommandGroup heading="Ristorante">
                {grouped.ristorante.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.category_name}`}
                    onSelect={() => handleSelect(item)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.id === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm">{item.name}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.price != null && (
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {item.price.toFixed(2)} €
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {allowCustom && search.trim() && (filteredItems.length > 0) && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleCustom}>
                    <Plus className="mr-2 h-4 w-4 text-primary" />
                    <span>"{search}" als Freitext</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
