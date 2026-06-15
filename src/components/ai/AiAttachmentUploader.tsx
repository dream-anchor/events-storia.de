import { useCallback, useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiAttachmentDraft, AiIntakeLanguage } from "@/lib/aiIntake/types";
import { AI_MAX_FILES, AI_MAX_TOTAL_BYTES } from "@/lib/aiIntake/types";

interface Props {
  attachments: AiAttachmentDraft[];
  totalSize: number;
  language: AiIntakeLanguage;
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AiAttachmentUploader({
  attachments,
  totalSize,
  language,
  onAdd,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      if (e.dataTransfer?.files?.length) onAdd(e.dataTransfer.files);
    },
    [onAdd],
  );

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-5 text-center transition-colors",
          drag
            ? "border-foreground bg-muted/60"
            : "border-border bg-muted/30 hover:bg-muted/50",
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-foreground">
          {language === "de"
            ? "Dateien hierher ziehen oder auswählen"
            : "Drag files here or browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          {language === "de"
            ? "JPG, PNG, WEBP, PDF, DOC, DOCX · max. 15 MB pro Datei · max. 10 Dateien"
            : "JPG, PNG, WEBP, PDF, DOC, DOCX · max 15 MB per file · max 10 files"}
        </p>
        <div className="mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="rounded-full"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            <span>{language === "de" ? "Datei auswählen" : "Choose file"}</span>
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-label={language === "de" ? "Dateien hochladen" : "Upload files"}
            onChange={(e) => {
              if (e.target.files?.length) onAdd(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {attachments.map((a) => {
            const isImage = a.mime.startsWith("image/");
            const isError = a.status === "error";
            return (
              <li
                key={a.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border bg-background px-2.5 py-2",
                  isError ? "border-destructive/40" : "border-border",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {isImage && a.previewUrl ? (
                    <img
                      src={a.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : isImage ? (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground" title={a.file.name}>
                    {a.file.name}
                  </p>
                  <p
                    className={cn(
                      "truncate text-xs",
                      isError ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {isError
                      ? a.errorMessage
                      : `${formatBytes(a.size)} · ${a.ext.toUpperCase()}${
                          a.status === "uploading"
                            ? language === "de"
                              ? " · wird hochgeladen"
                              : " · uploading"
                            : a.status === "uploaded"
                              ? language === "de"
                                ? " · hochgeladen"
                                : " · uploaded"
                              : language === "de"
                                ? " · bereit"
                                : " · ready"
                        }`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => onRemove(a.id)}
                  aria-label={
                    language === "de"
                      ? `Datei ${a.file.name} entfernen`
                      : `Remove file ${a.file.name}`
                  }
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="text-right text-xs text-muted-foreground">
        {attachments.length}/{AI_MAX_FILES} ·{" "}
        {formatBytes(totalSize)} / {formatBytes(AI_MAX_TOTAL_BYTES)}
      </p>
    </div>
  );
}