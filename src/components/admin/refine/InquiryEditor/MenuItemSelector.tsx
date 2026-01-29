import { useMemo, useState } from "react";
import { Search, Plus, Minus, Trash2, Utensils, Wine, ChefHat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuoteItem } from "./types";
import { useCombinedMenuItems, CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import { Loader2 } from "lucide-react";

interface MenuItemSelectorProps {
  selectedItems: QuoteItem[];
  onItemAdd: (item: { id: string; name: string; description: string | null; price: number | null }) => void;
  onItemQuantityChange: (itemId: string, quantity: number) => void;
  onItemRemove: (itemId: string) => void;
}

export const MenuItemSelector = ({
  selectedItems,
  onItemAdd,
  onItemQuantityChange,
  onItemRemove,
}: MenuItemSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSource, setActiveSource] = useState<'all' | 'catering' | 'food' | 'drinks'>('all');

  // Fetch combined menu items from both sources
  const { items: allItems, groupedItems, isLoading, cateringCount, ristoranteCount } = useCombinedMenuItems();

  // Filter menu items based on search and active source
  const filteredItems = useMemo(() => {
    let sourceItems: CombinedMenuItem[] = [];
    
    switch (activeSource) {
      case 'catering':
        sourceItems = groupedItems.catering;
        break;
      case 'food':
        sourceItems = groupedItems.ristoranteFood;
        break;
      case 'drinks':
        sourceItems = groupedItems.ristoranteDrinks;
        break;
      default:
        sourceItems = allItems;
    }

    if (!searchQuery) return sourceItems.slice(0, 30);
    
    const query = searchQuery.toLowerCase();
    return sourceItems.filter(
      item => item.name.toLowerCase().includes(query) || 
              item.description?.toLowerCase().includes(query) ||
              item.category_name.toLowerCase().includes(query)
    ).slice(0, 30);
  }, [allItems, groupedItems, searchQuery, activeSource]);

  const getSourceBadge = (source: 'catering' | 'ristorante') => {
    if (source === 'catering') {
      return <Badge variant="secondary" className="text-xs"><ChefHat className="h-3 w-3 mr-1" />Catering</Badge>;
    }
    return <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-700"><Utensils className="h-3 w-3 mr-1" />Ristorante</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Utensils className="h-4 w-4" />
          Speisen & Getränke
        </CardTitle>
        <CardDescription>
          Ergänzen Sie individuelle Gerichte aus dem <strong>Catering-Katalog</strong> oder <strong>Ristorante Storia</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Items */}
        {selectedItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Ausgewählt ({selectedItems.length})</p>
            {selectedItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => onItemQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => onItemQuantityChange(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <p className="font-semibold w-20 text-right">
                  {(item.price * item.quantity).toFixed(2)} €
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onItemRemove(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Source Tabs & Search */}
        <div className="space-y-3">
          {/* Source Filter Tabs */}
          <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as typeof activeSource)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs">
                Alle ({cateringCount + ristoranteCount})
              </TabsTrigger>
              <TabsTrigger value="catering" className="text-xs">
                <ChefHat className="h-3 w-3 mr-1" />
                Catering ({cateringCount})
              </TabsTrigger>
              <TabsTrigger value="food" className="text-xs">
                <Utensils className="h-3 w-3 mr-1" />
                Speisen
              </TabsTrigger>
              <TabsTrigger value="drinks" className="text-xs">
                <Wine className="h-3 w-3 mr-1" />
                Getränke
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
              <span>Catering-Katalog</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span>Ristorante Storia</span>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Artikel suchen und hinzufügen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Items List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg max-h-80 overflow-auto">
              {filteredItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Keine Artikel gefunden
                </p>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    onClick={() => {
                      onItemAdd(item);
                    }}
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{item.name}</p>
                        {getSourceBadge(item.source)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.category_name}
                        {item.serving_info && ` • ${item.serving_info}`}
                      </p>
                    </div>
                    <p className="font-semibold whitespace-nowrap">{item.price?.toFixed(2)} €</p>
                    <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
