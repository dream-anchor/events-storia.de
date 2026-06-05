import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Upload, ImageOff, Loader2 } from "lucide-react";
import { CateringCategory } from "@/hooks/useCateringMenus";
import {
  useUpdateCategory,
  useDeleteCategory,
  useAddMenuItem,
  uploadCateringImage,
} from "@/hooks/useCateringMenuMutations";
import { toast } from "sonner";

interface CategoryEditorProps {
  category: CateringCategory;
}

export const CategoryEditor = ({ category }: CategoryEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: category.name,
    name_en: category.name_en || "",
    description: category.description || "",
    description_en: category.description_en || "",
    image_url: category.image_url || "",
    homepage_slug: category.homepage_slug || "",
  });

  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const handleOpen = () => {
    setFormData({
      name: category.name,
      name_en: category.name_en || "",
      description: category.description || "",
      description_en: category.description_en || "",
      image_url: category.image_url || "",
      homepage_slug: category.homepage_slug || "",
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        categoryId: category.id,
        data: {
          name: formData.name,
          name_en: formData.name_en || null,
          description: formData.description || null,
          description_en: formData.description_en || null,
          image_url: formData.image_url || null,
          homepage_slug: formData.homepage_slug ? formData.homepage_slug.trim() : null,
        },
      });
      toast.success("Kategorie aktualisiert");
      setIsOpen(false);
    } catch (error) {
      toast.error("Fehler beim Speichern");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadCateringImage(file);
      setFormData((prev) => ({ ...prev, image_url: url }));
      toast.success("Bild hochgeladen");
    } catch (err) {
      console.error(err);
      toast.error("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(category.id);
      toast.success("Kategorie gelöscht");
    } catch (error) {
      toast.error("Fehler beim Löschen");
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={handleOpen}>
          <Pencil className="h-3 w-3" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                "{category.name}" und alle {category.items.length} Gerichte werden unwiderruflich gelöscht.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Kategorie-Bild (Startseite)</Label>
              <div className="flex items-start gap-3">
                <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                  {formData.image_url ? (
                    <img src={formData.image_url} alt={formData.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                      <span className="cursor-pointer">
                        {uploading ? (
                          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Lädt hoch…</>
                        ) : (
                          <><Upload className="h-4 w-4 mr-1" /> {formData.image_url ? "Bild austauschen" : "Bild hochladen"}</>
                        )}
                      </span>
                    </Button>
                  </label>
                  {formData.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive justify-start"
                      onClick={() => setFormData((p) => ({ ...p, image_url: "" }))}
                    >
                      Bild entfernen
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Wird auf der Startseite als Kachel verwendet, wenn ein Startseiten-Slug gesetzt ist.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-homepage-slug">Startseiten-Slug (optional)</Label>
              <Input
                id="cat-homepage-slug"
                value={formData.homepage_slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, homepage_slug: e.target.value }))
                }
                placeholder="fingerfood, platten, auflauf, pizza, desserts, events"
              />
              <p className="text-xs text-muted-foreground">
                Verknüpft diese Kategorie mit einer Kachel auf der Startseite. Leer lassen, wenn nicht auf der Startseite gezeigt.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Name (DE) *</Label>
                <Input
                  id="cat-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-name-en">Name (EN)</Label>
                <Input
                  id="cat-name-en"
                  value={formData.name_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name_en: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-desc">Beschreibung (DE)</Label>
                <Textarea
                  id="cat-desc"
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-desc-en">Beschreibung (EN)</Label>
                <Textarea
                  id="cat-desc-en"
                  rows={2}
                  value={formData.description_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description_en: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending || !formData.name}>
              {updateMutation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface AddItemButtonProps {
  categoryId: string;
}

export const AddItemButton = ({ categoryId }: AddItemButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const addMutation = useAddMenuItem();

  const handleAdd = async () => {
    if (!name.trim()) return;

    try {
      await addMutation.mutateAsync({
        categoryId,
        name: name.trim(),
        price: price ? parseFloat(price) : undefined,
      });
      toast.success("Gericht hinzugefügt");
      setName("");
      setPrice("");
      setIsOpen(false);
    } catch (error) {
      toast.error("Fehler beim Hinzufügen");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="w-full mt-2"
      >
        <Plus className="h-4 w-4 mr-1" />
        Gericht hinzufügen
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Gericht</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-item-name">Name *</Label>
              <Input
                id="new-item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name des Gerichts"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-item-price">Preis (€)</Label>
              <Input
                id="new-item-price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="z.B. 12.90"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending || !name.trim()}>
              {addMutation.isPending ? "Fügt hinzu..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
