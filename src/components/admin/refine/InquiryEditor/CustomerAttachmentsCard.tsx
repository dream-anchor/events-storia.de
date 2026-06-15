import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, ImageIcon, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  useInquiryAttachments,
  type InquiryAttachmentRow,
} from "@/hooks/useInquiryAttachments";
import { formatFileSize } from "@/lib/aiIntake/formatFileSize";

interface Props {
  inquiryId: string;
}

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function sourceLabel(source: string | null): string {
  if (!source) return "–";
  if (source === "ai_intake_bar") return "KI-Anfrage";
  return source;
}

export function CustomerAttachmentsCard({ inquiryId }: Props) {
  const { attachments, loading, error, getSignedUrl } = useInquiryAttachments(inquiryId);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
          Anhänge des Kunden
          {attachments.length > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {attachments.length}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Anhänge werden geladen …</span>
          </div>
        ) : error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground"
          >
            {error}
          </p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Kundenanhänge vorhanden.
          </p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((a) => (
              <AttachmentRow
                key={a.id}
                attachment={a}
                getSignedUrl={getSignedUrl}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default CustomerAttachmentsCard;

interface RowProps {
  attachment: InquiryAttachmentRow;
  getSignedUrl: (id: string) => Promise<string>;
}

function AttachmentRow({ attachment, getSignedUrl }: RowProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"open" | "download" | null>(null);
  const thumbRequested = useRef(false);

  const isImg = isImage(attachment.mime_type);

  // Lazy-load image thumbnail via signed URL (once)
  useEffect(() => {
    if (!isImg || thumbRequested.current) return;
    thumbRequested.current = true;
    let cancelled = false;
    (async () => {
      try {
        const url = await getSignedUrl(attachment.id);
        if (!cancelled) setThumbUrl(url);
      } catch {
        /* silent: row still has Open/Download */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.id, isImg, getSignedUrl]);

  const handleOpen = useCallback(async () => {
    setBusyAction("open");
    try {
      const url = await getSignedUrl(attachment.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Datei konnte nicht geöffnet werden.");
    } finally {
      setBusyAction(null);
    }
  }, [attachment.id, getSignedUrl]);

  const handleDownload = useCallback(async () => {
    setBusyAction("download");
    try {
      const url = await getSignedUrl(attachment.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.original_filename;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error("Download-Link konnte nicht erstellt werden.");
    } finally {
      setBusyAction(null);
    }
  }, [attachment.id, attachment.original_filename, getSignedUrl]);

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {isImg && thumbUrl ? (
          <button
            type="button"
            onClick={handleOpen}
            className="h-full w-full"
            aria-label={`Bild öffnen: ${attachment.original_filename}`}
          >
            <img
              src={thumbUrl}
              alt={attachment.original_filename}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ) : isImg ? (
          <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium text-foreground"
          title={attachment.original_filename}
        >
          {attachment.original_filename}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {(attachment.mime_type || "–") + " · "}
          {formatFileSize(attachment.size_bytes)}
          {" · "}
          {formatDate(attachment.created_at)}
          {" · "}
          {sourceLabel(attachment.source)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full"
            onClick={handleOpen}
            disabled={busyAction !== null}
          >
            {busyAction === "open" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            Öffnen
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-full"
            onClick={handleDownload}
            disabled={busyAction !== null}
          >
            {busyAction === "download" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            Herunterladen
          </Button>
        </div>
      </div>
    </li>
  );
}