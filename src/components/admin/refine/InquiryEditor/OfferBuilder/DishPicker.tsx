import { useState, useMemo, useRef, useEffect } from "react";
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
  onSelect: (dish: { id: string; name: string; description: string | null; source: string; price: number | null }) => void;
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
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll nach oben zurücksetzen beim Öffnen
  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = 0;
        }
      });
    }
  }, [open]);

  // Filtere Items nach erlaubten Kategorien
  const filteredItems = useMemo(() => {
    if (!filterCategories || filterCategories.length === 0) return menuItems;
    return menuItems.filter(item =>
      filterCategories.some(cat =>
        item.category_name.toLowerCase().includes(cat.toLowerCase())
      )
    );
  }, [menuItems, filterCategories]);

  // Gruppiere nach Kategorie (statt Source)
  const grouped = useMemo(() => {
    const categories = new Map<string, CombinedMenuItem[]>();
    for (const item of filteredItems) {
      const key = item.category_name;
      if (!categories.has(key)) categories.set(key, []);
      categories.get(key)!.push(item);
    }
    return categories;
  }, [filteredItems]);

  const handleSelect = (item: CombinedMenuItem) => {
    onSelect({
      id: item.id,
      name: item.name,
      description: item.description,
      source: item.source,
      price: item.price ?? null,
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
      price: null,
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
      <PopoverContent
        className="w-[360px] p-0 shadow-lg border-border/60"
        align="start"
        style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      >
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Gericht suchen..."
            value={search}
            onValueChange={setSearch}
            className="text-sm"
          />
          <CommandList ref={listRef} className="max-h-[280px]">
            <CommandEmpty>
              {allowCustom && search.trim() ? (
                <button
                  onClick={handleCustom}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-foreground">
                    <strong>„{search}"</strong>
                    <span className="text-muted-foreground ml-1">als Freitext</span>
                  </span>
                </button>
              ) : (
                <span className="text-muted-foreground text-sm">Kein Gericht gefunden.</span>
              )}
            </CommandEmpty>

            {[...grouped.entries()].map(([category, items], idx) => (
              <CommandGroup
                key={category}
                heading={
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {category}
                  </span>
                }
              >
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.category_name} ${item.description || ''}`}
                    onSelect={() => handleSelect(item)}
                    className="py-2 px-3 rounded-lg"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5 shrink-0",
                        value?.id === item.id ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-muted-foreground/70 mt-0.5">
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.price != null && (
                      <span className="text-xs font-medium text-muted-foreground ml-2 shrink-0 tabular-nums">
                        {item.price.toFixed(2)} €
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            {allowCustom && search.trim() && filteredItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleCustom} className="py-2 px-3 rounded-lg">
                    <Plus className="mr-2 h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">
                      <strong>„{search}"</strong>
                      <span className="text-muted-foreground ml-1">als Freitext</span>
                    </span>
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
