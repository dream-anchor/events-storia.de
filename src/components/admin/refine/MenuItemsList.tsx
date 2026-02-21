import { useMemo, useState, useRef, useCallback } from "react";
import {
  ChefHat, Utensils, Plus, Edit, Trash2, Undo2, X,
  ChevronDown, ChevronRight, Upload, Search, Sparkles,
  Loader2, FolderPlus, AlertTriangle, Clock, Archive, ArchiveRestore,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCateringMenus, type CateringMenu, type CateringCategory, type CateringMenuItem } from "@/hooks/useCateringMenus";
import { useRistoranteMenus } from "@/hooks/useRistoranteMenus";
import {
  useUpdateMenuItem, useDeleteMenuItem, useAddMenuItem,
  useAddCategory, useUpdateCategory, useDeleteCategory,
  useRestoreMenuItem, useRestoreCategory,
  usePermanentDeleteMenuItem, usePermanentDeleteCategory,
  useMenuTrash, uploadCateringImage,
  useArchiveMenuItem, useArchiveCategory,
  useUnarchiveMenuItem, useUnarchiveCategory,
  useMenuArchive,
  type TrashItem,
  type ArchiveItem,
} from "@/hooks/useCateringMenuMutations";
import { useTranslateMenuText } from "@/hooks/useTranslateMenuText";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Main Component ───────────────────────────────────────────────
export const MenuItemsList = () => {
  const [activeTab, setActiveTab] = useState("catering");
  const [searchQuery, setSearchQuery] = useState("");

  // Item/Category edit state
  const [editItemDialog, setEditItemDialog] = useState(false);
  const [editCategoryDialog, setEditCategoryDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'item' | 'category'; id: string; name: string } | null>(null);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<TrashItem | null>(null);

  // Data
  const { data: menus, isLoading: menusLoading } = useCateringMenus();
  const trashQuery = useMenuTrash();
  const archiveQuery = useMenuArchive();
  const ristoranteQuery = useRistoranteMenus({ menuTypes: ['food', 'drinks', 'lunch'], enabled: activeTab === 'ristorante' });

  // Flatten all categories from all menus
  const allCategories = useMemo(() => {
    if (!menus) return [];
    return menus.flatMap(menu =>
      menu.categories.map(cat => ({ ...cat, menuId: menu.id, menuTitle: menu.title }))
    );
  }, [menus]);

  // Search filter
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return allCategories;
    const q = searchQuery.toLowerCase();
    return allCategories
      .map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.name.toLowerCase().includes(q) ||
          item.name_en?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
        ),
      }))
      .filter(cat =>
        cat.name.toLowerCase().includes(q) || cat.items.length > 0
      );
  }, [allCategories, searchQuery]);

  // Total counts
  const totalItems = allCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  const trashCount = trashQuery.data?.length || 0;
  const archiveCount = archiveQuery.data?.length || 0;

  return (
    <AdminLayout activeTab="menu">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <ChefHat className="h-6 w-6" />
              Speisen & Getranke
            </h1>
            <p className="text-muted-foreground">
              Catering-Katalog verwalten
              {totalItems > 0 && <span className="ml-1">({totalItems} Speisen)</span>}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="catering" className="gap-2">
              <ChefHat className="h-4 w-4" />
              Catering
              <Badge variant="secondary" className="ml-1">{totalItems}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ristorante" className="gap-2">
              <Utensils className="h-4 w-4" />
              Ristorante
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-2">
              <Archive className="h-4 w-4" />
              Archiv
              {archiveCount > 0 && (
                <Badge variant="secondary" className="ml-1">{archiveCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="trash" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Papierkorb
              {trashCount > 0 && (
                <Badge variant="destructive" className="ml-1">{trashCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── Catering Tab ─── */}
          <TabsContent value="catering" className="space-y-4 mt-4">
            <CateringTab
              menus={menus || []}
              categories={filteredCategories}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onEditItem={(item) => {
                setEditItemFormFromItem(item);
                setEditItemDialog(true);
              }}
              onDeleteItem={(id, name) => setDeleteConfirm({ type: 'item', id, name })}
              onEditCategory={(cat) => {
                setEditCategoryFormFromCategory(cat);
                setEditCategoryDialog(true);
              }}
              onDeleteCategory={(id, name) => setDeleteConfirm({ type: 'category', id, name })}
              onAddItem={(categoryId) => {
                resetEditItemForm(categoryId);
                setEditItemDialog(true);
              }}
              onAddCategory={(menuId) => {
                resetEditCategoryForm(menuId);
                setEditCategoryDialog(true);
              }}
              isLoading={menusLoading}
            />
          </TabsContent>

          {/* ─── Ristorante Tab ─── */}
          <TabsContent value="ristorante" className="mt-4">
            <RistoranteTab ristoranteQuery={ristoranteQuery} />
          </TabsContent>

          {/* ─── Archive Tab ─── */}
          <TabsContent value="archive" className="mt-4">
            <ArchiveTab
              items={archiveQuery.data || []}
              isLoading={archiveQuery.isLoading}
            />
          </TabsContent>

          {/* ─── Trash Tab ─── */}
          <TabsContent value="trash" className="mt-4">
            <TrashTab
              items={trashQuery.data || []}
              isLoading={trashQuery.isLoading}
              onPermanentDelete={(item) => setPermanentDeleteConfirm(item)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Edit Item Dialog ─── */}
      <MenuItemEditDialog
        open={editItemDialog}
        onOpenChange={setEditItemDialog}
        menus={menus || []}
      />

      {/* ─── Edit Category Dialog ─── */}
      <CategoryEditDialog
        open={editCategoryDialog}
        onOpenChange={setEditCategoryDialog}
        menus={menus || []}
      />

      {/* ─── Delete Confirm ─── */}
      <DeleteConfirmDialog
        item={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
      />

      {/* ─── Permanent Delete Confirm ─── */}
      <PermanentDeleteConfirmDialog
        item={permanentDeleteConfirm}
        onClose={() => setPermanentDeleteConfirm(null)}
      />
    </AdminLayout>
  );

  // ─── Form state helpers ───
  function setEditItemFormFromItem(item: CateringMenuItem & { categoryId?: string }) {
    window.__menuEditItemForm = {
      mode: 'edit',
      id: item.id,
      categoryId: item.categoryId || '',
      name: item.name || '',
      name_en: item.name_en || '',
      description: item.description || '',
      description_en: item.description_en || '',
      price: item.price?.toString() || '',
      price_display: item.price_display || '',
      serving_info: item.serving_info || '',
      serving_info_en: item.serving_info_en || '',
      min_order: item.min_order || '',
      min_order_en: item.min_order_en || '',
      image_url: item.image_url || '',
      is_vegetarian: item.is_vegetarian ?? false,
      is_vegan: item.is_vegan ?? false,
    };
  }

  function resetEditItemForm(categoryId: string) {
    window.__menuEditItemForm = {
      mode: 'create',
      id: '',
      categoryId,
      name: '', name_en: '',
      description: '', description_en: '',
      price: '', price_display: '',
      serving_info: '', serving_info_en: '',
      min_order: '', min_order_en: '',
      image_url: '',
      is_vegetarian: false, is_vegan: false,
    };
  }

  function setEditCategoryFormFromCategory(cat: CateringCategory & { menuId?: string }) {
    window.__menuEditCategoryForm = {
      mode: 'edit',
      id: cat.id,
      menuId: cat.menuId || '',
      name: cat.name || '',
      name_en: cat.name_en || '',
      description: cat.description || '',
      description_en: cat.description_en || '',
    };
  }

  function resetEditCategoryForm(menuId: string) {
    window.__menuEditCategoryForm = {
      mode: 'create',
      id: '',
      menuId,
      name: '', name_en: '',
      description: '', description_en: '',
    };
  }
};

// Global form state (simpler than lifting through many layers)
declare global {
  interface Window {
    __menuEditItemForm?: ItemFormData;
    __menuEditCategoryForm?: CategoryFormData;
  }
}

interface ItemFormData {
  mode: 'create' | 'edit';
  id: string;
  categoryId: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: string;
  price_display: string;
  serving_info: string;
  serving_info_en: string;
  min_order: string;
  min_order_en: string;
  image_url: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
}

interface CategoryFormData {
  mode: 'create' | 'edit';
  id: string;
  menuId: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
}

// ─── Catering Tab ─────────────────────────────────────────────────
function CateringTab({
  menus,
  categories,
  searchQuery,
  onSearchChange,
  onEditItem,
  onDeleteItem,
  onEditCategory,
  onDeleteCategory,
  onAddItem,
  onAddCategory,
  isLoading,
}: {
  menus: CateringMenu[];
  categories: (CateringCategory & { menuId: string; menuTitle: string | null })[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onEditItem: (item: CateringMenuItem & { categoryId: string }) => void;
  onDeleteItem: (id: string, name: string) => void;
  onEditCategory: (cat: CateringCategory & { menuId: string }) => void;
  onDeleteCategory: (id: string, name: string) => void;
  onAddItem: (categoryId: string) => void;
  onAddCategory: (menuId: string) => void;
  isLoading: boolean;
}) {
  const archiveItemMutation = useArchiveMenuItem();
  const archiveCategoryMutation = useArchiveCategory();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Laden...
      </div>
    );
  }

  const defaultMenuId = menus[0]?.id || '';

  return (
    <div className="space-y-4">
      {/* Search + Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Suche nach Speise oder Kategorie..."
            className="pl-10 rounded-xl"
          />
        </div>
        <Button variant="outline" onClick={() => onAddCategory(defaultMenuId)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Neue Kategorie
        </Button>
        <Button onClick={() => {
          const firstCatId = categories[0]?.id || '';
          if (firstCatId) onAddItem(firstCatId);
          else toast.error("Erstelle zuerst eine Kategorie");
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Speise
        </Button>
      </div>

      {/* Category Sections */}
      {categories.length === 0 ? (
        <Card className="rounded-2xl border-border/40 p-12 text-center">
          <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Keine Kategorien gefunden</p>
          <Button variant="outline" className="mt-4" onClick={() => onAddCategory(defaultMenuId)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Erste Kategorie anlegen
          </Button>
        </Card>
      ) : (
        categories.map(category => (
          <CategorySection
            key={category.id}
            category={category}
            onEditItem={(item) => onEditItem({ ...item, categoryId: category.id })}
            onDeleteItem={onDeleteItem}
            onArchiveItem={async (id, name) => {
              try {
                await archiveItemMutation.mutateAsync(id);
                toast.success(`"${name}" archiviert`);
              } catch { toast.error("Fehler beim Archivieren"); }
            }}
            onArchiveCategory={async () => {
              try {
                await archiveCategoryMutation.mutateAsync(category.id);
                toast.success(`"${category.name}" archiviert`);
              } catch { toast.error("Fehler beim Archivieren"); }
            }}
            onEditCategory={() => onEditCategory({ ...category, menuId: category.menuId })}
            onDeleteCategory={() => onDeleteCategory(category.id, category.name)}
            onAddItem={() => onAddItem(category.id)}
          />
        ))
      )}
    </div>
  );
}

// ─── Category Section (Collapsible) ──────────────────────────────
function CategorySection({
  category,
  onEditItem,
  onDeleteItem,
  onArchiveItem,
  onArchiveCategory,
  onEditCategory,
  onDeleteCategory,
  onAddItem,
}: {
  category: CateringCategory & { menuTitle?: string | null };
  onEditItem: (item: CateringMenuItem) => void;
  onDeleteItem: (id: string, name: string) => void;
  onArchiveItem: (id: string, name: string) => void;
  onArchiveCategory: () => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onAddItem: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-5 py-3 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{category.name}</span>
                  {category.name_en && (
                    <span className="text-xs text-muted-foreground">/ {category.name_en}</span>
                  )}
                  <Badge variant="secondary" className="text-xs">{category.items.length}</Badge>
                </div>
                {category.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditCategory} title="Kategorie bearbeiten">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onArchiveCategory} title="Kategorie archivieren">
                <Archive className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={onDeleteCategory} title="Kategorie löschen">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border/30">
            {category.items.map(item => (
              <MenuItemRow
                key={item.id}
                item={item}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item.id, item.name)}
                onArchive={() => onArchiveItem(item.id, item.name)}
              />
            ))}
          </div>
          <div className="px-5 py-2 border-t border-border/20">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1" onClick={onAddItem}>
              <Plus className="h-3.5 w-3.5" />
              Speise hinzufugen
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ─── Menu Item Row ────────────────────────────────────────────────
function MenuItemRow({
  item,
  onEdit,
  onDelete,
  onArchive,
}: {
  item: CateringMenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onArchive?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Image */}
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-muted/50 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.name}</span>
            {item.name_en && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">/ {item.name_en}</span>
            )}
            {item.is_vegetarian && (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] px-1.5 py-0 h-5 shrink-0">V</Badge>
            )}
            {item.is_vegan && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] px-1.5 py-0 h-5 shrink-0">VG</Badge>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {item.price != null && (
          <span className="font-semibold text-sm">{item.price.toFixed(2)} €</span>
        )}
        {item.price_display && !item.price && (
          <span className="text-sm text-muted-foreground">{item.price_display}</span>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Bearbeiten">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          {onArchive && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onArchive} title="Archivieren">
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={onDelete} title="Löschen">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Translate Button ─────────────────────────────────────────────
function TranslateButton({
  name,
  description,
  onResult,
}: {
  name?: string;
  description?: string;
  onResult: (result: { name_en?: string | null; description_en?: string | null }) => void;
}) {
  const translateMutation = useTranslateMenuText();

  const handleTranslate = async () => {
    if (!name && !description) {
      toast.error("Kein Text zum Ubersetzen");
      return;
    }
    try {
      const result = await translateMutation.mutateAsync({ name, description });
      onResult(result);
      toast.success("Ubersetzung eingefugt");
    } catch {
      toast.error("Ubersetzung fehlgeschlagen");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleTranslate}
      disabled={translateMutation.isPending || (!name && !description)}
      className="gap-1.5"
    >
      {translateMutation.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      KI-Ubersetzen
    </Button>
  );
}

// ─── Menu Item Edit Dialog ────────────────────────────────────────
function MenuItemEditDialog({
  open,
  onOpenChange,
  menus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menus: CateringMenu[];
}) {
  const [form, setForm] = useState<ItemFormData | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMutation = useAddMenuItem();
  const updateMutation = useUpdateMenuItem();

  // Load form data when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen && window.__menuEditItemForm) {
      setForm({ ...window.__menuEditItemForm });
    } else if (!isOpen) {
      setForm(null);
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  // Sync on open
  if (open && !form && window.__menuEditItemForm) {
    setForm({ ...window.__menuEditItemForm });
  }

  const allCategories = menus.flatMap(m => m.categories.map(c => ({ id: c.id, name: c.name, menuTitle: m.title })));

  const handleSave = async () => {
    if (!form || !form.name.trim()) return;

    try {
      if (form.mode === 'create') {
        await addMutation.mutateAsync({
          categoryId: form.categoryId,
          name: form.name,
          name_en: form.name_en || null,
          description: form.description || null,
          description_en: form.description_en || null,
          price: form.price ? parseFloat(form.price) : null,
          price_display: form.price_display || null,
          serving_info: form.serving_info || null,
          serving_info_en: form.serving_info_en || null,
          min_order: form.min_order || null,
          min_order_en: form.min_order_en || null,
          is_vegetarian: form.is_vegetarian,
          is_vegan: form.is_vegan,
          image_url: form.image_url || null,
        });
        toast.success("Speise erstellt");
      } else {
        await updateMutation.mutateAsync({
          itemId: form.id,
          data: {
            name: form.name,
            name_en: form.name_en || null,
            description: form.description || null,
            description_en: form.description_en || null,
            price: form.price ? parseFloat(form.price) : null,
            price_display: form.price_display || null,
            serving_info: form.serving_info || null,
            serving_info_en: form.serving_info_en || null,
            min_order: form.min_order || null,
            min_order_en: form.min_order_en || null,
            image_url: form.image_url || null,
            is_vegetarian: form.is_vegetarian,
            is_vegan: form.is_vegan,
            category_id: form.categoryId || undefined,
          },
        });
        toast.success("Speise aktualisiert");
      }
      handleOpenChange(false);
    } catch {
      toast.error("Fehler beim Speichern");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    if (!file.type.startsWith("image/")) { toast.error("Nur Bilddateien"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max. 5 MB"); return; }

    setUploading(true);
    try {
      const url = await uploadCateringImage(file);
      setForm(prev => prev ? { ...prev, image_url: url } : prev);
      toast.success("Bild hochgeladen");
    } catch {
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploading(false);
    }
  };

  if (!form) return null;

  const isCreate = form.mode === 'create';
  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Neue Speise' : 'Speise bearbeiten'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Category selector */}
          <div className="space-y-2">
            <Label>Kategorie</Label>
            <Select
              value={form.categoryId}
              onValueChange={(v) => setForm(prev => prev ? { ...prev, categoryId: v } : prev)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Kategorie wahlen" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name} {cat.menuTitle && <span className="text-muted-foreground">({cat.menuTitle})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image */}
          <div className="space-y-2">
            <Label>Bild</Label>
            <div className="flex items-start gap-4">
              {form.image_url ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border">
                  <img src={form.image_url} alt={form.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setForm(prev => prev ? { ...prev, image_url: '' } : prev)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/50" />
              )}
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Ladt..." : "Hochladen"}
                </Button>
                <Input
                  placeholder="Oder Bild-URL"
                  value={form.image_url}
                  onChange={(e) => setForm(prev => prev ? { ...prev, image_url: e.target.value } : prev)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Name DE/EN + Translate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Name</Label>
              <TranslateButton
                name={form.name}
                description={form.description}
                onResult={(r) => {
                  setForm(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      name_en: r.name_en || prev.name_en,
                      description_en: r.description_en || prev.description_en,
                    };
                  });
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input value={form.name} onChange={(e) => setForm(prev => prev ? { ...prev, name: e.target.value } : prev)} placeholder="Name (DE) *" />
              <Input value={form.name_en} onChange={(e) => setForm(prev => prev ? { ...prev, name_en: e.target.value } : prev)} placeholder="Name (EN)" />
            </div>
          </div>

          {/* Description DE/EN */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Beschreibung (DE)</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm(prev => prev ? { ...prev, description: e.target.value } : prev)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Beschreibung (EN)</Label>
              <Textarea rows={2} value={form.description_en} onChange={(e) => setForm(prev => prev ? { ...prev, description_en: e.target.value } : prev)} />
            </div>
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Preis (€)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm(prev => prev ? { ...prev, price: e.target.value } : prev)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preis-Anzeige</Label>
              <Input placeholder="z.B. ab 12,90 €" value={form.price_display} onChange={(e) => setForm(prev => prev ? { ...prev, price_display: e.target.value } : prev)} />
            </div>
          </div>

          {/* Serving Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Portionsinfo (DE)</Label>
              <Input placeholder="z.B. Pro Person" value={form.serving_info} onChange={(e) => setForm(prev => prev ? { ...prev, serving_info: e.target.value } : prev)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Portionsinfo (EN)</Label>
              <Input value={form.serving_info_en} onChange={(e) => setForm(prev => prev ? { ...prev, serving_info_en: e.target.value } : prev)} />
            </div>
          </div>

          {/* Min Order */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mindestbestellung (DE)</Label>
              <Input placeholder="z.B. Ab 10 Personen" value={form.min_order} onChange={(e) => setForm(prev => prev ? { ...prev, min_order: e.target.value } : prev)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mindestbestellung (EN)</Label>
              <Input value={form.min_order_en} onChange={(e) => setForm(prev => prev ? { ...prev, min_order_en: e.target.value } : prev)} />
            </div>
          </div>

          {/* Dietary */}
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_vegetarian} onCheckedChange={(c) => setForm(prev => prev ? { ...prev, is_vegetarian: c } : prev)} />
              <Label className="text-sm">Vegetarisch</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_vegan} onCheckedChange={(c) => setForm(prev => prev ? { ...prev, is_vegan: c } : prev)} />
              <Label className="text-sm">Vegan</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={isPending || !form.name.trim()}>
            {isPending ? "Speichert..." : isCreate ? "Erstellen" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category Edit Dialog ─────────────────────────────────────────
function CategoryEditDialog({
  open,
  onOpenChange,
  menus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menus: CateringMenu[];
}) {
  const [form, setForm] = useState<CategoryFormData | null>(null);

  const addMutation = useAddCategory();
  const updateMutation = useUpdateCategory();

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen && window.__menuEditCategoryForm) {
      setForm({ ...window.__menuEditCategoryForm });
    } else if (!isOpen) {
      setForm(null);
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  if (open && !form && window.__menuEditCategoryForm) {
    setForm({ ...window.__menuEditCategoryForm });
  }

  const handleSave = async () => {
    if (!form || !form.name.trim()) return;

    try {
      if (form.mode === 'create') {
        await addMutation.mutateAsync({
          menuId: form.menuId,
          name: form.name,
          name_en: form.name_en || null,
          description: form.description || null,
          description_en: form.description_en || null,
        });
        toast.success("Kategorie erstellt");
      } else {
        await updateMutation.mutateAsync({
          categoryId: form.id,
          data: {
            name: form.name,
            name_en: form.name_en || null,
            description: form.description || null,
            description_en: form.description_en || null,
          },
        });
        toast.success("Kategorie aktualisiert");
      }
      handleOpenChange(false);
    } catch {
      toast.error("Fehler beim Speichern");
    }
  };

  if (!form) return null;

  const isCreate = form.mode === 'create';
  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Neue Kategorie' : 'Kategorie bearbeiten'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Menu selector (only for create) */}
          {isCreate && menus.length > 1 && (
            <div className="space-y-2">
              <Label>Menu</Label>
              <Select value={form.menuId} onValueChange={(v) => setForm(prev => prev ? { ...prev, menuId: v } : prev)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {menus.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.title || 'Unbenannt'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Name + Translate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Name</Label>
              <TranslateButton
                name={form.name}
                description={form.description}
                onResult={(r) => {
                  setForm(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      name_en: r.name_en || prev.name_en,
                      description_en: r.description_en || prev.description_en,
                    };
                  });
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input value={form.name} onChange={(e) => setForm(prev => prev ? { ...prev, name: e.target.value } : prev)} placeholder="Name (DE) *" />
              <Input value={form.name_en} onChange={(e) => setForm(prev => prev ? { ...prev, name_en: e.target.value } : prev)} placeholder="Name (EN)" />
            </div>
          </div>

          {/* Description */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Beschreibung (DE)</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm(prev => prev ? { ...prev, description: e.target.value } : prev)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Beschreibung (EN)</Label>
              <Textarea rows={2} value={form.description_en} onChange={(e) => setForm(prev => prev ? { ...prev, description_en: e.target.value } : prev)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={isPending || !form.name.trim()}>
            {isPending ? "Speichert..." : isCreate ? "Erstellen" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────
function DeleteConfirmDialog({
  item,
  onClose,
}: {
  item: { type: 'item' | 'category'; id: string; name: string } | null;
  onClose: () => void;
}) {
  const deleteItemMutation = useDeleteMenuItem();
  const deleteCategoryMutation = useDeleteCategory();

  const handleDelete = async () => {
    if (!item) return;
    try {
      if (item.type === 'item') {
        await deleteItemMutation.mutateAsync(item.id);
      } else {
        await deleteCategoryMutation.mutateAsync(item.id);
      }
      toast.success(`"${item.name}" in den Papierkorb verschoben`);
      onClose();
    } catch {
      toast.error("Fehler beim Loschen");
    }
  };

  return (
    <AlertDialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {item?.type === 'category' ? 'Kategorie' : 'Speise'} loschen?
          </AlertDialogTitle>
          <AlertDialogDescription>
            "{item?.name}" wird in den Papierkorb verschoben. Du kannst es innerhalb von 60 Tagen wiederherstellen.
            {item?.type === 'category' && ' Alle Speisen in dieser Kategorie werden ebenfalls verschoben.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
            In Papierkorb
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Permanent Delete Confirm ─────────────────────────────────────
function PermanentDeleteConfirmDialog({
  item,
  onClose,
}: {
  item: TrashItem | null;
  onClose: () => void;
}) {
  const deleteItemMutation = usePermanentDeleteMenuItem();
  const deleteCategoryMutation = usePermanentDeleteCategory();

  const handleDelete = async () => {
    if (!item) return;
    try {
      if (item.type === 'item') {
        await deleteItemMutation.mutateAsync(item.id);
      } else {
        await deleteCategoryMutation.mutateAsync(item.id);
      }
      toast.success(`"${item.name}" endgultig geloscht`);
      onClose();
    } catch {
      toast.error("Fehler beim Loschen");
    }
  };

  return (
    <AlertDialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Endgultig loschen?</AlertDialogTitle>
          <AlertDialogDescription>
            "{item?.name}" wird unwiderruflich geloscht. Diese Aktion kann nicht ruckgangig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
            Endgultig loschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Ristorante Tab (Read-Only) ──────────────────────────────────
function RistoranteTab({ ristoranteQuery }: { ristoranteQuery: ReturnType<typeof useRistoranteMenus> }) {
  if (ristoranteQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Laden...
      </div>
    );
  }

  const items = ristoranteQuery.data?.items || [];

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const cat = item.category_name || 'Sonstiges';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-3">
        <Utensils className="h-4 w-4 shrink-0" />
        <span>Daten aus dem Ristorante Storia — nur Ansicht, Bearbeitung im Ristorante-System</span>
      </div>

      {grouped.map(([categoryName, categoryItems]) => (
        <Card key={categoryName} className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-muted/20 border-b border-border/30">
            <span className="font-semibold">{categoryName}</span>
            <Badge variant="secondary" className="ml-2 text-xs">{categoryItems.length}</Badge>
          </div>
          <div className="divide-y divide-border/30">
            {categoryItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted/50 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium truncate block">{item.name}</span>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {item.price != null ? (
                    <span className="font-semibold text-sm">{item.price.toFixed(2)} €</span>
                  ) : item.price_display ? (
                    <span className="text-sm text-muted-foreground">{item.price_display}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {grouped.length === 0 && (
        <Card className="rounded-2xl border-border/40 p-12 text-center">
          <p className="text-muted-foreground">Keine Ristorante-Speisen gefunden</p>
        </Card>
      )}
    </div>
  );
}

// ─── Trash Tab ────────────────────────────────────────────────────
function TrashTab({
  items,
  isLoading,
  onPermanentDelete,
}: {
  items: TrashItem[];
  isLoading: boolean;
  onPermanentDelete: (item: TrashItem) => void;
}) {
  const restoreItemMutation = useRestoreMenuItem();
  const restoreCategoryMutation = useRestoreCategory();

  const handleRestore = async (item: TrashItem) => {
    try {
      if (item.type === 'item') {
        await restoreItemMutation.mutateAsync(item.id);
      } else {
        await restoreCategoryMutation.mutateAsync(item.id);
      }
      toast.success(`"${item.name}" wiederhergestellt`);
    } catch {
      toast.error("Fehler beim Wiederherstellen");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Laden...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="rounded-2xl border-border/40 p-12 text-center">
        <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium">Papierkorb ist leer</p>
        <p className="text-sm text-muted-foreground mt-1">
          Geloschte Speisen und Kategorien erscheinen hier
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span>Elemente werden nach 60 Tagen automatisch endgultig geloscht</span>
      </div>

      <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
        <div className="divide-y divide-border/30">
          {items.map(item => (
            <div key={`${item.type}-${item.id}`} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <Badge variant={item.type === 'category' ? 'secondary' : 'outline'} className="text-xs">
                    {item.type === 'category' ? 'Kategorie' : 'Speise'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.categoryName && (
                    <span className="text-xs text-muted-foreground">{item.categoryName}</span>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.daysRemaining} Tage verbleibend
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(item)}
                  disabled={restoreItemMutation.isPending || restoreCategoryMutation.isPending}
                  className="gap-1"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Wiederherstellen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPermanentDelete(item)}
                  className="text-destructive/60 hover:text-destructive gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Löschen
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Archive Tab ──────────────────────────────────────────────────
function ArchiveTab({
  items,
  isLoading,
}: {
  items: ArchiveItem[];
  isLoading: boolean;
}) {
  const unarchiveItemMutation = useUnarchiveMenuItem();
  const unarchiveCategoryMutation = useUnarchiveCategory();

  const handleUnarchive = async (item: ArchiveItem) => {
    try {
      if (item.type === 'item') {
        await unarchiveItemMutation.mutateAsync(item.id);
      } else {
        await unarchiveCategoryMutation.mutateAsync(item.id);
      }
      toast.success(`"${item.name}" wiederhergestellt`);
    } catch {
      toast.error("Fehler beim Wiederherstellen");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Laden...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="rounded-2xl border-border/40 p-12 text-center">
        <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium">Archiv ist leer</p>
        <p className="text-sm text-muted-foreground mt-1">
          Archivierte saisonale Speisen und Kategorien erscheinen hier
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-3">
        <Archive className="h-4 w-4 shrink-0" />
        <span>Archivierte Elemente bleiben dauerhaft gespeichert und können jederzeit wiederhergestellt werden</span>
      </div>

      <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
        <div className="divide-y divide-border/30">
          {items.map(item => (
            <div key={`${item.type}-${item.id}`} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <Badge variant={item.type === 'category' ? 'secondary' : 'outline'} className="text-xs">
                    {item.type === 'category' ? 'Kategorie' : 'Speise'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.categoryName && (
                    <span className="text-xs text-muted-foreground">{item.categoryName}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Archiviert am {new Date(item.archivedAt).toLocaleDateString('de-DE')}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnarchive(item)}
                disabled={unarchiveItemMutation.isPending || unarchiveCategoryMutation.isPending}
                className="gap-1 shrink-0"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                Wiederherstellen
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
