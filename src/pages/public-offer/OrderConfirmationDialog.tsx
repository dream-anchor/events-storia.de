import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inquiryId: string;
  selectedOptionId?: string | null;
  totalAmount: number;
  /** how the customer will pay later — drives the additional acknowledge text */
  paymentTiming: "on_site" | "after_event" | "transfer_prepay";
  onConfirmed: () => void;
}

const labelByTiming: Record<Props["paymentTiming"], string> = {
  on_site: "vor Ort am Veranstaltungstag",
  after_event: "per Rechnung nach der Veranstaltung",
  transfer_prepay: "per Überweisung vor der Veranstaltung",
};

export function OrderConfirmationDialog({
  open,
  onOpenChange,
  inquiryId,
  selectedOptionId,
  totalAmount,
  paymentTiming,
  onConfirmed,
}: Props) {
  const [name, setName] = useState("");
  const [accept1, setAccept1] = useState(false);
  const [accept2, setAccept2] = useState(false);
  const [accept3, setAccept3] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    name.trim().length >= 2 && accept1 && accept2 && accept3 && !loading;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("confirm-order", {
        body: {
          inquiry_id: inquiryId,
          selected_option_id: selectedOptionId ?? null,
          customer_name: name.trim(),
          agbs_accepted: accept2,
          terms_accepted: accept1,
          payment_acknowledged: accept3,
        },
      });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error || error?.message || "Fehler");
      }
      toast.success("Auftrag verbindlich bestätigt — vielen Dank!");
      onConfirmed();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler bei der Bestätigung");
    } finally {
      setLoading(false);
    }
  };

  const formattedTotal = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(totalAmount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verbindliche Auftragsbestätigung
          </DialogTitle>
          <DialogDescription>
            Mit Ihrer Bestätigung kommt ein rechtswirksamer Vertrag zustande.
            Die Zahlung erfolgt {labelByTiming[paymentTiming]}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium block mb-1">
              Vor- und Nachname
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Max Mustermann"
              autoComplete="name"
            />
          </div>

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={accept1}
              onCheckedChange={(v) => setAccept1(v === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              Ich nehme das Angebot in der gezeigten Form
              <strong className="text-foreground"> rechtsverbindlich </strong>
              an.
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={accept2}
              onCheckedChange={(v) => setAccept2(v === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              Ich habe die{" "}
              <a
                href="/agb-veranstaltungen"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                AGB
              </a>{" "}
              und die Stornobedingungen gelesen und akzeptiere sie.
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={accept3}
              onCheckedChange={(v) => setAccept3(v === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              Mir ist bekannt, dass der Gesamtbetrag von{" "}
              <strong className="text-foreground">{formattedTotal}</strong>{" "}
              {labelByTiming[paymentTiming]} fällig ist.
            </span>
          </label>

          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            Zur Beweissicherung speichern wir Datum, Ihre IP-Adresse und Ihr
            Gerät zusammen mit der Version dieses Angebots.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Jetzt verbindlich buchen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
