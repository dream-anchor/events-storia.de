import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Plus, Minus, Trash2, Utensils, Wine, ChefHat, Loader2, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCombinedMenuItems, CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PackageMenuItem {
  id: string;
  package_id: string;
  item_source: 'catering' | 'ristorante';
  item_id: string;
  item_name: string;
  item_price: number | null;
  quantity: number;
  is_included: boolean;
  sort_order: number;
}

interface PackageMenuItemsEditorProps {
  packageId: string;
  onItemsChange?: (items: PackageMenuItem[]) => void;
}

export const PackageMenuItemsEditor = ({ packageId, onItemsChange }: PackageMenuItemsEditorProps) => {
  const [assignedItems, setAssignedItems] = useState<PackageMenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSource, setActiveSource] = useState<'all' | 'catering' | 'food' | 'drinks'>('all');
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch combined menu items
  const { items: allItems, groupedItems, isLoading: isLoadingMenu, cateringCount, ristoranteCount } = useCombinedMenuItems();

  // Fetch existing assigned items
  useEffect(() => {
    const fetchAssignedItems = async () => {
      if (!packageId) return;
      
      setIsLoadingItems(true);
      const { data, error } = await supabase
        .from('package_menu_items')
        .select('*')
        .eq('package_id', packageId)
        .order('sort_order');

      if (error) {
        console.error('Error fetching package menu items:', error);
        toast.error('Fehler beim Laden der Menü-Items');
      } else {
        setAssignedItems((data || []) as PackageMenuItem[]);
      }
      setIsLoadingItems(false);
    };

    fetchAssignedItems();
  }, [packageId]);

  // Notify parent of changes
  useEffect(() => {
    onItemsChange?.(assignedItems);
  }, [assignedItems, onItemsChange]);

  // Filter available items
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

    // Filter out already assigned items
    const assignedIds = new Set(assignedItems.map(i => i.item_id));
    sourceItems = sourceItems.filter(item => !assignedIds.has(item.id));

    if (!searchQuery) return sourceItems.slice(0, 20);
    
    const query = searchQuery.toLowerCase();
    return sourceItems.filter(
      item => item.name.toLowerCase().includes(query) || 
              item.description?.toLowerCase().includes(query) ||
              item.category_name.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [allItems, groupedItems, searchQuery, activeSource, assignedItems]);

  // Add item
  const handleAddItem = useCallback(async (item: CombinedMenuItem) => {
    const newItem: Omit<PackageMenuItem, 'id'> = {
      package_id: packageId,
      item_source: item.source,
      item_id: item.id,
      item_name: item.name,
      item_price: item.price,
      quantity: 1,
      is_included: true,
      sort_order: assignedItems.length,
    };

    setIsSaving(true);
    const { data, error } = await supabase
      .from('package_menu_items')
      .insert(newItem)
      .select()
      .single();

    if (error) {
      console.error('Error adding item:', error);
      toast.error('Fehler beim Hinzufügen');
    } else {
      setAssignedItems(prev => [...prev, data as PackageMenuItem]);
      toast.success(`${item.name} hinzugefügt`);
    }
    setIsSaving(false);
    setSearchQuery("");
  }, [packageId, assignedItems.length]);

  // Remove item
  const handleRemoveItem = useCallback(async (itemId: string) => {
    const { error } = await supabase
      .from('package_menu_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error removing item:', error);
      toast.error('Fehler beim Entfernen');
    } else {
      setAssignedItems(prev => prev.filter(i => i.id !== itemId));
    }
  }, []);

  // Update item quantity
  const handleQuantityChange = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) return;

    const { error } = await supabase
      .from('package_menu_items')
      .update({ quantity })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating quantity:', error);
    } else {
      setAssignedItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i));
    }
  }, []);

  // Toggle included status
  const handleToggleIncluded = useCallback(async (itemId: string, isIncluded: boolean) => {
    const { error } = await supabase
      .from('package_menu_items')
      .update({ is_included: isIncluded })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating included status:', error);
    } else {
      setAssignedItems(prev => prev.map(i => i.id === itemId ? { ...i, is_included: isIncluded } : i));
    }
  }, []);

  const getSourceBadge = (source: 'catering' | 'ristorante') => {
    if (source === 'catering') {
      return <Badge variant="secondary" className="text-xs"><ChefHat className="h-3 w-3 mr-1" />Catering</Badge>;
    }
    return <Badge variant="outline" className="text-xs"><Utensils className="h-3 w-3 mr-1" />Restaurant</Badge>;
  };

  const isLoading = isLoadingItems || isLoadingMenu;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Menü-Items zuordnen
        </CardTitle>
        <CardDescription>
          Weisen Sie Speisen und Getränke aus dem Catering-Katalog oder Restaurant-Menü zu
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assigned Items */}
        <div className="space-y-3">
          <Label className="text-base font-medium">
            Zugeordnete Items ({assignedItems.length})
          </Label>
          
          {isLoadingItems ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assignedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
              <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Noch keine Items zugeordnet</p>
              <p className="text-sm">Suchen Sie unten nach Items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedItems.map(item => (
                <div 
                  key={item.id} 
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{item.item_name}</p>
                      {getSourceBadge(item.item_source)}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{item.item_price?.toFixed(2)} €</span>
                      <div className="flex items-center gap-1">
                        <Switch
                          id={`included-${item.id}`}
                          checked={item.is_included}
                          onCheckedChange={(checked) => handleToggleIncluded(item.id, checked)}
                          className="scale-75"
                        />
                        <span className="text-xs">
                          {item.is_included ? 'Inklusiv' : 'Aufpreis'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Items Section */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-base font-medium">Items hinzufügen</Label>
          
          {/* Source Tabs */}
          <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as typeof activeSource)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs">
                Alle ({cateringCount + ristoranteCount})
              </TabsTrigger>
              <TabsTrigger value="catering" className="text-xs">
                <ChefHat className="h-3 w-3 mr-1" />
                Catering
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nach Speisen oder Getränken suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Available Items */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg max-h-64 overflow-auto">
              {filteredItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {searchQuery ? 'Keine Items gefunden' : 'Alle Items bereits zugeordnet'}
                </p>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleAddItem(item)}
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
                      </p>
                    </div>
                    <p className="font-semibold whitespace-nowrap">{item.price?.toFixed(2)} €</p>
                    <Plus className="h-4 w-4 text-primary flex-shrink-0" />
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
