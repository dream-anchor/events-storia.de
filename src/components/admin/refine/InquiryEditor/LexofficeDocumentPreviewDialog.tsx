import { useEffect, useState } from "react";
import { Loader2, Download, Ban, ExternalLink, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  useDownloadLexOfficeDocument,
  type OrderLexDoc,
} from "@/hooks/useLexOfficeVouchers";

interface Props {
  doc: OrderLexDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestVoid?: (doc: OrderLexDoc) => void;
}

const KIND_LABEL: Record<OrderLexDoc["kind"], string> = {
  quotation: "Angebot",
  deposit: "Anzahlungsrechnung",
  standard: "Rechnung",
  final: "Schlussrechnung",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  open: "Offen",
  paid: "Bezahlt",
  voided: "Storniert",
  overdue: "Überfällig",
  unknown: "Unbekannt",
  error: "Fehler",
};

function fmtDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function LexofficeDocumentPreviewDialog({ doc, open, onOpenChange, onRequestVoid }: Props) {
  const download = useDownloadLexOfficeDocument();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !doc) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setBlobUrl(null);
    (async () => {
      try {
        const res: any = await download.mutateAsync({
          voucherId: doc.id,
          voucherType: doc.type,
        });
        const base64 = res?.pdf || res?.pdf_base64;
        if (!base64) throw new Error("PDF nicht verfügbar");
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: "application/pdf" });
        createdUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          return;
        }
        setBlobUrl(createdUrl);
        setFilename(res?.filename || `${KIND_LABEL[doc.kind]}_${doc.number ?? doc.id}.pdf`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Vorschau fehlgeschlagen");
        onOpenChange(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc?.id, doc?.type]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "beleg.pdf";
    a.click();
  };

  const handleOpenTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank", "noopener");
  };

  const isVoided = doc?.status === "voided";
  const canVoid = doc?.type === "invoice" && !isVoided;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-base font-medium">
            <span>{doc ? KIND_LABEL[doc.kind] : ""}</span>
            {doc?.number && (
              <span className="text-muted-foreground font-normal">{doc.number}</span>
            )}
            {doc?.status && (
              <Badge variant={isVoided ? "outline" : "secondary"} className="text-[10px]">
                {STATUS_LABEL[doc.status] ?? doc.status}
              </Badge>
            )}
            {doc && (() => {
              const sends = doc.sends ?? [];
              if (sends.length === 0) {
                return (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Nicht versendet
                  </Badge>
                );
              }
              const last = sends[0];
              const pill = (
                <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                  <Send className="h-2.5 w-2.5" />
                  Versendet · {fmtDateTime(last.sent_at)}
                  {sends.length > 1 && <span className="opacity-60">× {sends.length}</span>}
                </Badge>
              );
              return (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">{pill}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="max-w-xs">
                      <div className="text-xs font-medium mb-1">Versand-Historie</div>
                      <ul className="space-y-0.5">
                        {sends.map((s, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground">
                            {fmtDateTime(s.sent_at)} → {s.to || "—"}
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 bg-muted/40 min-h-0">
          {loading || !blobUrl ? (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              PDF wird geladen…
            </div>
          ) : (
            <iframe
              src={blobUrl}
              title={filename || "PDF"}
              className="w-full h-full border-0"
            />
          )}
        </div>

        <div className="px-6 py-3 border-t flex items-center justify-between gap-2 bg-background">
          <div className="flex items-center gap-2">
            {canVoid && onRequestVoid && doc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRequestVoid(doc);
                  onOpenChange(false);
                }}
                className="text-destructive hover:text-destructive"
              >
                <Ban className="h-4 w-4 mr-1.5" />
                Stornieren
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleOpenTab} disabled={!blobUrl}>
              <ExternalLink className="h-4 w-4 mr-1.5" />
              In neuem Tab
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!blobUrl}>
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}