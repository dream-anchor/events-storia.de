import { useState, useMemo, useEffect } from "react";
import { MasonryPhotoAlbum } from "react-photo-album";
import "react-photo-album/masonry.css";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, Trash2, Archive, RefreshCw, Pencil, Layers, CheckSquare, X, Link2, Folder, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import {
  usePhotoAlbum,
  useReclassifyPhoto,
  useUpdatePhoto,
  useDeletePhoto,
  useBulkDeletePhotos,
  useBulkArchivePhotos,
  useAssignAsVersions,
  usePhotoVersions,
  useSetCurrentVersion,
  usePhotoVersionCounts,
  type PhotoAlbumEntry,
} from "@/hooks/usePhotoAlbum";
import {
  usePhotoFolders,
  usePhotoFolderItems,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useAddPhotosToFolder,
  useSetPhotoFolders,
  type PhotoFolder,
} from "@/hooks/usePhotoFolders";
import { PhotoDropzone } from "@/components/admin/PhotoDropzone";
import { AdminLayout } from "@/components/admin/refine/AdminLayout";
import {
  PHOTO_CATEGORIES,
  PHOTO_CATEGORY_LABELS,
  PHOTO_TAGS_BY_CATEGORY,
  PHOTO_CROSS_TAGS,
  ALL_PHOTO_TAGS,
} from "@/lib/photoAlbumVocabulary";

type ClassificationNotice = {
  status: "success" | "error";
  title: string;
  details: string;
  timestamp: string;
};

const CLASSIFICATION_NOTICE_STORAGE_KEY = "fotoalbum:lastClassificationNotice";

