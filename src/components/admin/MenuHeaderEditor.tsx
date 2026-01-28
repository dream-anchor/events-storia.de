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
import { Pencil } from "lucide-react";
import { CateringMenu } from "@/hooks/useCateringMenus";
import { useUpdateCateringMenu, useAddCategory } from "@/hooks/useCateringMenuMutations";
import { toast } from "sonner";

interface MenuHeaderEditorProps {
  menu: CateringMenu;
}

export const MenuHeaderEditor = ({ menu }: MenuHeaderEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: menu.title || "",
    title_en: menu.title_en || "",
    subtitle: menu.subtitle || "",
    subtitle_en: menu.subtitle_en || "",
    additional_info: menu.additional_info || "",
    additional_info_en: menu.additional_info_en || "",
  });

  const updateMutation = useUpdateCateringMenu();

  const handleOpen = () => {
    setFormData({
      title: menu.title || "",
      title_en: menu.title_en || "",
      subtitle: menu.subtitle || "",
      subtitle_en: menu.subtitle_en || "",
      additional_info: menu.additional_info || "",
      additional_info_en: menu.additional_info_en || "",
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        menuId: menu.id,
        data: {
          title: formData.title || null,
          title_en: formData.title_en || null,
          subtitle: formData.subtitle || null,
          subtitle_en: formData.subtitle_en || null,
          additional_info: formData.additional_info || null,
          additional_info_en: formData.additional_info_en || null,
        },
      });
      toast.success("Menü aktualisiert");
      setIsOpen(false);
    } catch (error) {
      toast.error("Fehler beim Speichern");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        <Pencil className="h-4 w-4 mr-1" />
        Bearbeiten
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Menü-Details bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menu-title">Titel (DE)</Label>
                <Input
                  id="menu-title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-title-en">Titel (EN)</Label>
                <Input
                  id="menu-title-en"
                  value={formData.title_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title_en: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Subtitle */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menu-subtitle">Untertitel (DE)</Label>
                <Input
                  id="menu-subtitle"
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-subtitle-en">Untertitel (EN)</Label>
                <Input
                  id="menu-subtitle-en"
                  value={formData.subtitle_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, subtitle_en: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menu-info">Zusatzinformationen (DE)</Label>
                <Textarea
                  id="menu-info"
                  rows={3}
                  value={formData.additional_info}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, additional_info: e.target.value }))
                  }
                  placeholder="z.B. Lieferinfos, Allergiehinweise..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-info-en">Zusatzinformationen (EN)</Label>
                <Textarea
                  id="menu-info-en"
                  rows={3}
                  value={formData.additional_info_en}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, additional_info_en: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface AddCategoryButtonProps {
  menuId: string;
}

export const AddCategoryButton = ({ menuId }: AddCategoryButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");

  const addMutation = useAddCategory();

  const handleAdd = async () => {
    if (!name.trim()) return;

    try {
      await addMutation.mutateAsync({
        menuId,
        name: name.trim(),
      });
      toast.success("Kategorie hinzugefügt");
      setName("");
      setIsOpen(false);
    } catch (error) {
      toast.error("Fehler beim Hinzufügen");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        + Kategorie
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Kategorie</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-cat-name">Name *</Label>
              <Input
                id="new-cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name der Kategorie"
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
