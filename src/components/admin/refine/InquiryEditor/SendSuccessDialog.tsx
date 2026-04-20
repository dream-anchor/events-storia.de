import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export interface SendSuccessInfo {
  recipient: string | null;
  sentAt: string;
  messageId: string | null;
  emailSent: boolean;
}

interface SendSuccessDialogProps {
  open: boolean;
  info: SendSuccessInfo | null;
  onClose: () => void;
  onGoToList: () => void;
  onGoToOffer: () => void;
}

/**
 * Bestaetigungs-Modal nach erfolgreichem Versand (Bug 3).
 * Zeigt Empfaenger, Zeitpunkt, Resend-Message-ID und bietet
 * Quick-Navigation zur Liste oder zum Angebot.
 */
export function SendSuccessDialog({
  open,
  info,
  onClose,
  onGoToList,
  onGoToOffer,
}: SendSuccessDialogProps) {
  if (!info) return null;

  const sentAtLabel = (() => {
    try {
      return format(new Date(info.sentAt), "d. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
    } catch {
      return info.sentAt;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <DialogTitle>Angebot erfolgreich versendet</DialogTitle>
              <DialogDescription className="mt-1">
                {info.emailSent
                  ? "Die E-Mail wurde an den Kunden zugestellt."
                  : "Versand intern gespeichert (Mail-Status pruefen)."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm py-2">
          <span className="text-muted-foreground">Empfänger</span>
          <span className="font-medium break-all">{info.recipient || "—"}</span>

          <span className="text-muted-foreground">Zeitpunkt</span>
          <span>{sentAtLabel}</span>

          {info.messageId && (
            <>
              <span className="text-muted-foreground">Resend-ID</span>
              <span className="font-mono text-xs break-all">{info.messageId}</span>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="outline" onClick={onGoToList}>
            Zur Übersicht
          </Button>
          <Button onClick={onGoToOffer}>
            Zum Angebot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}