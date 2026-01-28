import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomItemInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (item: { name: string; description: string | null }) => void;
  title?: string;
  description?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
}

export const CustomItemInput = ({
  open,
  onOpenChange,
  onSubmit,
  title = "Freie Position hinzufügen",
  description = "Füge ein Gericht oder Getränk hinzu, das nicht in der Karte steht.",
  nameLabel = "Name",
  namePlaceholder = "z.B. Tagliata di Manzo special",
  descriptionLabel = "Beschreibung (optional)",
  descriptionPlaceholder = "z.B. Mit Rucola und Parmesan",
}: CustomItemInputProps) => {
  const [name, setName] = useState("");
  const [itemDescription, setItemDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    
    onSubmit({
      name: name.trim(),
      description: itemDescription.trim() || null,
    });
    
    // Reset form
    setName("");
    setItemDescription("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setName("");
    setItemDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">{nameLabel}</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-description">{descriptionLabel}</Label>
            <Textarea
              id="item-description"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder={descriptionPlaceholder}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};