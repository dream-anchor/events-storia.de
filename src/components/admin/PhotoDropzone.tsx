import { useCallback, useEffect, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, Loader2, CheckCircle2, AlertCircle, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUploadPhoto } from "@/hooks/usePhotoAlbum";

type ItemStatus = "queued" | "uploading" | "done" | "error";

interface QueueItem {
  id: string;
  file: File;
  preview: string;
  status: ItemStatus;
  error?: string;
}

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_PARALLEL = 3;

interface PhotoDropzoneProps {
  className?: string;
}

export const PhotoDropzone = ({ className }: PhotoDropzoneProps) => {
  const upload = useUploadPhoto();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [globalDrag, setGlobalDrag] = useState(false);

  useEffect(() => {
    return () => {
      items.forEach((i) => URL.revokeObjectURL(i.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fullscreen drop overlay when dragging files anywhere on the page
  useEffect(() => {
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      setGlobalDrag(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setGlobalDrag(false);
    };
    const onDrop = () => {
      depth = 0;
      setGlobalDrag(false);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const processQueue = useCallback(
    async (newItems: QueueItem[]) => {
      const queue = [...newItems];
      const workers = Array.from({ length: MAX_PARALLEL }, async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "uploading" } : p)));
          try {
            await upload.mutateAsync(item.file);
            setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "done" } : p)));
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Fehler";
            setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", error: msg } : p)));
            toast.error(`${item.file.name}: ${msg}`);
          }
        }
      });
      await Promise.all(workers);

      const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
        setItems((prev) => {
          prev.filter((p) => p.status === "done").forEach((p) => URL.revokeObjectURL(p.preview));
          return prev.filter((p) => p.status !== "done");
        });
      }, 4000);
      return () => clearTimeout(timer);
    },
    [upload]
  );

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      rejections.forEach((r) => {
        const code = r.errors[0]?.code;
        const reason =
          code === "file-too-large"
            ? "über 20 MB"
            : code === "file-invalid-type"
              ? "kein unterstütztes Bildformat"
              : (r.errors[0]?.message ?? "ungültig");
        toast.error(`${r.file.name}: ${reason}`);
      });
      if (accepted.length === 0) return;
      const newItems: QueueItem[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
        status: "queued",
      }));
      setItems((prev) => [...prev, ...newItems]);
      void processQueue(newItems);
    },
    [processQueue]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
      "image/avif": [],
    },
    maxSize: MAX_SIZE,
    multiple: true,
  });

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const activeCount = items.filter((i) => i.status === "uploading" || i.status === "queued").length;

  return (
    <>
      <div className={className}>
        <div
          {...getRootProps()}
          className={cn(
            "group relative rounded-2xl border-2 border-dashed transition-all cursor-pointer",
            "bg-card/60 backdrop-blur-sm",
            isDragActive
              ? "border-foreground bg-foreground/5 scale-[1.005]"
              : "border-border hover:border-foreground/40 hover:bg-card"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex items-center gap-4 px-5 py-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                isDragActive ? "bg-foreground text-background" : "bg-muted text-foreground"
              )}
            >
              <Upload className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {isDragActive ? "Loslassen zum Hochladen" : "Fotos hierher ziehen oder klicken"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPG, PNG, WebP, AVIF · bis 20 MB · Mehrfachauswahl · KI klassifiziert automatisch
              </p>
            </div>
            {activeCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                <Loader2 className="h-3 w-3 animate-spin" />
                {activeCount} in Warteschlange
              </div>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative group/item aspect-square rounded-xl overflow-hidden border border-border bg-muted"
              >
                <img src={item.preview} alt="" className="w-full h-full object-cover" />
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity",
                    item.status === "done" ? "bg-foreground/10" : "bg-foreground/50"
                  )}
                >
                  {item.status === "queued" && (
                    <span className="text-[10px] font-medium text-background">Warteschlange…</span>
                  )}
                  {item.status === "uploading" && (
                    <>
                      <Loader2 className="h-5 w-5 text-background animate-spin" />
                      <span className="text-[10px] font-medium text-background">Lädt hoch…</span>
                    </>
                  )}
                  {item.status === "done" && (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-background" />
                      <span className="text-[10px] font-medium text-background flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> KI klassifiziert
                      </span>
                    </>
                  )}
                  {item.status === "error" && (
                    <>
                      <AlertCircle className="h-5 w-5 text-background" />
                      <span className="text-[10px] font-medium text-background px-2 text-center">
                        {item.error ?? "Fehler"}
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 hover:bg-background flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"
                  aria-label="Aus Liste entfernen"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-gradient-to-t from-foreground/80 to-transparent">
                  <p className="text-[10px] text-background truncate">{item.file.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {globalDrag && (
        <div
          {...getRootProps({
            className:
              "fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md",
          })}
        >
          <input {...getInputProps()} />
          <div className="rounded-3xl border-2 border-dashed border-foreground bg-card px-12 py-16 text-center shadow-2xl pointer-events-none">
            <Upload className="h-12 w-12 mx-auto mb-4 text-foreground" />
            <p className="text-xl font-semibold">Fotos hier ablegen</p>
            <p className="text-sm text-muted-foreground mt-2">Die KI sortiert sie automatisch ein</p>
          </div>
        </div>
      )}
    </>
  );
};

export default PhotoDropzone;