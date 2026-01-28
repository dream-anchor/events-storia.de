import { useState, useMemo } from "react";
import { Search, ChefHat, Utensils, Plus } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useCombinedMenuItems, CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

interface GlobalItemSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CombinedMenuItem) => void;
  onCustomItem?: () => void;
  filterType?: 'food' | 'drinks' | 'all';
  placeholder?: string;
}

export const GlobalItemSearch = ({
  open,
  onOpenChange,
  onSelect,
  onCustomItem,
  filterType = 'all',
  placeholder = "Alle Speisen & Getränke durchsuchen...",
}: GlobalItemSearchProps) => {
  const { groupedItems, isLoading } = useCombinedMenuItems();

  // Filter based on type
  const filteredGroups = useMemo(() => {
    if (filterType === 'food') {
      return {
        catering: groupedItems.catering.filter(i => 
          !i.category_name.toLowerCase().includes('getränk') &&
          !i.category_name.toLowerCase().includes('drink') &&
          !i.category_name.toLowerCase().includes('wein') &&
          !i.category_name.toLowerCase().includes('beer') &&
          !i.category_name.toLowerCase().includes('aperitif')
        ),
        ristoranteFood: groupedItems.ristoranteFood,
        ristoranteDrinks: [],
      };
    }
    if (filterType === 'drinks') {
      return {
        catering: groupedItems.catering.filter(i => 
          i.category_name.toLowerCase().includes('getränk') ||
          i.category_name.toLowerCase().includes('drink') ||
          i.category_name.toLowerCase().includes('wein') ||
          i.category_name.toLowerCase().includes('beer') ||
          i.category_name.toLowerCase().includes('aperitif')
        ),
        ristoranteFood: [],
        ristoranteDrinks: groupedItems.ristoranteDrinks,
      };
    }
    return groupedItems;
  }, [groupedItems, filterType]);

  const handleSelect = (item: CombinedMenuItem) => {
    onSelect(item);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={placeholder} />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>
          {isLoading ? "Lade..." : "Keine Ergebnisse gefunden."}
        </CommandEmpty>

        {/* Custom Item Option */}
        {onCustomItem && (
          <>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onCustomItem();
                  onOpenChange(false);
                }}
                className="text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Freie Position hinzufügen
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Catering Items */}
        {filteredGroups.catering.length > 0 && (
          <CommandGroup heading="Catering-Katalog">
            {filteredGroups.catering.slice(0, 30).map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.name} ${item.category_name}`}
                onSelect={() => handleSelect(item)}
              >
                <ChefHat className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {item.category_name}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.price !== null && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {item.price.toFixed(2)} €
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Restaurant Food */}
        {filteredGroups.ristoranteFood.length > 0 && (
          <CommandGroup heading="Ristorante Speisekarte">
            {filteredGroups.ristoranteFood.slice(0, 30).map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.name} ${item.category_name}`}
                onSelect={() => handleSelect(item)}
              >
                <Utensils className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {item.category_name}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.price !== null && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {item.price.toFixed(2)} €
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Restaurant Drinks */}
        {filteredGroups.ristoranteDrinks.length > 0 && (
          <CommandGroup heading="Ristorante Getränkekarte">
            {filteredGroups.ristoranteDrinks.slice(0, 20).map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.name} ${item.category_name}`}
                onSelect={() => handleSelect(item)}
              >
                <Utensils className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {item.category_name}
                    </Badge>
                  </div>
                </div>
                {item.price !== null && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {item.price.toFixed(2)} €
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};