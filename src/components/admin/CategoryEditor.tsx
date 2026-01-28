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
import { Pencil, Trash2, Plus } from "lucide-react";
import { CateringCategory } from "@/hooks/useCateringMenus";
import {
  useUpdateCategory,
  useDeleteCategory,
  useAddMenuItem,
} from "@/hooks/useCateringMenuMutations";
import { toast } from "sonner";

interface CategoryEditorProps {
  category: CateringCategory;
}

export const CategoryEditor = ({ category }: CategoryEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: category.name,
    name_en: category.name_en || "",
    description: category.description || "",
    description_en: category.description_en || "",
  });

  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const handleOpen = () => {
    setFormData({
      name: category.name,
      name_en: category.name_en || "",
      description: category.description || "",
      description_en: category.description_en || "",
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
        },
      });
      toast.success("Kategorie aktualisiert");
      setIsOpen(false);
    } catch (error) {
      toast.error("Fehler beim Speichern");
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
