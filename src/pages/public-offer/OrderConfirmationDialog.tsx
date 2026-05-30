import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OfferLang } from "@/lib/offerLang";
import { tOffer, currencyLocale } from "./i18n";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inquiryId: string;
  selectedOptionId?: string | null;
  totalAmount: number;
  /** how the customer will pay later — drives the additional acknowledge text */
  paymentTiming: "on_site" | "after_event" | "transfer_prepay";
  onConfirmed: () => void;
  lang?: OfferLang;
}

function timingLabel(lang: OfferLang, t: Props["paymentTiming"]): string {
  const key =
    t === "on_site"
      ? "dialogTimingOnSite"
      : t === "after_event"
        ? "dialogTimingAfterEvent"
        : "dialogTimingTransferPrepay";
  return tOffer(lang, key);
}

export function OrderConfirmationDialog({
  open,
  onOpenChange,
  inquiryId,
  selectedOptionId,
  totalAmount,
  paymentTiming,
  onConfirmed,
  lang = "de",
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
        throw new Error((data as { error?: string })?.error || error?.message || tOffer(lang, "dialogConfirmError"));
      }
      toast.success(tOffer(lang, "dialogSuccess"));
      onConfirmed();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tOffer(lang, "dialogConfirmError"));
    } finally {
      setLoading(false);
    }
  };

  const formattedTotal = new Intl.NumberFormat(currencyLocale(lang), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(totalAmount);

  const timing = timingLabel(lang, paymentTiming);
  const description = tOffer(lang, "dialogBindingDescription").replace("{timing}", timing);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {tOffer(lang, "dialogBindingTitle")}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium block mb-1">
              {tOffer(lang, "dialogFullName")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tOffer(lang, "dialogNamePlaceholder")}
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
              {tOffer(lang, "dialogAccept1Prefix")}{" "}
              <strong className="text-foreground">{tOffer(lang, "dialogAccept1Bold")}</strong>{" "}
              {tOffer(lang, "dialogAccept1Suffix")}
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={accept2}
              onCheckedChange={(v) => setAccept2(v === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              {tOffer(lang, "dialogAccept2Prefix")}{" "}
              <a
                href="/agb-veranstaltungen"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                {tOffer(lang, "dialogAccept2Link")}
              </a>{" "}
              {tOffer(lang, "dialogAccept2Suffix")}
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={accept3}
              onCheckedChange={(v) => setAccept3(v === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              {tOffer(lang, "dialogAccept3Prefix")}{" "}
              <strong className="text-foreground">{formattedTotal}</strong>{" "}
              {timing} {tOffer(lang, "dialogAccept3Suffix")}.
            </span>
          </label>

          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            {tOffer(lang, "dialogEvidenceNote")}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {tOffer(lang, "dialogCancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {tOffer(lang, "dialogBookNowCta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
