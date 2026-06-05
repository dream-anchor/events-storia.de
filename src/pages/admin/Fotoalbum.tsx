import { useState, useMemo } from "react";
import { MasonryPhotoAlbum } from "react-photo-album";
import "react-photo-album/masonry.css";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, Trash2, Archive, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  usePhotoAlbum,
  useReclassifyPhoto,
  useUpdatePhoto,
  useDeletePhoto,
  type PhotoAlbumEntry,
} from "@/hooks/usePhotoAlbum";
import { PhotoDropzone } from "@/components/admin/PhotoDropzone";
import {
  PHOTO_CATEGORIES,
  PHOTO_CATEGORY_LABELS,
  PHOTO_TAGS_BY_CATEGORY,
  PHOTO_CROSS_TAGS,
  ALL_PHOTO_TAGS,
} from "@/lib/photoAlbumVocabulary";

const Fotoalbum = () => {
  const [category, setCategory] = useState<string | undefined>();
  const [activeTag, setActiveTag] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [editing, setEditing] = useState<PhotoAlbumEntry | null>(null);

  const { data: photos, isLoading } = usePhotoAlbum({
    category,
    tags: activeTag ? [activeTag] : undefined,
  });
  const reclassify = useReclassifyPhoto();
  const update = useUpdatePhoto();
  const del = useDeletePhoto();

  const filtered = useMemo(() => {
    if (!photos) return [];
    if (!search) return photos;
    const s = search.toLowerCase();
    return photos.filter(
      (p) =>
        p.filename?.toLowerCase().includes(s) ||
        p.title?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s) ||
        p.tags.some((t) => t.toLowerCase().includes(s))
    );
  }, [photos, search]);

  const slides = useMemo(
    () =>
      filtered.map((p) => ({
        src: p.url,
        width: p.width ?? 1200,
        height: p.height ?? 800,
        alt: p.title || p.filename || "",
      })),
    [filtered]
  );

  const availableTags = category && PHOTO_TAGS_BY_CATEGORY[category]
    ? [...PHOTO_TAGS_BY_CATEGORY[category], ...PHOTO_CROSS_TAGS]
    : ALL_PHOTO_TAGS;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-semibold">Fotoalbum</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Zentrale Bildbibliothek. Neue Fotos werden automatisch von der KI in
              Kategorie + Tags einsortiert.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <PhotoDropzone />

        {/* Filters */}
        <div className="space-y-3">
          <Input
            placeholder="Suche nach Name, Titel oder Tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={!category ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => { setCategory(undefined); setActiveTag(undefined); }}
            >
              Alle Kategorien
            </Badge>
            {PHOTO_CATEGORIES.map((c) => (
              <Badge
                key={c}
                variant={category === c ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => { setCategory(c); setActiveTag(undefined); }}
              >
                {PHOTO_CATEGORY_LABELS[c]}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeTag && (
              <Badge
                variant="default"
                className="cursor-pointer"
                onClick={() => setActiveTag(undefined)}
              >
                #{activeTag} ✕
              </Badge>
            )}
            {!activeTag &&
              availableTags.slice(0, 30).map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer text-xs"
                  onClick={() => setActiveTag(t)}
                >
                  #{t}
                </Badge>
              ))}
          </div>
        </div>

        {/* Gallery */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Keine Fotos – lade welche hoch.
          </div>
        ) : (
          <MasonryPhotoAlbum
            photos={slides}
            columns={(width) => (width < 640 ? 2 : width < 1024 ? 3 : 4)}
            onClick={({ index }) => setLightboxIndex(index)}
            render={{
              extras: (_, { index }) => {
                const p = filtered[index];
                return (
                  <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-b from-black/40 via-transparent to-black/60">
                    <div className="flex flex-wrap gap-1 pointer-events-auto">
                      {p.category && (
                        <Badge className="text-[10px]">
                          {PHOTO_CATEGORY_LABELS[p.category] ?? p.category}
                        </Badge>
                      )}
                      {!p.ai_classified && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Sparkles className="h-3 w-3 mr-1" /> klassifiziert…
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-end gap-1 pointer-events-auto">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              },
            }}
          />
        )}

        <Lightbox
          open={lightboxIndex >= 0}
          index={lightboxIndex}
          close={() => setLightboxIndex(-1)}
          slides={slides}
        />
      </main>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto bearbeiten</DialogTitle>
          </DialogHeader>
          {editing && (
            <EditForm
              photo={editing}
              onSave={async (patch) => {
                await update.mutateAsync({ id: editing.id, patch });
                toast.success("Gespeichert");
                setEditing(null);
              }}
              onReclassify={async () => {
                await reclassify.mutateAsync({ id: editing.id, url: editing.url });
                toast.success("KI klassifiziert erneut…");
              }}
              onArchive={async () => {
                await update.mutateAsync({ id: editing.id, patch: { is_archived: true } });
                toast.success("Archiviert");
                setEditing(null);
              }}
              onDelete={async () => {
                if (!confirm("Foto endgültig löschen?")) return;
                await del.mutateAsync({ id: editing.id, storage_path: editing.storage_path });
                toast.success("Gelöscht");
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface EditFormProps {
  photo: PhotoAlbumEntry;
  onSave: (patch: Partial<PhotoAlbumEntry>) => Promise<void>;
  onReclassify: () => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const EditForm = ({ photo, onSave, onReclassify, onArchive, onDelete }: EditFormProps) => {
  const [category, setCategory] = useState(photo.category ?? "");
  const [tags, setTags] = useState<string[]>(photo.tags);
  const [title, setTitle] = useState(photo.title ?? "");
  const [description, setDescription] = useState(photo.description ?? "");

  const tagOptions = category && PHOTO_TAGS_BY_CATEGORY[category]
    ? [...PHOTO_TAGS_BY_CATEGORY[category], ...PHOTO_CROSS_TAGS]
    : ALL_PHOTO_TAGS;

  return (
    <div className="space-y-4">
      <img src={photo.url} alt="" className="max-h-64 mx-auto rounded-xl" />

      <div className="space-y-2">
        <Label>Kategorie</Label>
        <div className="flex flex-wrap gap-2">
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

      <div className="space-y-2">
        <Label>Tags ({tags.length}/5)</Label>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {tagOptions.map((t) => {
            const selected = tags.includes(t);
            return (
              <Badge
                key={t}
                variant={selected ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => {
                  if (selected) setTags(tags.filter((x) => x !== t));
                  else if (tags.length < 5) setTags([...tags, t]);
                }}
              >
                {t}
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Titel / Alt-Text</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Beschreibung</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <DialogFooter className="flex-wrap gap-2 sm:justify-between">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReclassify}>
            <RefreshCw className="h-3 w-3 mr-1" /> KI neu
          </Button>
          <Button variant="outline" size="sm" onClick={onArchive}>
            <Archive className="h-3 w-3 mr-1" /> Archivieren
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3 mr-1" /> Löschen
          </Button>
        </div>
        <Button onClick={() => onSave({ category: category || null, tags, title: title || null, description: description || null })}>
          Speichern
        </Button>
      </DialogFooter>
    </div>
  );
};

export default Fotoalbum;