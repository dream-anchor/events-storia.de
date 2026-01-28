import { useMemo, useState } from "react";
import { Calendar, Truck, MapPin, Search, Plus, Minus, Trash2, Utensils, Wine, ChefHat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExtendedInquiry, QuoteItem } from "./types";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useCombinedMenuItems, CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import { Loader2 } from "lucide-react";

interface CateringModulesProps {
  inquiry: ExtendedInquiry;
  selectedItems: QuoteItem[];
  onItemAdd: (item: { id: string; name: string; description: string | null; price: number | null }) => void;
  onItemQuantityChange: (itemId: string, quantity: number) => void;
  onItemRemove: (itemId: string) => void;
  onDeliveryChange: (field: 'delivery_street' | 'delivery_zip' | 'delivery_city' | 'delivery_time_slot', value: string) => void;
}

const DELIVERY_TIME_SLOTS = [
  { id: '10-11', label: '10:00 - 11:00' },
  { id: '11-12', label: '11:00 - 12:00' },
  { id: '12-13', label: '12:00 - 13:00' },
  { id: '13-14', label: '13:00 - 14:00' },
  { id: '17-18', label: '17:00 - 18:00' },
  { id: '18-19', label: '18:00 - 19:00' },
  { id: '19-20', label: '19:00 - 20:00' },
];

export const CateringModules = ({
  inquiry,
  selectedItems,
  onItemAdd,
  onItemQuantityChange,
  onItemRemove,
  onDeliveryChange,
}: CateringModulesProps) => {
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

  const getItemQuantity = (itemId: string) => {
    const item = selectedItems.find(i => i.id === itemId);
    return item?.quantity || 0;
  };

  const getSourceBadge = (source: 'catering' | 'ristorante') => {
    if (source === 'catering') {
      return <Badge variant="secondary" className="text-xs"><ChefHat className="h-3 w-3 mr-1" />Catering</Badge>;
    }
    return <Badge variant="outline" className="text-xs"><Utensils className="h-3 w-3 mr-1" />Restaurant</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Catering Info Header */}
      <Card className="bg-accent/50 border-accent">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                {inquiry.preferred_date 
                  ? format(parseISO(inquiry.preferred_date), "dd.MM.yyyy", { locale: de })
                  : 'Kein Datum'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span>Lieferung</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{inquiry.delivery_city || 'München'}</span>
            </div>
            <div>
              <Badge variant="outline">
                {inquiry.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Lieferadresse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Straße & Hausnummer</Label>
              <Input
                value={inquiry.delivery_street || ''}
                onChange={(e) => onDeliveryChange('delivery_street', e.target.value)}
                placeholder="Musterstraße 123"
              />
            </div>
            <div className="space-y-2">
              <Label>PLZ</Label>
              <Input
                value={inquiry.delivery_zip || ''}
                onChange={(e) => onDeliveryChange('delivery_zip', e.target.value)}
                placeholder="80331"
              />
            </div>
            <div className="space-y-2">
              <Label>Stadt</Label>
              <Input
                value={inquiry.delivery_city || ''}
                onChange={(e) => onDeliveryChange('delivery_city', e.target.value)}
                placeholder="München"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Lieferzeitfenster</Label>
              <Select 
                value={inquiry.delivery_time_slot || ''} 
                onValueChange={(v) => onDeliveryChange('delivery_time_slot', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Zeitfenster wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_TIME_SLOTS.map(slot => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bestellte Artikel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Items */}
          {selectedItems.length > 0 && (
            <div className="space-y-2">
              {selectedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
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
    </div>
  );
};
