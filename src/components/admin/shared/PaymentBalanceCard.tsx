import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, CheckCircle2, Euro, Mail, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
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
  const [confirmDialog, setConfirmDialog] = useState<{ row: PaymentRow; apology: boolean } | null>(null);
  const [confirmSending, setConfirmSending] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [prepayOpen, setPrepayOpen] = useState(false);
  const [prepayLoading, setPrepayLoading] = useState(false);
  const [prepayPricePerPerson, setPrepayPricePerPerson] = useState<string>("");
  const [prepayMinGuests, setPrepayMinGuests] = useState<string>("");
  const [prepayMaxGuests, setPrepayMaxGuests] = useState<string>("");
  const [prepaySendEmail, setPrepaySendEmail] = useState(true);
  const [prepayDescription, setPrepayDescription] = useState<string>("");

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

  // Pre-Fill Prepayment-Dialog aus gewähltem Angebot + Event
  const openPrepayDialog = async () => {
    setPrepayOpen(true);
    try {
      const [{ data: ev }, { data: opt }] = await Promise.all([
        supabase.from("v2_events").select("guest_count, guest_count_max").eq("id", eventId).single(),
        supabase
          .from("v2_offer_options")
          .select("guest_count, amount_total")
          .eq("event_id", eventId)
          .eq("is_active", true)
          .order("is_chosen", { ascending: false })
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const minG = ev?.guest_count ?? opt?.guest_count ?? 1;
      setPrepayMinGuests(String(minG));
      setPrepayMaxGuests(ev?.guest_count_max ? String(ev.guest_count_max) : "");
      if (opt?.amount_total && opt.guest_count && opt.guest_count > 0) {
        const perPerson = Number(opt.amount_total) / opt.guest_count;
        setPrepayPricePerPerson(perPerson.toFixed(2));
      } else if (totalEur > 0 && minG > 0) {
        setPrepayPricePerPerson((totalEur / minG).toFixed(2));
      }
      setPrepayDescription(`Restzahlung – ${customerName ?? "Veranstaltung"}`);
    } catch (e) {
      console.warn("[prepay] preload failed", e);
    }
  };

  const handleCreatePrepayLink = async () => {
    const perPerson = Number((prepayPricePerPerson || "").replace(",", "."));
    const minG = parseInt(prepayMinGuests || "0", 10);
    const maxG = prepayMaxGuests.trim() ? parseInt(prepayMaxGuests, 10) : undefined;
    if (!Number.isFinite(perPerson) || perPerson <= 0) {
      toast.error("Bitte gültigen Preis pro Person eingeben");
      return;
    }
    if (!Number.isFinite(minG) || minG < 1) {
      toast.error("Mindestpersonenzahl muss ≥ 1 sein");
      return;
    }
    if (maxG !== undefined && (!Number.isFinite(maxG) || maxG < minG)) {
      toast.error("Maximalpersonenzahl muss ≥ Minimum sein");
      return;
    }
    setPrepayLoading(true);
    try {
      const { error } = await supabase.functions.invoke("create-prepayment-link", {
        body: {
          eventId,
          pricePerPersonCents: Math.round(perPerson * 100),
          minGuests: minG,
          maxGuests: maxG ?? null,
          description: prepayDescription || undefined,
          sendEmail: prepaySendEmail,
        },
      });
      if (error) throw error;
      toast.success(
        prepaySendEmail
          ? "Stripe-Link erstellt und an Kunde gesendet"
          : "Stripe-Link erstellt",
      );
      setPrepayOpen(false);
      await loadPayments();
    } catch (e) {
      toast.error("Erstellung fehlgeschlagen", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setPrepayLoading(false);
    }
  };

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

  const openConfirmDialog = (row: PaymentRow) => {
    const paidAt = row.paid_at ? new Date(row.paid_at).getTime() : Date.now();
    const isOld = Date.now() - paidAt > 24 * 60 * 60 * 1000;
    const notConfirmedYet = !confirmedIds.has(row.id);
    setConfirmDialog({ row, apology: isOld && notConfirmedYet });
  };

  const sendConfirmation = async () => {
    if (!confirmDialog) return;
    setConfirmSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-payment-confirmation-v2", {
        body: { payment_id: confirmDialog.row.id, include_apology: confirmDialog.apology },
      });
      if (error) throw error;
      setConfirmedIds(prev => new Set(prev).add(confirmDialog.row.id));
      toast.success("Bestätigung versendet", {
        description: `${customerEmail}${confirmDialog.apology ? " (mit Entschuldigung)" : ""}`,
      });
      setConfirmDialog(null);
    } catch (e) {
      toast.error("Versand fehlgeschlagen", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setConfirmSending(false);
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
            <Button onClick={openPrepayDialog} variant="outline" className="rounded-xl">
              <Users className="h-4 w-4 mr-2" />
              Pro-Person-Link (anpassbar)
            </Button>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Transaktionen</div>
            <ul className="space-y-1.5">
              {rows.map((r) => {
                const isPaid = r.status === "paid";
                const wasConfirmed = confirmedIds.has(r.id);
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
                    {isPaid && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-8 px-2.5 text-xs"
                        onClick={() => openConfirmDialog(r)}
                      >
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                        {wasConfirmed ? "Erneut senden" : "Bestätigung senden"}
                      </Button>
                    )}
                    {isPaid && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>

      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Zahlungsbestätigung an Kunden senden</DialogTitle>
            <DialogDescription>
              Es wird eine Bestätigungs-E-Mail im STORIA-Design an{" "}
              <strong>{customerEmail}</strong> versendet.
            </DialogDescription>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Betrag</span><span className="font-medium">{fmt(confirmDialog.row.amount_cents / 100)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Art</span><span>{confirmDialog.row.payment_type === "deposit" ? "Anzahlung" : "Zahlung"}</span></div>
                {confirmDialog.row.paid_at && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Bezahlt am</span><span>{new Date(confirmDialog.row.paid_at).toLocaleString("de-DE")}</span></div>
                )}
              </div>
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border p-3 hover:bg-muted/30">
                <Checkbox
                  checked={confirmDialog.apology}
                  onCheckedChange={(checked) =>
                    setConfirmDialog({ ...confirmDialog, apology: !!checked })
                  }
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium">Entschuldigung für verspätete Bestätigung mitschicken</div>
                  <div className="text-xs text-muted-foreground">
                    Fügt einen kurzen Hinweis hinzu, dass die Bestätigung aus technischen Gründen verspätet versendet wurde.
                  </div>
                </div>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialog(null)} disabled={confirmSending} className="rounded-xl">
              Abbrechen
            </Button>
            <Button onClick={sendConfirmation} disabled={confirmSending} className="rounded-xl">
              {confirmSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Jetzt senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pro-Person Prepayment Dialog */}
      <Dialog open={prepayOpen} onOpenChange={setPrepayOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Stripe-Link mit anpassbarer Personenzahl</DialogTitle>
            <DialogDescription>
              Der Kunde kann im Checkout die finale Gästezahl selbst eingeben (nie unter dem Minimum). Stripe berechnet automatisch <em>Preis × Personen</em>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Preis pro Person (EUR, brutto)</label>
                <Input
                  type="number" min="0" step="0.01"
                  value={prepayPricePerPerson}
                  onChange={(e) => setPrepayPricePerPerson(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Mindestpersonen</label>
                <Input
                  type="number" min="1" step="1"
                  value={prepayMinGuests}
                  onChange={(e) => setPrepayMinGuests(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-muted-foreground">Maximalpersonen (optional)</label>
                <Input
                  type="number" min="1" step="1"
                  placeholder="leer = bis 999"
                  value={prepayMaxGuests}
                  onChange={(e) => setPrepayMaxGuests(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-muted-foreground">Beschreibung (Stripe-Produktname)</label>
                <Input
                  value={prepayDescription}
                  onChange={(e) => setPrepayDescription(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            {prepayPricePerPerson && prepayMinGuests && (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">Vorschau</div>
                <div>
                  <strong>{fmt(Number(prepayPricePerPerson.replace(",", ".")) || 0)}</strong> × {prepayMinGuests} Gäste ={" "}
                  <strong>{fmt((Number(prepayPricePerPerson.replace(",", ".")) || 0) * (parseInt(prepayMinGuests, 10) || 0))}</strong>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Kunde kann auf bis zu {prepayMaxGuests || "999"} Gäste hochstellen.
                </div>
              </div>
            )}
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border p-3 hover:bg-muted/30">
              <Checkbox
                checked={prepaySendEmail}
                onCheckedChange={(c) => setPrepaySendEmail(!!c)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="text-sm font-medium">Direkt per E-Mail an Kunde senden</div>
                <div className="text-xs text-muted-foreground">
                  Sendet die Bestätigungsmail mit dem eingebetteten Zahlungslink an {customerEmail}.
                </div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPrepayOpen(false)} disabled={prepayLoading} className="rounded-xl">
              Abbrechen
            </Button>
            <Button onClick={handleCreatePrepayLink} disabled={prepayLoading} className="rounded-xl">
              {prepayLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Stripe-Link erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}