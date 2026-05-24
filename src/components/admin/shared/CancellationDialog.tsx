import { useState } from "react";
import { Loader2, Sparkles, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  context: "catering_order" | "event_booking" | "inquiry";
  customerName?: string;
  customerSalutation?: string;
  orderNumber?: string;
  eventDate?: string;
  totalAmount?: number;
  refundInfo?: string;
  /** Wird mit der finalen Nachricht aufgerufen. Component erwartet, dass Caller die Storno-Logik + Versand erledigt. */
  onConfirm: (message: string) => Promise<void> | void;
  confirmLabel?: string;
  title?: string;
}

/**
 * Wiederverwendbarer Storno-/Absage-Dialog mit KI-Assistenz.
 * Caller übernimmt den eigentlichen Versand + Status-Update via onConfirm.
 */
export function CancellationDialog({
  open, onOpenChange, context, customerName, customerSalutation,
  orderNumber, eventDate, totalAmount, refundInfo,
  onConfirm, confirmLabel = "Senden & stornieren", title = "Stornieren mit Nachricht",
}: Props) {
  const [reasonNotes, setReasonNotes] = useState("");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-cancellation-message", {
        body: {
          context,
          customerName,
          customerSalutation,
          orderNumber,
          eventDate,
          totalAmount,
          reasonNotes,
          refundInfo,
          tone: "warm",
        },
      });
      if (error) throw error;
      const text = (data as { message?: string })?.message ?? "";
      if (!text) throw new Error("Leere Antwort von der KI");
      setMessage(text);
      toast.success("KI-Nachricht erstellt — bitte prüfen & anpassen.");
    } catch (e) {
      toast.error("KI-Generierung fehlgeschlagen", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (!message.trim()) {
      toast.error("Bitte eine Nachricht eingeben oder per KI erzeugen.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(message.trim());
      onOpenChange(false);
      setMessage("");
      setReasonNotes("");
    } catch (e) {
      toast.error("Stornierung fehlgeschlagen", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Verfasse eine persönliche Nachricht an den Kunden. Stichworte → KI ausformulieren → prüfen → senden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {refundInfo && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{refundInfo}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Stichworte / Grund (für die KI)</label>
            <Textarea
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              placeholder="z.B. „Termin nicht mehr verfügbar, Küche überlastet, Verlegung möglich"."
              rows={2}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={generating || submitting}
                className="rounded-xl"
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Mit KI ausformulieren
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nachricht an den Kunden</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hier erscheint der KI-Vorschlag — du kannst frei anpassen."
              rows={10}
              className="font-sans"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || !message.trim()}
            className="rounded-xl"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}