import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Wrench, Users, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { EquipmentItem } from "./types";

interface InlineServiceEditorProps {
  items: EquipmentItem[];
  sectionType: 'equipment' | 'staff';
  onUpdate: (items: EquipmentItem[]) => void;
  disabled?: boolean;
}

const SECTION_CONFIG = {
  equipment: {
    label: 'Equipment',
    icon: Wrench,
    placeholder: 'z.B. Chafing Dish, Besteck, Geschirr …',
  },
  staff: {
    label: 'Personal',
    icon: Users,
    placeholder: 'z.B. Kellner, Servicekraft, Barkeeper …',
  },
} as const;

export function InlineServiceEditor({
  items,
  sectionType,
  onUpdate,
  disabled = false,
}: InlineServiceEditorProps) {
  const config = SECTION_CONFIG[sectionType];
  const Icon = config.icon;

  // Catalog (only for equipment)
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; default_quantity: number; price_per_unit: number }>>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  useEffect(() => {
    if (!catalogOpen || catalog.length > 0) return;
    const tableName = sectionType === 'staff' ? 'staff_catalog' : 'equipment_catalog';
    supabase
      .from(tableName as any)
      .select("id,name,default_quantity,price_per_unit")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data }) => setCatalog((data || []) as any));
  }, [sectionType, catalogOpen, catalog.length]);

  const filteredCatalog = catalog.filter((c) =>
    c.name.toLowerCase().includes(catalogSearch.trim().toLowerCase()),
  );

  const handleAddFromCatalog = useCallback(
    (entry: { name: string; default_quantity: number; price_per_unit: number }) => {
      const newItem: EquipmentItem = {
        id: crypto.randomUUID(),
        name: entry.name,
        pricePerUnit: entry.price_per_unit,
        quantity: entry.default_quantity || 1,
      };
      onUpdate([...items, newItem]);
      setCatalogOpen(false);
      setCatalogSearch("");
    },
    [items, onUpdate],
  );

  const handleAdd = useCallback(() => {
    const newItem: EquipmentItem = {
      id: crypto.randomUUID(),
      name: '',
      pricePerUnit: 0,
      quantity: 1,
    };
    onUpdate([...items, newItem]);
  }, [items, onUpdate]);

  const handleRemove = useCallback((index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  }, [items, onUpdate]);

  const handleItemChange = useCallback((index: number, field: keyof EquipmentItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate(updated);
  }, [items, onUpdate]);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {config.label}
          </h4>
        </div>
        <div className="flex items-center gap-1">
          <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <BookOpen className="h-3 w-3" />
                  Aus Katalog
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-2 border-b">
                  <Input
                    autoFocus
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Suchen…"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="max-h-64 overflow-auto py-1">
                  {catalog.length === 0 ? (
                    <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                      Katalog ist leer.
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="text-xs text-muted-foreground px-3 py-4 text-center">Keine Treffer</div>
                  ) : (
                    filteredCatalog.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAddFromCatalog(c)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left"
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {c.default_quantity}× · {c.price_per_unit.toFixed(2)} €
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            disabled={disabled}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <Plus className="h-3 w-3" />
            Hinzufügen
          </Button>
        </div>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-2 group"
            >
              {/* Name */}
              <Input
                value={item.name}
                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                placeholder={config.placeholder}
                className={cn("h-8 text-xs flex-1 min-w-0", !item.name && (item.pricePerUnit > 0 || item.quantity > 1) && "border-destructive/50 focus-visible:ring-destructive/30")}
                disabled={disabled}
              />
              {/* Menge */}
              <Input
                type="number"
                min={1}
                value={item.quantity || ''}
                onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                className="h-8 text-xs w-14 text-center"
                placeholder="1"
                disabled={disabled}
              />
              {/* Preis */}
              <div className="relative w-20 shrink-0">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.pricePerUnit || ''}
                  onChange={(e) => handleItemChange(idx, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs pr-5 text-right"
                  placeholder="0,00"
                  disabled={disabled}
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">€</span>
              </div>
              {/* Zeilen-Total */}
              <span className="text-xs text-muted-foreground w-16 text-right shrink-0 tabular-nums">
                {item.pricePerUnit > 0 && item.quantity > 0
                  ? `${(item.pricePerUnit * item.quantity).toFixed(2)} €`
                  : '—'}
              </span>
              {/* Löschen */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(idx)}
                disabled={disabled}
                className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}