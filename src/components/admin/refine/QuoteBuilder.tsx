import { useMemo, useState, useCallback } from "react";
import { useList, useUpdate } from "@refinedev/core";
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Search, Plus, GripVertical, Trash2, FileText, Eye, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MenuItem, QuoteItem, EventInquiry } from "@/types/refine";

interface QuoteBuilderProps {
  event: EventInquiry;
  onSave: (items: QuoteItem[], notes: string) => void;
  onPreviewPdf: (items: QuoteItem[], notes: string) => void;
  onSendToLexOffice: (items: QuoteItem[], notes: string) => void;
}

// Draggable Menu Item Component
const DraggableMenuItem = ({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) => {
  return (
    <div
      className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group"
      onClick={() => onAdd(item)}
    >
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-12 h-12 rounded-md object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        )}
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm">{item.price?.toFixed(2)} €</p>
        {item.serving_info && (
          <p className="text-xs text-muted-foreground">{item.serving_info}</p>
        )}
      </div>
      <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Sortable Quote Item Component
const SortableQuoteItem = ({ 
  item, 
  onQuantityChange, 
  onRemove 
}: { 
  item: QuoteItem; 
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 bg-card rounded-lg border",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{item.name}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        )}
        {item.isCustom && (
          <Badge variant="outline" className="mt-1 text-xs">Freitext</Badge>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => onQuantityChange(item.id, Math.max(1, item.quantity - 1))}
        >
          -
        </Button>
        <span className="w-8 text-center font-medium">{item.quantity}</span>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => onQuantityChange(item.id, item.quantity + 1)}
        >
          +
        </Button>
      </div>
      
      <p className="font-semibold text-sm w-20 text-right">
        {(item.price * item.quantity).toFixed(2)} €
      </p>
      
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => onRemove(item.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Custom Item Dialog
const AddCustomItemDialog = ({ onAdd }: { onAdd: (item: Omit<QuoteItem, 'id'>) => void }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    if (!name || !price) return;
    onAdd({
      name,
      description,
      price: parseFloat(price),
      quantity: 1,
      isCustom: true,
    });
    setName("");
    setDescription("");
    setPrice("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Freitext-Position
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Freitext-Position hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label htmlFor="custom-name">Bezeichnung</Label>
            <Input
              id="custom-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Sonder-Arrangement"
            />
          </div>
          <div>
            <Label htmlFor="custom-description">Beschreibung (optional)</Label>
            <Textarea
              id="custom-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details..."
            />
          </div>
          <div>
            <Label htmlFor="custom-price">Preis (€)</Label>
            <Input
              id="custom-price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <Button onClick={handleAdd} className="w-full" disabled={!name || !price}>
            Hinzufügen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const QuoteBuilder = ({ event, onSave, onPreviewPdf, onSendToLexOffice }: QuoteBuilderProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Fetch menu items
  const menuItemsQuery = useList<MenuItem>({
    resource: "menu_items",
    pagination: { pageSize: 100 },
    sorters: [{ field: "sort_order", order: "asc" }],
  });

  const menuItems = menuItemsQuery.result?.data || [];
  const isLoading = menuItemsQuery.query.isLoading;

  // Filter menu items by search
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery) return menuItems;
    const query = searchQuery.toLowerCase();
    return menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  }, [menuItems, searchQuery]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Add item to quote
  const handleAddItem = useCallback((item: MenuItem) => {
    setQuoteItems((prev) => {
      const existing = prev.find((q) => q.id === item.id);
      if (existing) {
        return prev.map((q) =>
          q.id === item.id ? { ...q, quantity: q.quantity + 1 } : q
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price || 0,
          quantity: 1,
        },
      ];
    });
  }, []);

  // Add custom item
  const handleAddCustomItem = useCallback((item: Omit<QuoteItem, 'id'>) => {
    const id = `custom-${Date.now()}`;
    setQuoteItems((prev) => [...prev, { ...item, id }]);
  }, []);

  // Update quantity
  const handleQuantityChange = useCallback((id: string, quantity: number) => {
    setQuoteItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  // Remove item
  const handleRemoveItem = useCallback((id: string) => {
    setQuoteItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setQuoteItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = [...items];
        const [removed] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, removed);
        return newItems;
      });
    }
    setActiveId(null);
  };

  // Calculate totals
  const subtotal = useMemo(
    () => quoteItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [quoteItems]
  );
  const vat = subtotal * 0.07; // 7% food VAT
  const total = subtotal + vat;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
      {/* Left: Menu Items */}
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Speisen & Getränke</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Gerichte suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-2 pb-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine Gerichte gefunden
            </div>
          ) : (
            filteredMenuItems.map((item) => (
              <DraggableMenuItem key={item.id} item={item} onAdd={handleAddItem} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Right: Quote Builder */}
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Angebot</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {event.company_name || event.contact_name} • {event.guest_count} Gäste
              </p>
            </div>
            <Badge variant={event.status === 'new' ? 'default' : 'secondary'}>
              {event.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-auto space-y-4 pb-4">
          {/* Quote Items with DnD */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={quoteItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {quoteItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    Klicke links auf Gerichte, um sie hinzuzufügen
                  </div>
                ) : (
                  quoteItems.map((item) => (
                    <SortableQuoteItem
                      key={item.id}
                      item={item}
                      onQuantityChange={handleQuantityChange}
                      onRemove={handleRemoveItem}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add Custom Item */}
          <AddCustomItemDialog onAdd={handleAddCustomItem} />

          {/* Notes */}
          <div>
            <Label htmlFor="quote-notes">Anmerkungen</Label>
            <Textarea
              id="quote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interne Notizen oder Hinweise fürs Angebot..."
              className="mt-1"
            />
          </div>
        </CardContent>

        {/* Footer: Totals & Actions */}
        <div className="border-t p-4 bg-muted/30 space-y-4">
          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Zwischensumme (netto)</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">MwSt. 7%</span>
              <span>{vat.toFixed(2)} €</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Gesamt (brutto)</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onPreviewPdf(quoteItems, notes)}
              disabled={quoteItems.length === 0}
            >
              <Eye className="h-4 w-4 mr-2" />
              Vorschau
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onSave(quoteItems, notes)}
              disabled={quoteItems.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Speichern
            </Button>
            <Button 
              className="flex-1"
              onClick={() => onSendToLexOffice(quoteItems, notes)}
              disabled={quoteItems.length === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              An LexOffice
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
