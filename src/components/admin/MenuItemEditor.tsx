import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Trash2, Upload, X, ImageIcon } from "lucide-react";
import { CateringMenuItem } from "@/hooks/useCateringMenus";
import {
  useUpdateMenuItem,
  useDeleteMenuItem,
  uploadCateringImage,
} from "@/hooks/useCateringMenuMutations";
import { toast } from "sonner";

interface MenuItemEditorProps {
  item: CateringMenuItem;
}

const MenuItemEditor = ({ item }: MenuItemEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: item.name,
    name_en: item.name_en || "",
    description: item.description || "",
    description_en: item.description_en || "",
    price: item.price?.toString() || "",
    price_display: item.price_display || "",
    serving_info: item.serving_info || "",
    serving_info_en: item.serving_info_en || "",
    min_order: item.min_order || "",
    min_order_en: item.min_order_en || "",
    image_url: item.image_url || "",
    is_vegetarian: item.is_vegetarian,
    is_vegan: item.is_vegan,
  });

  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();

  const handleOpen = () => {
    setFormData({
      name: item.name,
      name_en: item.name_en || "",
      description: item.description || "",
      description_en: item.description_en || "",
      price: item.price?.toString() || "",
      price_display: item.price_display || "",
      serving_info: item.serving_info || "",
      serving_info_en: item.serving_info_en || "",
      min_order: item.min_order || "",
      min_order_en: item.min_order_en || "",
      image_url: item.image_url || "",
      is_vegetarian: item.is_vegetarian,
      is_vegan: item.is_vegan,
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        data: {
          name: formData.name,
          name_en: formData.name_en || null,
          description: formData.description || null,
          description_en: formData.description_en || null,
          price: formData.price ? parseFloat(formData.price) : null,
          price_display: formData.price_display || null,
          serving_info: formData.serving_info || null,
          serving_info_en: formData.serving_info_en || null,
          min_order: formData.min_order || null,
          min_order_en: formData.min_order_en || null,
          image_url: formData.image_url || null,
          is_vegetarian: formData.is_vegetarian,
          is_vegan: formData.is_vegan,
        },
      });
      toast.success("Gericht aktualisiert");
      setIsOpen(false);
    } catch (error) {
      toast.error("Fehler beim Speichern");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success("Gericht gelöscht");
    } catch (error) {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Bitte nur Bilddateien hochladen");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Bild darf maximal 5 MB groß sein");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadCateringImage(file);
      setFormData((prev) => ({ ...prev, image_url: url }));
      toast.success("Bild hochgeladen");
    } catch (error) {
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploading(false);
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
              <AlertDialogTitle>Gericht löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                "{item.name}" wird unwiderruflich gelöscht.
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gericht bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Bild</Label>
              <div className="flex items-start gap-4">
                {formData.image_url ? (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                    <img
                      src={formData.image_url}
                      alt={formData.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, image_url: "" }))}
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Lädt..." : "Bild hochladen"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Max. 5 MB, JPG/PNG/WebP
                  </p>
                  <Input
                    placeholder="Oder Bild-URL eingeben"
                    value={formData.image_url}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, image_url: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name (DE) *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_en">Name (EN)</Label>
                <Input
                  id="name_en"
                  value={formData.name_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name_en: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Description */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="desc">Beschreibung (DE)</Label>
                <Textarea
                  id="desc"
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc_en">Beschreibung (EN)</Label>
                <Textarea
                  id="desc_en"
                  rows={3}
                  value={formData.description_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description_en: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preis (€)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_display">Preis-Anzeige (optional)</Label>
                <Input
                  id="price_display"
                  placeholder="z.B. ab 12,90 €"
                  value={formData.price_display}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price_display: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Serving Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serving">Portionsinfo (DE)</Label>
                <Input
                  id="serving"
                  placeholder="z.B. Pro Person"
                  value={formData.serving_info}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, serving_info: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serving_en">Portionsinfo (EN)</Label>
                <Input
                  id="serving_en"
                  value={formData.serving_info_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, serving_info_en: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Min Order */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min">Mindestbestellung (DE)</Label>
                <Input
                  id="min"
                  placeholder="z.B. Ab 10 Personen"
                  value={formData.min_order}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, min_order: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_en">Mindestbestellung (EN)</Label>
                <Input
                  id="min_en"
                  value={formData.min_order_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, min_order_en: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Dietary */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="vegetarian"
                  checked={formData.is_vegetarian}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_vegetarian: checked }))
                  }
                />
                <Label htmlFor="vegetarian" className="flex items-center gap-1">
                  <Badge variant="outline">V</Badge> Vegetarisch
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="vegan"
                  checked={formData.is_vegan}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_vegan: checked }))
                  }
                />
                <Label htmlFor="vegan" className="flex items-center gap-1">
                  <Badge variant="outline">VG</Badge> Vegan
                </Label>
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

export default MenuItemEditor;
