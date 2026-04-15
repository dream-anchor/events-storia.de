import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

/** Welche Kategorienamen für einen Gang-Typ zuerst erscheinen sollen */
const COURSE_PRIORITY_CATEGORIES: Record<string, string[]> = {
  starter: ['antipasti', 'vorspeise', 'antipasto'],
  pasta: ['pasta', 'primi', 'primo'],
  main: ['hauptgang', 'secondo', 'secondi', 'fleisch', 'main'],
  main_fish: ['fisch', 'fish', 'meeresfrüchte', 'pesce'],
  main_meat: ['fleisch', 'meat', 'secondo', 'secondi'],
  dessert: ['dessert', 'dolce', 'nachspeise', 'dolci'],
  fingerfood: ['fingerfood', 'snack', 'bites'],
  vegetarisch: ['vegetarisch', 'vegetarian', 'veggie', 'gemüse'],
  vegan: ['vegan', 'vegano', 'plant'],
};

interface DishPickerProps {
  value: { id: string; name: string } | null;
  onSelect: (dish: { id: string; name: string; description: string | null; source: string; price: number | null }) => void;
  onClear?: () => void;
  menuItems: CombinedMenuItem[];
  filterCategories?: string[];
  courseType?: string;
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
  courseType,
  placeholder = "Gericht wählen...",
  allowCustom = true,
  disabled = false,
}: DishPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = 0;
      });
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    if (!filterCategories || filterCategories.length === 0) return menuItems;
    return menuItems.filter(item =>
      filterCategories.some(cat =>
        item.category_name.toLowerCase().includes(cat.toLowerCase())
      )
    );
  }, [menuItems, filterCategories]);

  const searchFiltered = useMemo(() => {
    if (!search.trim()) return filteredItems;
    const q = search.toLowerCase().trim();
    return filteredItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.category_name.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }, [filteredItems, search]);

  const priorityCats = useMemo(() => {
    if (!courseType) return [];
    return (COURSE_PRIORITY_CATEGORIES[courseType] || []).map(c => c.toLowerCase());
  }, [courseType]);

  const isPriority = (categoryName: string) =>
    priorityCats.some(p => categoryName.toLowerCase().includes(p));

  const sortedItems = useMemo(() => {
    if (priorityCats.length === 0) return searchFiltered;
    return [...searchFiltered].sort((a, b) => {
      const aPrio = isPriority(a.category_name) ? 0 : 1;
      const bPrio = isPriority(b.category_name) ? 0 : 1;
      return aPrio - bPrio;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFiltered, priorityCats]);

  const sourceGroups = useMemo(() => {
    const ristorante = new Map<string, CombinedMenuItem[]>();
    const catering = new Map<string, CombinedMenuItem[]>();
    for (const item of sortedItems) {
      const target = item.source === 'ristorante' ? ristorante : catering;
      const key = item.category_name;
      if (!target.has(key)) target.set(key, []);
      target.get(key)!.push(item);
    }
    return { ristorante, catering };
  }, [sortedItems]);

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
            "justify-between font-normal h-9 rounded-xl w-full",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {value ? value.name : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0 shadow-lg border-border/60"
        align="start"
        style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Gericht suchen oder eigenen Namen eintippen..."
            value={search}
            onValueChange={setSearch}
            className="text-sm"
          />
          <CommandList ref={listRef} className="max-h-[280px]">

            {/* ═══ EIGENES GERICHT — IMMER OBEN ═══ */}
            {allowCustom && search.trim() && (
              <CommandGroup>
                <CommandItem onSelect={handleCustom} className="py-2.5 px-3 rounded-lg bg-primary/5 border border-primary/10 mx-1 mt-1 mb-1">
                  <PenLine className="mr-2 h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">
                    „{search}" <span className="font-normal text-muted-foreground">als eigenes Gericht</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {allowCustom && !search.trim() && (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                <PenLine className="h-3 w-3" />
                Eigenen Namen eintippen für Freitext-Gericht
              </div>
            )}

            {/* Keine Treffer */}
            {searchFiltered.length === 0 && search.trim() && (
              <div className="py-3 text-center text-xs text-muted-foreground">
                Kein passendes Gericht gefunden — oben als Freitext übernehmen.
              </div>
            )}

            {/* ═══ SPEISEKARTE RESTAURANT ═══ */}
            {sourceGroups.ristorante.size > 0 && (
              <>
                {search.trim() && <CommandSeparator className="my-1" />}
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                    Speisekarte Restaurant
                  </span>
                </div>
                {[...sourceGroups.ristorante.entries()].map(([category, items]) => (
                  <CommandGroup
                    key={`r_${category}`}
                    heading={
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                        {category}
                      </span>
                    }
                  >
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
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
                        {item.price != null && item.price > 0 && (
                          <span className="text-xs font-medium text-muted-foreground ml-2 shrink-0 tabular-nums">
                            {item.price.toFixed(2)} €
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}

            {/* ═══ CATERING / FINGERFOOD ═══ */}
            {sourceGroups.catering.size > 0 && (
              <>
                {sourceGroups.ristorante.size > 0 && <CommandSeparator className="my-1" />}
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600/80">
                    Catering / Fingerfood
                  </span>
                </div>
                {[...sourceGroups.catering.entries()].map(([category, items]) => (
                  <CommandGroup
                    key={`c_${category}`}
                    heading={
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                        {category}
                      </span>
                    }
                  >
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
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
                        {item.price != null && item.price > 0 && (
                          <span className="text-xs font-medium text-muted-foreground ml-2 shrink-0 tabular-nums">
                            {item.price.toFixed(2)} €
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}

          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
