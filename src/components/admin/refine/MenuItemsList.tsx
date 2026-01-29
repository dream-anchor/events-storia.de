import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Leaf, Edit, Image as ImageIcon, Eye, ChefHat, Utensils, Pizza } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCombinedMenuItems, CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

// Default pizza image for pizza items without an image
const DEFAULT_PIZZA_IMAGE = "/catering/pizze/hero-pizza.webp";

export const MenuItemsList = () => {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'catering' | 'ristorante'>('all');

  const { 
    items: allItems, 
    groupedItems, 
    isLoading, 
    cateringCount, 
    ristoranteCount,
    totalCount 
  } = useCombinedMenuItems();

  // Filter items based on source selection
  const filteredItems = useMemo(() => {
    switch (sourceFilter) {
      case 'catering':
        return groupedItems.catering;
      case 'ristorante':
        return [...groupedItems.ristoranteFood, ...groupedItems.ristoranteDrinks];
      default:
        return allItems;
    }
  }, [sourceFilter, groupedItems, allItems]);

  // Helper to check if item name suggests it's a pizza
  const isPizzaItem = (name: string, categoryName: string) => {
    const lowerName = name.toLowerCase();
    const lowerCategory = categoryName.toLowerCase();
    return lowerName.includes('pizza') || 
           lowerCategory.includes('pizza') || 
           lowerCategory.includes('pizze');
  };

  // Get appropriate image URL with pizza fallback
  const getItemImage = (item: CombinedMenuItem) => {
    if (item.image_url) return item.image_url;
    if (isPizzaItem(item.name, item.category_name)) return DEFAULT_PIZZA_IMAGE;
    return null;
  };

  const columns: ColumnDef<CombinedMenuItem>[] = [
    {
      accessorKey: "image_url",
      header: "",
      cell: ({ row }) => {
        const imageUrl = getItemImage(row.original);
        if (!imageUrl) {
          return (
            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          );
        }
        return (
          <img 
            src={imageUrl} 
            alt={row.original.name}
            className="w-12 h-12 rounded-md object-cover"
          />
        );
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{row.original.name}</p>
            {row.original.source === 'catering' ? (
              <Badge variant="secondary" className="text-xs">
                <ChefHat className="h-3 w-3 mr-1" />
                Catering
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-700 bg-amber-50">
                <Utensils className="h-3 w-3 mr-1" />
                Ristorante
              </Badge>
            )}
          </div>
          {row.original.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {row.original.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {row.original.category_name}
            {row.original.serving_info && ` • ${row.original.serving_info}`}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "price",
      header: "Preis",
      cell: ({ row }) => (
        <div>
          {row.original.price ? (
            <p className="font-semibold">{row.original.price.toFixed(2)} €</p>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "dietary",
      header: "Diät",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.is_vegetarian && (
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
              <Leaf className="h-3 w-3 mr-1" />
              Vegetarisch
            </Badge>
          )}
          {row.original.is_vegan && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
              <Leaf className="h-3 w-3 mr-1" />
              Vegan
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const isEditable = row.original.source === 'catering';
        return isEditable ? (
          <Button size="sm" variant="outline">
            <Edit className="h-4 w-4 mr-1" />
            Bearbeiten
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled>
            <Eye className="h-4 w-4 mr-1" />
            Nur Ansicht
          </Button>
        );
      },
    },
  ];

  return (
    <AdminLayout activeTab="menu">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Speisen & Getränke</h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle Speisen und Getränke aus beiden Quellen.
          </p>
        </div>

        {/* Source Filter Tabs */}
        <Tabs value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              Alle
              <Badge variant="secondary" className="ml-1">{totalCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="catering" className="gap-2">
              <ChefHat className="h-4 w-4" />
              Catering-Katalog
              <Badge variant="secondary" className="ml-1">{cateringCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ristorante" className="gap-2">
              <Utensils className="h-4 w-4" />
              Ristorante Storia
              <Badge variant="secondary" className="ml-1">{ristoranteCount}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Legend */}
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              <strong>Catering-Katalog</strong> – Bearbeitbar, Speisen dieser Seite
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Utensils className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              <strong className="text-primary">Ristorante Storia</strong> – Nur Ansicht, externe Daten
            </span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredItems}
          searchPlaceholder="Suche nach Gericht..."
          isLoading={isLoading}
          pageSize={20}
        />
      </div>
    </AdminLayout>
  );
};
