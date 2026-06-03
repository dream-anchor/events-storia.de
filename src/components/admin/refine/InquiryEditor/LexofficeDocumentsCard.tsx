import { useState } from "react";
import { FileText, Eye, Download, Ban, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useOrderLexofficeDocuments,
  useVoidLexofficeInvoice,
  useDownloadLexOfficeDocument,
  type OrderLexDoc,
} from "@/hooks/useLexOfficeVouchers";

interface Props {
  orderId: string;
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

function fmtMoney(v: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function LexofficeDocumentsCard({ orderId }: Props) {
  const { data, isLoading, refetch, isFetching } = useOrderLexofficeDocuments(orderId);
  const voidMutation = useVoidLexofficeInvoice();
  const downloadMutation = useDownloadLexOfficeDocument();
  const [confirmVoid, setConfirmVoid] = useState<OrderLexDoc | null>(null);

  const docs = data?.docs ?? [];

  const openPdf = async (doc: OrderLexDoc, mode: "view" | "download") => {
    try {
      const res: any = await downloadMutation.mutateAsync({
        voucherId: doc.id,
        voucherType: doc.type,
      });
      const base64 = res?.pdf || res?.pdf_base64;
      if (!base64) {
        toast.error("PDF nicht verfügbar");
        return;
      }
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (mode === "view") {
        window.open(url, "_blank", "noopener");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = res?.filename || `${KIND_LABEL[doc.kind]}_${doc.number ?? doc.id}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download fehlgeschlagen");
    }
  };

  const handleVoid = async () => {
    if (!confirmVoid) return;
    try {
      const res: any = await voidMutation.mutateAsync({
        orderId,
        voucherId: confirmVoid.id,
      });
      toast.success(
        res?.action === "credit_noted"
          ? "Gutschrift in LexOffice erstellt"
          : "Rechnung storniert",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Storno fehlgeschlagen");
    } finally {
      setConfirmVoid(null);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Belege
          {docs.length > 0 && (
            <Badge variant="secondary" className="ml-1">{docs.length}</Badge>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Belege werden geladen…
          </div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Noch keine LexOffice-Belege für diesen Auftrag.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => {
              const isVoided = d.status === "voided";
              const canVoid = d.type === "invoice" && !isVoided;
              return (
                <li
                  key={`${d.type}:${d.id}`}
                  className={cn(
                    "flex flex-wrap items-center gap-3 py-3",
                    isVoided && "opacity-60",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "flex items-center gap-2 text-sm font-medium",
                      isVoided && "line-through",
                    )}>
                      {KIND_LABEL[d.kind]}
                      <span className="text-muted-foreground font-normal">
                        {d.number ?? d.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{fmtDate(d.date)}</span>
                      <span>{fmtMoney(d.gross)}</span>
                      {d.status && (
                        <Badge
                          variant={isVoided ? "outline" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {STATUS_LABEL[d.status] ?? d.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openPdf(d, "view")}
                      disabled={downloadMutation.isPending}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openPdf(d, "download")}
                      disabled={downloadMutation.isPending}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {canVoid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmVoid(d)}
                        disabled={voidMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!confirmVoid} onOpenChange={(o) => !o && setConfirmVoid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechnung stornieren?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmVoid && (
                <>
                  Beleg <strong>{confirmVoid.number ?? confirmVoid.id.slice(0, 8)}</strong>{" "}
                  ({KIND_LABEL[confirmVoid.kind]}, {fmtMoney(confirmVoid.gross)}) wird in
                  LexOffice storniert. Bei bereits finalisierten Rechnungen wird automatisch
                  eine Gutschrift als Gegenbeleg erzeugt. <strong>Nicht umkehrbar.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Stornieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}