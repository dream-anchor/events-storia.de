import { useList } from "@refinedev/core";
import { ColumnDef } from "@tanstack/react-table";
import { Leaf, UtensilsCrossed, Edit, Image as ImageIcon } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MenuItem } from "@/types/refine";
import { useState } from "react";

export const MenuItemsList = () => {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const menuItemsQuery = useList<MenuItem>({
    resource: "menu_items",
    pagination: { pageSize: 100 },
    sorters: [{ field: "sort_order", order: "asc" }],
  });

  const menuItems = menuItemsQuery.result?.data || [];
  const isLoading = menuItemsQuery.query.isLoading;

  const columns: ColumnDef<MenuItem>[] = [
    {
      accessorKey: "image_url",
      header: "",
      cell: ({ row }) => {
        const imageUrl = row.original.image_url;
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
          <p className="font-medium">{row.original.name}</p>
          {row.original.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {row.original.description}
            </p>
          )}
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
          ) : row.original.price_display ? (
            <p className="text-sm text-muted-foreground">{row.original.price_display}</p>
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
      accessorKey: "allergens",
      header: "Allergene",
      cell: ({ row }) => {
        const allergens = row.original.allergens;
        if (!allergens) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-sm font-mono text-muted-foreground">
            {allergens}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button size="sm" variant="outline">
          <Edit className="h-4 w-4 mr-1" />
          Bearbeiten
        </Button>
      ),
    },
  ];

  return (
    <AdminLayout activeTab="menu">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Catering-Katalog</h1>
          <p className="text-muted-foreground">
            Verwalten Sie die Catering-Gerichte und Preise.
          </p>
        </div>

        <DataTable
          columns={columns}
          data={menuItems}
          searchPlaceholder="Suche nach Gericht..."
          onRefresh={() => menuItemsQuery.query.refetch()}
          isLoading={isLoading}
          pageSize={20}
        />
      </div>
    </AdminLayout>
  );
};