const readStoredClassificationNotice = (): ClassificationNotice | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(CLASSIFICATION_NOTICE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const Fotoalbum = () => {
  const [category, setCategory] = useState<string | undefined>();
  const [activeTag, setActiveTag] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [editing, setEditing] = useState<PhotoAlbumEntry | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [versionViewerStem, setVersionViewerStem] = useState<PhotoAlbumEntry | null>(null);
  const [folderId, setFolderId] = useState<string | undefined>();
  const [folderDialog, setFolderDialog] = useState<{ mode: "create" | "rename"; id?: string; name?: string } | null>(null);
  const [addToFolderOpen, setAddToFolderOpen] = useState(false);

  const { data: folders } = usePhotoFolders();
  const folderItems = usePhotoFolderItems();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const addPhotosToFolder = useAddPhotosToFolder();
  const setPhotoFoldersMut = useSetPhotoFolders();

  const { data: photos, isLoading, isFetching } = usePhotoAlbum({
    category,
    tags: activeTag ? [activeTag] : undefined,
  });
  const reclassify = useReclassifyPhoto();
  const update = useUpdatePhoto();
  const del = useDeletePhoto();
  const bulkDel = useBulkDeletePhotos();
  const bulkArch = useBulkArchivePhotos();
  const assignVersions = useAssignAsVersions();
  const [reclassifying, setReclassifying] = useState(false);
  const [classificationNotice, setClassificationNotice] = useState<ClassificationNotice | null>(
    () => readStoredClassificationNotice(),
  );

  const saveClassificationNotice = (notice: ClassificationNotice) => {
    setClassificationNotice(notice);
    window.localStorage.setItem(CLASSIFICATION_NOTICE_STORAGE_KEY, JSON.stringify(notice));
  };

  const runReclassify = async () => {
    if (reclassifying) return;
    if (!confirm(
      "Alle Fotos neu von der KI klassifizieren?\n\nKategorie & Tags werden zurückgesetzt und neu erkannt. Das kann mehrere Minuten dauern.",
    )) return;
    setReclassifying(true);
    const toastId = toast.loading("KI klassifiziert alle Fotos neu …");
    try {
      const { data, error } = await supabase.functions.invoke("reclassify-photos", { body: { mode: "all" } });
      if (error) throw error;
      const { processed = 0, ok = 0, failed = 0 } = data ?? {};
      saveClassificationNotice({
        status: failed > 0 ? "error" : "success",
        title: "KI-Klassifizierung abgeschlossen",
        details: `${ok}/${processed} klassifiziert · ${failed} Fehler`,
        timestamp: new Intl.DateTimeFormat("de-DE", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date()),
      });
      toast.success(
        `${ok}/${processed} klassifiziert · ${failed} Fehler`,
        { id: toastId, duration: 8000 },
      );
    } catch (e) {
      console.error(e);
      const message = "Reklassifizierung fehlgeschlagen: " + (e as Error).message;
      saveClassificationNotice({
        status: "error",
        title: "KI-Klassifizierung fehlgeschlagen",
        details: message,
        timestamp: new Intl.DateTimeFormat("de-DE", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date()),
      });
      toast.error(message, { id: toastId });
    } finally {
      setReclassifying(false);
    }
  };

  const filtered = useMemo(() => {
    if (!photos) return [];
    let list = photos;
    if (folderId) {
      const ids = folderItems.photosByFolder.get(folderId);
      list = ids ? list.filter((p) => ids.has(p.id)) : [];
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.filename?.toLowerCase().includes(s) ||
          p.title?.toLowerCase().includes(s) ||
          p.description?.toLowerCase().includes(s) ||
          p.tags.some((t) => t.toLowerCase().includes(s))
      );
    }
    return list;
  }, [photos, search, folderId, folderItems.photosByFolder]);

  const { data: versionCounts } = usePhotoVersionCounts(filtered);

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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const exitSelectMode = () => {
    setSelectMode(false);
    clearSelection();
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} Foto(s) endgültig löschen?`)) return;
    const items = filtered.filter((p) => selected.has(p.id)).map((p) => ({ id: p.id, storage_path: p.storage_path }));
    await bulkDel.mutateAsync(items);
    toast.success(`${items.length} gelöscht`);
    exitSelectMode();
  };
  const handleBulkArchive = async () => {
    if (selected.size === 0) return;
    await bulkArch.mutateAsync(Array.from(selected));
    toast.success(`${selected.size} archiviert`);
    exitSelectMode();
  };

  const handleDeleteFolder = async () => {
    if (!folderId) return;
    const f = (folders ?? []).find((x) => x.id === folderId);
    if (!confirm(`Ordner "${f?.name ?? ""}" löschen? Die Fotos bleiben erhalten.`)) return;
    try {
      await deleteFolder.mutateAsync(folderId);
      toast.success("Ordner gelöscht");
      setFolderId(undefined);
    } catch (e) {
      toast.error("Ordner löschen fehlgeschlagen: " + (e as Error).message);
    }
  };

  const submitFolderDialog = async (name: string) => {
    if (!name.trim()) return;
    try {
      if (folderDialog?.mode === "rename" && folderDialog.id) {
        await updateFolder.mutateAsync({ id: folderDialog.id, name });
        toast.success("Ordner umbenannt");
      } else {
        const created = await createFolder.mutateAsync({ name });
        toast.success("Ordner erstellt");
        setFolderId(created.id);
      }
      setFolderDialog(null);
    } catch (e) {
      toast.error("Ordner speichern fehlgeschlagen: " + (e as Error).message);
    }
  };

  const handleAddSelectedToFolder = async (fid: string) => {
    if (selected.size === 0) return;
    try {
      await addPhotosToFolder.mutateAsync({ folderId: fid, photoIds: Array.from(selected) });
      toast.success(`${selected.size} zu Ordner hinzugefügt`);
      setAddToFolderOpen(false);
      exitSelectMode();
    } catch (e) {
      toast.error("Zu Ordner hinzufügen fehlgeschlagen: " + (e as Error).message);
    }
  };

  return (
    <AdminLayout activeTab="fotos" title="Fotoalbum">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground max-w-xl">
            Zentrale Bildbibliothek. Neue Fotos werden automatisch von der KI in
            Kategorie + Tags einsortiert.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            >
              {selectMode ? <X className="h-3 w-3 mr-2" /> : <CheckSquare className="h-3 w-3 mr-2" />}
              {selectMode ? "Auswahl beenden" : "Auswählen"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={runReclassify}
              disabled={reclassifying}
            >
              {reclassifying
                ? <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                : <Sparkles className="h-3 w-3 mr-2" />}
              KI neu klassifizieren
            </Button>
          </div>
        </div>
        {classificationNotice && (
          <div className="rounded-2xl border border-border bg-card/80 px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{classificationNotice.title}</p>
                <p className="text-sm text-muted-foreground">{classificationNotice.details}</p>
              </div>
              <Badge variant={classificationNotice.status === "success" ? "default" : "destructive"}>
                {classificationNotice.timestamp}
              </Badge>
            </div>
          </div>
        )}
        {folderId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground -mb-2">
            <Folder className="h-3.5 w-3.5" />
            <span>
              Uploads landen automatisch im Ordner{" "}
              <strong className="text-foreground">
                {(folders ?? []).find((f) => f.id === folderId)?.name ?? ""}
              </strong>
            </span>
          </div>
        )}
        <PhotoDropzone targetFolderId={folderId} />

        {/* Filters */}
        <div className="space-y-3">
          <Input
            placeholder="Suche nach Name, Titel oder Tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />

          {/* Ordner (manuelle Ebene neben den KI-Kategorien) */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-muted-foreground mr-1 inline-flex items-center gap-1">
              <Folder className="h-3.5 w-3.5" /> Ordner:
            </span>
            <Badge
              variant={!folderId ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFolderId(undefined)}
            >
              Alle
            </Badge>
            {(folders ?? []).map((f) => (
              <Badge
                key={f.id}
                variant={folderId === f.id ? "default" : "outline"}
                className="cursor-pointer gap-1"
                onClick={() => setFolderId(folderId === f.id ? undefined : f.id)}
              >
                {f.name}
                <span className="opacity-60">{folderItems.countByFolder.get(f.id) ?? 0}</span>
              </Badge>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setFolderDialog({ mode: "create" })}
            >
              <FolderPlus className="h-3 w-3 mr-1" /> Neuer Ordner
            </Button>
            {folderId && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    const f = (folders ?? []).find((x) => x.id === folderId);
                    setFolderDialog({ mode: "rename", id: folderId, name: f?.name });
                  }}
                >
                  Umbenennen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-destructive"
                  onClick={handleDeleteFolder}
                >
                  Löschen
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Badge
              variant={!category ? "default" : "outline"}
              className="cursor-pointer gap-1"
              onClick={() => { setCategory(undefined); setActiveTag(undefined); }}
            >
              Alle Kategorien
              {!category && isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
            </Badge>
            {PHOTO_CATEGORIES.map((c) => (
              <Badge
                key={c}
                variant={category === c ? "default" : "outline"}
                className="cursor-pointer gap-1"
                onClick={() => { setCategory(c); setActiveTag(undefined); }}
              >
                {PHOTO_CATEGORY_LABELS[c]}
                {category === c && isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeTag && (
              <Badge
                variant="default"
                className="cursor-pointer gap-1"
                onClick={() => setActiveTag(undefined)}
              >
                #{activeTag}
                {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>✕</span>}
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

          <div className="flex items-center gap-2 text-xs text-muted-foreground min-h-5">
            {isFetching && !isLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Lade Fotos …</span>
              </>
            ) : (
              <span>{filtered.length} Foto{filtered.length === 1 ? "" : "s"}</span>
            )}
          </div>
        </div>

        {/* Gallery */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-muted/60 animate-pulse"
                style={{ aspectRatio: i % 3 === 0 ? "3/4" : i % 3 === 1 ? "4/3" : "1/1" }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground rounded-2xl border border-dashed border-border">
            Noch keine Fotos. Zieh Dateien in den Bereich oben.
          </div>
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <MasonryPhotoAlbum
            photos={slides}
            columns={(width) => (width < 640 ? 2 : width < 1024 ? 3 : 4)}
            onClick={({ index }) => {
              const p = filtered[index];
              if (selectMode) {
                toggleSelect(p.id);
                return;
              }
              const stem = p.parent_photo_id ?? p.id;
              if ((versionCounts?.[stem] ?? 1) > 1) {
                setVersionViewerStem(p);
              } else {
                setLightboxIndex(index);
              }
            }}
            render={{
              extras: (_, { index }) => {
                const p = filtered[index];
                const stem = p.parent_photo_id ?? p.id;
                const vc = versionCounts?.[stem] ?? 1;
                const isSelected = selected.has(p.id);
                return (
                  <>
                    {/* Selection ring (always-on when selected) */}
                    {isSelected && (
                      <div className="absolute inset-0 rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background pointer-events-none" />
                    )}

                    {/* Persistent top-right badges (always visible) */}
                    <div className="absolute top-2 right-2 flex gap-1 pointer-events-none">
                      {vc > 1 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-card/85 backdrop-blur-md border border-border px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
                          <Layers className="h-3 w-3" /> {vc}
                        </span>
                      )}
                      {!p.ai_classified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-card/85 backdrop-blur-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                          <Sparkles className="h-3 w-3" /> KI…
                        </span>
                      )}
                    </div>

                    {/* Selection checkbox (top-left, only in select mode) */}
                    {selectMode && (
                      <div
                        className="absolute top-2 left-2 h-6 w-6 rounded-md bg-background/95 border border-border flex items-center justify-center pointer-events-auto cursor-pointer shadow-sm"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                      >
                        <Checkbox checked={isSelected} />
                      </div>
                    )}

                    {/* Persistent bottom meta + actions (category left, pencil right) */}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2 pointer-events-none bg-gradient-to-t from-black/55 via-black/10 to-transparent rounded-b-xl">
                      <div className="flex flex-wrap gap-1 pointer-events-none">
                        {p.category && (
                          <span className="inline-flex items-center rounded-full bg-card/85 backdrop-blur-md border border-border px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
                            {PHOTO_CATEGORY_LABELS[p.category] ?? p.category}
                          </span>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 pointer-events-auto shadow-sm"
                        onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                        aria-label="Foto bearbeiten"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                );
              },
            }}
          />
          </div>
        )}

        <Lightbox
          open={lightboxIndex >= 0}
          index={lightboxIndex}
          close={() => setLightboxIndex(-1)}
          slides={slides}
        />
      </div>

      {/* Bulk selection toolbar */}
      {selectMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">
            {selected.size} ausgewählt
          </span>
          <div className="h-5 w-px bg-border" />
          <Button size="sm" variant="outline" disabled={selected.size === 0} onClick={handleBulkArchive}>
            <Archive className="h-3 w-3 mr-2" /> Archivieren
          </Button>
          <Button size="sm" variant="outline" disabled={selected.size === 0} onClick={() => setAddToFolderOpen(true)}>
            <Folder className="h-3 w-3 mr-2" /> Zu Ordner
          </Button>
          <Button size="sm" variant="outline" disabled={selected.size < 2} onClick={() => setAssignDialogOpen(true)}>
            <Link2 className="h-3 w-3 mr-2" /> Als Versionen zuordnen
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" disabled={selected.size === 0} onClick={handleBulkDelete}>
            <Trash2 className="h-3 w-3 mr-2" /> Löschen
          </Button>
        </div>
      )}

      {/* Assign-as-versions dialog */}
      <AssignVersionsDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        selectedIds={Array.from(selected)}
        photos={filtered}
        onDone={async (targetId, photoIds) => {
          await assignVersions.mutateAsync({ targetId, photoIds });
          toast.success("Als Versionen zugeordnet");
          setAssignDialogOpen(false);
          exitSelectMode();
        }}
      />

      {/* Version viewer */}
      <VersionViewerDialog
        photo={versionViewerStem}
        onClose={() => setVersionViewerStem(null)}
      />

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto bearbeiten</DialogTitle>
          </DialogHeader>
          {editing && (
            <EditForm
              photo={editing}
              allPhotos={filtered}
              folders={folders ?? []}
              initialFolderIds={[...(folderItems.foldersByPhoto.get(editing.id) ?? [])]}
              onSave={async (patch, folderIds) => {
                await update.mutateAsync({ id: editing.id, patch });
                await setPhotoFoldersMut.mutateAsync({ photoId: editing.id, folderIds });
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

      {/* Ordner anlegen / umbenennen */}
      <FolderNameDialog
        state={folderDialog}
        onClose={() => setFolderDialog(null)}
        onSubmit={submitFolderDialog}
      />

      {/* Auswahl zu Ordner hinzufügen */}
      <AddToFolderDialog
        open={addToFolderOpen}
        onOpenChange={setAddToFolderOpen}
        folders={folders ?? []}
        count={selected.size}
        onPick={handleAddSelectedToFolder}
        onCreate={async (name) => {
          try {
            const created = await createFolder.mutateAsync({ name });
            await handleAddSelectedToFolder(created.id);
          } catch (e) {
            toast.error("Ordner anlegen fehlgeschlagen: " + (e as Error).message);
          }
        }}
      />
    </AdminLayout>
  );
};

// ---------- Ordner-Name-Dialog (anlegen/umbenennen) ----------
const FolderNameDialog = ({
  state,
  onClose,
  onSubmit,
}: {
  state: { mode: "create" | "rename"; id?: string; name?: string } | null;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) => {
  const [name, setName] = useState("");
  useEffect(() => {
    setName(state?.name ?? "");
  }, [state]);

  const submit = async () => {
    if (!name.trim()) return;
    await onSubmit(name);
  };

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{state?.mode === "rename" ? "Ordner umbenennen" : "Neuer Ordner"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="z.B. Webseite-Hero, Firmenevent 2024"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={submit} disabled={!name.trim()}>
            {state?.mode === "rename" ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Auswahl zu Ordner hinzufügen ----------
const AddToFolderDialog = ({
  open,
  onOpenChange,
  folders,
  count,
  onPick,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folders: PhotoFolder[];
  count: number;
  onPick: (folderId: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
}) => {
  const [newName, setNewName] = useState("");
  useEffect(() => { if (!open) setNewName(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{count} Foto{count === 1 ? "" : "s"} zu Ordner hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {folders.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {folders.map((f) => (
                <Badge
                  key={f.id}
                  variant="outline"
                  className="cursor-pointer gap-1"
                  onClick={() => onPick(f.id)}
                >
                  <Folder className="h-3 w-3" /> {f.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Ordner. Lege unten einen an.</p>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) onCreate(newName); }}
              placeholder="Neuen Ordner anlegen…"
            />
            <Button size="sm" disabled={!newName.trim()} onClick={() => onCreate(newName)}>
              <FolderPlus className="h-3 w-3 mr-1" /> Anlegen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface EditFormProps {
  photo: PhotoAlbumEntry;
  allPhotos: PhotoAlbumEntry[];
  folders: PhotoFolder[];
  initialFolderIds: string[];
  onSave: (patch: Partial<PhotoAlbumEntry>, folderIds: string[]) => Promise<void>;
  onReclassify: () => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const EditForm = ({ photo, allPhotos, folders, initialFolderIds, onSave, onReclassify, onArchive, onDelete }: EditFormProps) => {
  const [category, setCategory] = useState(photo.category ?? "");
  const [tags, setTags] = useState<string[]>(photo.tags);
  const [title, setTitle] = useState(photo.title ?? "");
  const [description, setDescription] = useState(photo.description ?? "");
  const [folderIds, setFolderIds] = useState<string[]>(initialFolderIds);
  const [showVersions, setShowVersions] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: versions } = usePhotoVersions(photo);
  const setCurrent = useSetCurrentVersion();
  const del = useDeletePhoto();
  const assign = useAssignAsVersions();

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
        <Label className="flex items-center gap-1"><Folder className="h-3.5 w-3.5" /> Ordner</Label>
        {folders.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {folders.map((f) => {
              const active = folderIds.includes(f.id);
              return (
                <Badge
                  key={f.id}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                  onClick={() =>
                    setFolderIds((prev) =>
                      prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                    )
                  }
                >
                  {f.name}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Noch keine Ordner angelegt. Lege oben in der Bibliothek einen Ordner an.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Titel / Alt-Text</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Beschreibung</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {/* Versioning */}
      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            Versionen ({versions?.length ?? 1})
          </Label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              Als Version von…
            </Button>
            {(versions?.length ?? 1) > 1 && (
              <Button type="button" size="sm" variant="outline" onClick={() => setShowVersions((s) => !s)}>
                {showVersions ? "Verbergen" : "Anzeigen"}
              </Button>
            )}
          </div>
        </div>
        {showVersions && versions && versions.length > 1 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {versions.map((v) => (
              <div key={v.id} className="relative rounded-lg overflow-hidden border border-border bg-muted">
                <img src={v.url} alt="" className="w-full aspect-square object-cover" />
                <div className="absolute top-1 left-1">
                  <Badge variant={v.is_current ? "default" : "secondary"} className="text-[10px]">
                    v{v.version}{v.is_current ? " · aktuell" : ""}
                  </Badge>
                </div>
                {!v.is_current && (
                  <div className="absolute bottom-1 inset-x-1 flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-6 text-[10px] flex-1"
                      onClick={async () => {
                        await setCurrent.mutateAsync(v);
                        toast.success(`v${v.version} ist jetzt aktuell`);
                      }}
                    >
                      Aktuell
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6 text-destructive"
                      onClick={async () => {
                        if (!confirm(`Version v${v.version} löschen?`)) return;
                        await del.mutateAsync({ id: v.id, storage_path: v.storage_path });
                        toast.success("Version gelöscht");
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <PhotoPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        photos={allPhotos.filter((p) => p.id !== photo.id)}
        onPick={async (target) => {
          await assign.mutateAsync({ targetId: target.id, photoIds: [photo.id] });
          toast.success(`Als neue Version von "${target.title || target.filename || "Foto"}" zugeordnet`);
          setPickerOpen(false);
        }}
      />

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
        <Button onClick={() => onSave({ category: category || null, tags, title: title || null, description: description || null }, folderIds)}>
          Speichern
        </Button>
      </DialogFooter>
    </div>
  );
};

// ---------- Photo Picker (search) ----------
const PhotoPickerDialog = ({
  open,
  onOpenChange,
  photos,
  onPick,
  title = "Ziel-Foto wählen",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  photos: PhotoAlbumEntry[];
  onPick: (photo: PhotoAlbumEntry) => void;
  title?: string;
}) => {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    if (!q) return photos.slice(0, 60);
    const s = q.toLowerCase();
    return photos
      .filter(
        (p) =>
          p.filename?.toLowerCase().includes(s) ||
          p.title?.toLowerCase().includes(s) ||
          p.category?.toLowerCase().includes(s) ||
          p.tags.some((t) => t.toLowerCase().includes(s))
      )
      .slice(0, 60);
  }, [q, photos]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto">
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              className="relative aspect-square rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-foreground transition"
              onClick={() => onPick(p)}
            >
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                <p className="text-[10px] text-white truncate">{p.title || p.filename}</p>
              </div>
            </button>
          ))}
          {list.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-8">Keine Treffer</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Assign Bulk → Versions of one target ----------
const AssignVersionsDialog = ({
  open,
  onOpenChange,
  selectedIds,
  photos,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selectedIds: string[];
  photos: PhotoAlbumEntry[];
  onDone: (targetId: string, photoIds: string[]) => Promise<void>;
}) => {
  const selectedPhotos = photos.filter((p) => selectedIds.includes(p.id));
  const candidates = selectedPhotos; // pick the stem from the selection
  const [targetId, setTargetId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Als Versionen zuordnen</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Wähle das <strong>aktuelle (neueste) Foto</strong>. Alle anderen markierten Fotos werden als ältere Versionen
          angehängt.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
          {candidates.map((p) => {
            const sel = targetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setTargetId(p.id)}
                className={
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition " +
                  (sel ? "border-foreground ring-2 ring-foreground" : "border-border hover:border-foreground/40")
                }
              >
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                {sel && (
                  <Badge className="absolute top-1 right-1 text-[10px]">Neueste</Badge>
                )}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            disabled={!targetId}
            onClick={() => targetId && onDone(targetId, selectedIds)}
          >
            Zuordnen ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Version Viewer (lightbox per stem) ----------
const VersionViewerDialog = ({
  photo,
  onClose,
}: {
  photo: PhotoAlbumEntry | null;
  onClose: () => void;
}) => {
  const { data: versions } = usePhotoVersions(photo);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [photo?.id]);
  if (!photo) return null;
  const list = versions ?? [photo];
  const current = list[idx] ?? list[0];
  return (
    <Dialog open={!!photo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Versionen ({list.length})
          </DialogTitle>
        </DialogHeader>
        {current && (
          <div className="space-y-3">
            <div className="relative bg-muted rounded-xl overflow-hidden flex items-center justify-center">
              <img src={current.url} alt="" className="max-h-[60vh] object-contain" />
              <Badge className="absolute top-2 left-2">
                v{current.version}{current.is_current ? " · aktuell" : ""}
              </Badge>
              <div className="absolute bottom-2 right-2 text-xs text-white/90 bg-black/50 rounded px-2 py-1">
                {new Date(current.created_at).toLocaleDateString("de-DE", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {list.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={
                    "relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition " +
                    (i === idx ? "border-foreground" : "border-border hover:border-foreground/40")
                  }
                >
                  <img src={v.url} alt="" className="w-full h-full object-cover" />
                  <Badge variant={v.is_current ? "default" : "secondary"} className="absolute bottom-0.5 left-0.5 text-[9px] px-1">
                    v{v.version}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Fotoalbum;