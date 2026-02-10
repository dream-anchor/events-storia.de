import { useMemo, useState, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Leaf, Edit, Image as ImageIcon, Eye, ChefHat, Utensils, Pizza, Upload, X, Trash2 } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCombinedMenuItems, CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import { useUpdateMenuItem, useDeleteMenuItem, uploadCateringImage } from "@/hooks/useCateringMenuMutations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    id: "",
    name: "",
    name_en: "",
    description: "",
    description_en: "",
    price: "",
    price_display: "",
    serving_info: "",
    serving_info_en: "",
    min_order: "",
    min_order_en: "",
    image_url: "",
    is_vegetarian: false,
    is_vegan: false,
  });

  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();

  // Open edit dialog — fetch full item from Supabase
  const handleEdit = async (item: CombinedMenuItem) => {
    if (item.source !== 'catering') return;
    const rawId = item.id.replace('catering_', '');
    setEditLoading(true);
    setEditDialogOpen(true);

    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("id", rawId)
      .single();

    if (error || !data) {
      toast.error("Fehler beim Laden des Gerichts");
      setEditDialogOpen(false);
      setEditLoading(false);
      return;
    }

    setEditForm({
      id: data.id,
      name: data.name || "",
      name_en: data.name_en || "",
      description: data.description || "",
      description_en: data.description_en || "",
      price: data.price?.toString() || "",
      price_display: data.price_display || "",
      serving_info: data.serving_info || "",
      serving_info_en: data.serving_info_en || "",
      min_order: data.min_order || "",
      min_order_en: data.min_order_en || "",
      image_url: data.image_url || "",
      is_vegetarian: data.is_vegetarian ?? false,
      is_vegan: data.is_vegan ?? false,
    });
    setEditLoading(false);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        itemId: editForm.id,
        data: {
          name: editForm.name,
          name_en: editForm.name_en || null,
          description: editForm.description || null,
          description_en: editForm.description_en || null,
          price: editForm.price ? parseFloat(editForm.price) : null,
          price_display: editForm.price_display || null,
          serving_info: editForm.serving_info || null,
          serving_info_en: editForm.serving_info_en || null,
          min_order: editForm.min_order || null,
          min_order_en: editForm.min_order_en || null,
          image_url: editForm.image_url || null,
          is_vegetarian: editForm.is_vegetarian,
          is_vegan: editForm.is_vegan,
        },
      });
      toast.success("Gericht aktualisiert");
      setEditDialogOpen(false);
    } catch {
      toast.error("Fehler beim Speichern");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(editForm.id);
      toast.success("Gericht gelöscht");
      setEditDialogOpen(false);
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Nur Bilddateien"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max. 5 MB"); return; }

    setUploading(true);
    try {
      const url = await uploadCateringImage(file);
      setEditForm(prev => ({ ...prev, image_url: url }));
      toast.success("Bild hochgeladen");
    } catch {
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploading(false);
    }
  };

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
          <Button size="sm" variant="outline" onClick={() => handleEdit(row.original)}>
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
          <h1 className="text-2xl font-bold tracking-tight">Speisen & Getränke</h1>
          <p className="text-muted-foreground">
            Alle Speisen und Getränke aus Catering und Ristorante.
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gericht bearbeiten</DialogTitle>
          </DialogHeader>

          {editLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Laden...
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              {/* Image */}
              <div className="space-y-2">
                <Label>Bild</Label>
                <div className="flex items-start gap-4">
                  {editForm.image_url ? (
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                      <img src={editForm.image_url} alt={editForm.name} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setEditForm(prev => ({ ...prev, image_url: "" }))}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Lädt..." : "Bild hochladen"}
                    </Button>
                    <p className="text-xs text-muted-foreground">Max. 5 MB, JPG/PNG/WebP</p>
                    <Input
                      placeholder="Oder Bild-URL eingeben"
                      value={editForm.image_url}
                      onChange={(e) => setEditForm(prev => ({ ...prev, image_url: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (DE) *</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Name (EN)</Label>
                  <Input value={editForm.name_en} onChange={(e) => setEditForm(prev => ({ ...prev, name_en: e.target.value }))} />
                </div>
              </div>

              {/* Description */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Beschreibung (DE)</Label>
                  <Textarea rows={3} value={editForm.description} onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung (EN)</Label>
                  <Textarea rows={3} value={editForm.description_en} onChange={(e) => setEditForm(prev => ({ ...prev, description_en: e.target.value }))} />
                </div>
              </div>

              {/* Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preis (€)</Label>
                  <Input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Preis-Anzeige (optional)</Label>
                  <Input placeholder="z.B. ab 12,90 €" value={editForm.price_display} onChange={(e) => setEditForm(prev => ({ ...prev, price_display: e.target.value }))} />
                </div>
              </div>

              {/* Serving Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Portionsinfo (DE)</Label>
                  <Input placeholder="z.B. Pro Person" value={editForm.serving_info} onChange={(e) => setEditForm(prev => ({ ...prev, serving_info: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Portionsinfo (EN)</Label>
                  <Input value={editForm.serving_info_en} onChange={(e) => setEditForm(prev => ({ ...prev, serving_info_en: e.target.value }))} />
                </div>
              </div>

              {/* Min Order */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mindestbestellung (DE)</Label>
                  <Input placeholder="z.B. Ab 10 Personen" value={editForm.min_order} onChange={(e) => setEditForm(prev => ({ ...prev, min_order: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Mindestbestellung (EN)</Label>
                  <Input value={editForm.min_order_en} onChange={(e) => setEditForm(prev => ({ ...prev, min_order_en: e.target.value }))} />
                </div>
              </div>

              {/* Dietary */}
              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.is_vegetarian} onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, is_vegetarian: checked }))} />
                  <Label className="flex items-center gap-1"><Badge variant="outline">V</Badge> Vegetarisch</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.is_vegan} onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, is_vegan: checked }))} />
                  <Label className="flex items-center gap-1"><Badge variant="outline">VG</Badge> Vegan</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:text-destructive gap-1">
                  <Trash2 className="h-4 w-4" />
                  Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Gericht löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{editForm.name}" wird unwiderruflich gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending || !editForm.name}>
                {updateMutation.isPending ? "Speichert..." : "Speichern"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for image upload */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
    </AdminLayout>
  );
};
