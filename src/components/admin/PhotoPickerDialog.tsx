import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePhotoAlbum } from "@/hooks/usePhotoAlbum";
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_LABELS } from "@/lib/photoAlbumVocabulary";
import { Loader2 } from "lucide-react";

interface PhotoPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  defaultCategory?: string;
}

export const PhotoPickerDialog = ({ open, onOpenChange, onSelect, defaultCategory }: PhotoPickerDialogProps) => {
  const [category, setCategory] = useState<string | undefined>(defaultCategory);
  const [search, setSearch] = useState("");
  const { data: photos, isLoading } = usePhotoAlbum({ category });

  const filtered = (photos ?? []).filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.filename?.toLowerCase().includes(s) ||
      p.title?.toLowerCase().includes(s) ||
      p.tags.some((t) => t.toLowerCase().includes(s))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Foto aus Album wählen</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Suche nach Name, Titel oder Tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={!category ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategory(undefined)}
            >
              Alle
            </Badge>
            {PHOTO_CATEGORIES.map((c) => (
              <Badge
                key={c}
                variant={category === c ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategory(c)}
              >
                {PHOTO_CATEGORY_LABELS[c]}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Keine Fotos gefunden.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.url);
                    onOpenChange(false);
                  }}
                  className="group relative aspect-square rounded-2xl overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all"
                >
                  <img
                    src={p.url}
                    alt={p.title || p.filename || ""}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {p.category && (
                    <div className="absolute top-2 left-2">
                      <Badge className="text-[10px]">{PHOTO_CATEGORY_LABELS[p.category] ?? p.category}</Badge>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoPickerDialog;