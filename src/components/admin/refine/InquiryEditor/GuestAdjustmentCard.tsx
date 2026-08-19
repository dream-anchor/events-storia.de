import { useCallback, useEffect, useState } from "react";
import { Users, AlertTriangle, FileText, Undo2, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Adjustment {
  id: string;
  guests_before: number;
  guests_after: number;
  delta_guests: number;
  price_per_person_cents: number;
  delta_amount_cents: number;
  kind: string;
  status: string;
  lexoffice_invoice_id: string | null;
  lexoffice_credit_note_id: string | null;
  stripe_refund_id: string | null;
  created_at: string;
  settled_at: string | null;
}

const eur = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

const statusLabels: Record<string, string> = {
  open: "Offen",
  invoiced: "Nachberechnet",
  refunded: "Erstattet",
  waived: "Ohne Beleg geklärt",
};

export function GuestAdjustmentCard({ inquiryId }: { inquiryId: string }) {
  const [rows, setRows] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("v2_guest_adjustments")
      .select("*")
      .eq("event_id", inquiryId)
      .order("created_at", { ascending: false });
    setRows((data as unknown as Adjustment[]) ?? []);
    setLoading(false);
  }, [inquiryId]);

  useEffect(() => { void load(); }, [load]);

  const settle = async (id: string, action: "invoice" | "refund" | "waive") => {
    setBusy(`${id}:${action}`);
    try {
      const { data, error } = await supabase.functions.invoke("settle-guest-adjustment", {
        body: { adjustmentId: id, action },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const res = data as { creditNoteSkipped?: boolean };
      toast.success(
        action === "invoice"
          ? "Nachberechnung als Rechnung erstellt"
          : action === "refund"
            ? res?.creditNoteSkipped
              ? "Erstattung ausgelöst — Gutschrift bitte manuell in LexOffice anlegen"
              : "Erstattung und Gutschrift erstellt"
            : "Als geklärt markiert",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  if (loading || rows.length === 0) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Gästezahl-Anpassungen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const isOpen = r.status === "open";
          const plus = r.delta_guests > 0;
          return (
            <div
              key={r.id}
              className={`rounded-xl border p-4 ${isOpen ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {isOpen && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {r.guests_before} → {r.guests_after} Gäste
                  <span className="text-muted-foreground">
                    ({plus ? "+" : ""}{r.delta_guests})
                  </span>
                </div>
                <Badge variant={isOpen ? "destructive" : "secondary"}>
                  {statusLabels[r.status] ?? r.status}
                </Badge>
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {plus ? "Nachzuberechnen" : "Zu erstatten"}:{" "}
                <span className="font-semibold text-foreground">
                  {eur(Math.abs(r.delta_amount_cents))}
                </span>
                {r.price_per_person_cents > 0 && (
                  <> · {Math.abs(r.delta_guests)} × {eur(r.price_per_person_cents)}</>
                )}
              </div>

              {(r.lexoffice_invoice_id || r.lexoffice_credit_note_id || r.stripe_refund_id) && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {r.lexoffice_invoice_id && <>Rechnung: {r.lexoffice_invoice_id} </>}
                  {r.lexoffice_credit_note_id && <>Gutschrift: {r.lexoffice_credit_note_id} </>}
                  {r.stripe_refund_id && <>Erstattung: {r.stripe_refund_id}</>}
                </div>
              )}

              {isOpen && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {plus ? (
                    <Button
                      size="sm"
                      disabled={!!busy}
                      onClick={() => settle(r.id, "invoice")}
                    >
                      {busy === `${r.id}:invoice`
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <FileText className="h-4 w-4 mr-2" />}
                      Nachberechnung erstellen
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!!busy}
                      onClick={() => settle(r.id, "refund")}
                    >
                      {busy === `${r.id}:refund`
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Undo2 className="h-4 w-4 mr-2" />}
                      Erstatten & Gutschrift
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => settle(r.id, "waive")}
                  >
                    {busy === `${r.id}:waive`
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <Check className="h-4 w-4 mr-2" />}
                    Ohne Beleg klären
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}