import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, CheckCircle2, Euro } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalRefLinks } from "./ExternalRefLinks";

interface PaymentRow {
  id: string;
  amount_cents: number;
  status: string;
  payment_type: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_link_url?: string | null;
  paid_at?: string | null;
  created_at: string;
}

interface Props {
  eventId: string;
  context: "catering_order" | "event_booking" | "inquiry";
  totalEur: number;
  customerEmail: string;
  customerName?: string;
  /** Optional: zusätzliche Brutto-Beträge aus älteren Stripe-Charges, die nicht in v2_payments stehen. */
  externalPaidEur?: number;
}

function fmt(eur: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(eur);
}

export function PaymentBalanceCard({
  eventId, context, totalEur, customerEmail, customerName, externalPaidEur = 0,
}: Props) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");

  const loadPayments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("v2_payments")
      .select("id,amount_cents,status,payment_type,stripe_payment_intent_id,stripe_checkout_session_id,stripe_payment_link_url,paid_at,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) console.warn("[PaymentBalanceCard] load failed", error);
    setRows((data as PaymentRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadPayments();
    const channel = supabase
      .channel(`pay-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "v2_payments", filter: `event_id=eq.${eventId}` }, loadPayments)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const paidEur = useMemo(
    () => rows.filter(r => r.status === "paid").reduce((s, r) => s + r.amount_cents / 100, 0) + externalPaidEur,
    [rows, externalPaidEur]
  );
  const openEur = Math.max(0, totalEur - paidEur);
  const remainingFmt = fmt(openEur);

  useEffect(() => {
    if (openEur > 0 && !customAmount) setCustomAmount(openEur.toFixed(2));
  }, [openEur, customAmount]);

  const handleSendBalance = async () => {
    const amt = Number((customAmount || "").replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Bitte gültigen Betrag eingeben");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("create-balance-payment-link", {
        body: {
          eventId,
          context,
          amountEur: amt,
          customerEmail,
          customerName,
          description: `Restzahlung – ${remainingFmt}`,
          sendEmail: true,
        },
      });
      if (error) throw error;
      toast.success("Zahlungslink erstellt und an Kunde gesendet");
      await loadPayments();
    } catch (e) {
      toast.error("Erstellung fehlgeschlagen", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Euro className="h-4 w-4" />
          Zahlungsstand
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Gesamt</div>
            <div className="font-semibold">{fmt(totalEur)}</div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Bezahlt</div>
            <div className="font-semibold">{fmt(paidEur)}</div>
          </div>
          <div className={`rounded-xl border p-3 ${openEur > 0 ? "bg-foreground/5 border-foreground/30" : "bg-muted/30"}`}>
            <div className="text-xs text-muted-foreground">Offen</div>
            <div className={`font-semibold ${openEur > 0 ? "text-foreground" : "text-muted-foreground"}`}>{remainingFmt}</div>
          </div>
        </div>

        {openEur > 0 && (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Betrag (EUR)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-32 rounded-xl"
              />
            </div>
            <Button onClick={handleSendBalance} disabled={sending} className="rounded-xl">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Zahlungslink senden
            </Button>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Transaktionen</div>
            <ul className="space-y-1.5">
              {rows.map((r) => {
                const isPaid = r.status === "paid";
                return (
                  <li key={r.id} className="flex items-center gap-3 text-sm rounded-xl border px-3 py-2">
                    <div className={`h-2 w-2 rounded-full ${isPaid ? "bg-foreground" : "bg-muted-foreground/50"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{fmt(r.amount_cents / 100)}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.payment_type ?? "—"} · {r.status}
                        </span>
                      </div>
                      {r.stripe_payment_link_url && !isPaid && (
                        <a href={r.stripe_payment_link_url} target="_blank" rel="noopener noreferrer"
                           className="text-xs underline text-muted-foreground hover:text-foreground break-all">
                          {r.stripe_payment_link_url}
                        </a>
                      )}
                    </div>
                    <ExternalRefLinks
                      stripePaymentIntentId={r.stripe_payment_intent_id}
                      stripeSessionId={r.stripe_checkout_session_id}
                    />
                    {isPaid && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}