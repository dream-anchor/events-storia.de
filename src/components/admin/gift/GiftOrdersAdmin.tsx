import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addDays, berlinParts, formatEuro, type DeliveryWindow } from "@/lib/gift/pricing";

type Order = Tables<"gift_orders">;
type Item = Tables<"gift_order_items">;

const STATUS_LABEL: Record<string, string> = {
  pending: "Zahlung offen", awaiting_confirmation: "Wartet auf Bestätigung", reserved: "Reserviert (vor Ort)", paid: "Bezahlt", ready: "Bereit", handed_over: "Übergeben", cancelled: "Storniert", expired: "Abgelaufen", refunded: "Erstattet",
};
const NEXT: Record<string, { to: string; label: string }[]> = {
  paid: [{ to: "ready", label: "Bereit" }, { to: "handed_over", label: "Übergeben" }, { to: "cancelled", label: "Stornieren" }],
  reserved: [{ to: "ready", label: "Bereit" }, { to: "handed_over", label: "Übergeben + bezahlt" }, { to: "cancelled", label: "Stornieren" }],
  ready: [{ to: "handed_over", label: "Übergeben" }, { to: "cancelled", label: "Stornieren" }],
  pending: [{ to: "cancelled", label: "Stornieren" }],
  awaiting_confirmation: [{ to: "cancelled", label: "Stornieren" }],
};

/** „Mit Catering #…“ als Link zur Catering-Bestellung (Fallback: reiner Text, falls Bestellung nicht auffindbar). */
function CateringLink({ number, id, label }: { number: string | null; id?: string; label?: string }) {
  const text = label ?? `Mit Catering #${number ?? "?"}`;
  if (!id) return <>{text}</>;
  return <Link to={`/admin/orders/${id}/edit`} onClick={(e) => e.stopPropagation()} className="font-medium underline underline-offset-2">{text}</Link>;
}

type Filter = "open" | "today" | "tomorrow" | "pickup" | "delivery" | "all";

export function GiftOrdersAdmin() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [selected, setSelected] = useState<Order | null>(null);
  // Mischbestellung: Catering-Bestellnummer -> id, damit „mit Catering #…“ direkt zur Catering-Bestellung führt
  const [cateringIds, setCateringIds] = useState<Record<string, string>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkOrder = searchParams.get("order");

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([
      supabase.from("gift_orders").select("*").is("deleted_at", null).order("handover_date", { ascending: true }).order("created_at", { ascending: false }).limit(300),
      supabase.from("gift_settings").select("delivery_windows").eq("id", 1).maybeSingle(),
    ]);
    if (o.error) { toast.error("Laden fehlgeschlagen", { description: o.error.message }); return; }
    setOrders(o.data ?? []);
    const numbers = [...new Set((o.data ?? []).map((x) => x.catering_order_number).filter((n): n is string => !!n))];
    if (numbers.length > 0) {
      const c = await supabase.from("catering_orders").select("id, order_number").in("order_number", numbers);
      if (!c.error) setCateringIds(Object.fromEntries((c.data ?? []).map((x) => [x.order_number, x.id])));
    }
    setWindows((Array.isArray(s.data?.delivery_windows) ? s.data?.delivery_windows : []) as unknown as DeliveryWindow[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Deep-Link ?order=<Bestellnummer> (aus der Catering-Bestellung): Filter „Alle“, Bestellung direkt öffnen
  useEffect(() => {
    if (!deepLinkOrder || !orders) return;
    const hit = orders.find((x) => x.order_number === deepLinkOrder);
    setFilter("all");
    if (hit) setSelected(hit);
    else toast.info(`Korb-Bestellung ${deepLinkOrder} nicht gefunden`);
    setSearchParams({}, { replace: true });
  }, [deepLinkOrder, orders, setSearchParams]);

  const today = berlinParts(new Date()).date;
  const tomorrow = addDays(today, 1);
  const visible = useMemo(() => (orders ?? []).filter((o) => {
    switch (filter) {
      case "open": return ["paid", "reserved", "ready"].includes(o.status);
      case "today": return o.handover_date === today && !["cancelled", "expired", "refunded"].includes(o.status);
      case "tomorrow": return o.handover_date === tomorrow && !["cancelled", "expired", "refunded"].includes(o.status);
      case "pickup": return o.handover === "pickup";
      case "delivery": return o.handover === "delivery";
      default: return true;
    }
  }), [orders, filter, today, tomorrow]);

  if (!orders) return <Loader2 className="h-5 w-5 animate-spin" aria-label="Lädt" />;

  // Mischbestellung: Termin/Art stehen bei der Catering-Bestellung
  const handoverLabel = (o: Order) => (o.handover === "with_catering" ? `Mit Catering #${o.catering_order_number ?? "?"}` : o.handover === "pickup" ? "Abholung" : "Lieferung");
  const windowLabel = (o: Order) => (o.handover === "with_catering" ? "Zeit laut Catering" : o.handover === "pickup" ? `${o.handover_time} Uhr${(o.handover_time ?? "99") < "06:00" ? " (nach Mitternacht)" : ""}` : windows.find((w) => w.key === o.handover_time)?.label_de ?? o.handover_time ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
        {([["open", "Offen"], ["today", "Heute"], ["tomorrow", "Morgen"], ["pickup", "Abholung"], ["delivery", "Lieferung"], ["all", "Alle"]] as [Filter, string][]).map(([k, l]) => (
          <Button key={k} type="button" size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{l}</Button>
        ))}
      </div>
      {visible.length === 0 && <p className="text-sm text-muted-foreground">Keine Bestellungen.</p>}
      <ul className="space-y-2">
        {visible.map((o) => (
          <li key={o.id}>
            <div role="button" tabIndex={0} onClick={() => setSelected(o)} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(o); } }} className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-left hover:bg-secondary/40">
              <span>
                <strong>{o.order_number}</strong> · {o.customer_name}{o.is_test && <Badge variant="outline" className="ml-2">Test</Badge>}
                <span className="block text-sm text-muted-foreground">
                  {o.handover === "with_catering" ? <CateringLink number={o.catering_order_number} id={o.catering_order_number ? cateringIds[o.catering_order_number] : undefined} /> : handoverLabel(o)} {o.handover_date.split("-").reverse().join(".")}, {windowLabel(o)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {/* Z10: Überbuchung beim Eintritt ins 2-Tage-Fenster sichtbar machen, Vor-Ort-Reservierung ohne Bestandsbelegung kennzeichnen */}
                {o.stock_conflict_at && ["reserved", "ready"].includes(o.status) && <Badge variant="destructive">Bestand reicht nicht</Badge>}
                {o.status === "reserved" && o.payment_method === "on_site" && !o.stock_conflict_at && o.handover_date > addDays(today, 2) && <Badge variant="outline">Bestand ab 2 Tage vorher</Badge>}
                <span className="tabular-nums">{formatEuro(o.total_cents)}</span>
                <Badge variant={["cancelled", "expired", "refunded"].includes(o.status) ? "outline" : "default"}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <OrderDialog order={selected} windowLabel={selected ? windowLabel(selected) : ""} cateringId={selected?.catering_order_number ? cateringIds[selected.catering_order_number] : undefined} onClose={() => setSelected(null)} onChanged={() => { void load(); setSelected(null); }} />
    </div>
  );
}

function OrderDialog({ order, windowLabel, cateringId, onClose, onChanged }: { order: Order | null; windowLabel: string; cateringId?: string; onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!order) return;
    void supabase.from("gift_order_items").select("*").eq("order_id", order.id).order("created_at").then(({ data }) => setItems(data ?? []));
  }, [order]);
  if (!order) return null;

  const setStatus = async (to: string) => {
    const extra = to === "cancelled" ? " Bereits gezahlte Bestellungen müssen in Stripe erstattet werden; der Bestand wird NICHT automatisch zurückgebucht." : "";
    if (!confirm(`Status auf „${STATUS_LABEL[to]}" setzen?${extra}`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("gift_admin_set_status", { p_order_id: order.id, p_status: to });
    setBusy(false);
    if (error) { toast.error("Statuswechsel fehlgeschlagen", { description: error.message }); return; }
    const res = (data ?? {}) as { oversold?: boolean; conflict?: boolean };
    if (res.conflict) {
      toast.warning("Bestand reicht nicht", { description: "Der Bestand reicht nicht für diese Bestellung. Der Hinweis verschwindet von selbst, sobald der Bestand (z. B. nach Nachpacken) wieder reicht.", duration: 12000 });
    } else if (res.oversold) {
      // Bei Zahlung vor Ort war nicht mehr die volle Menge im Bestand: Bestand prüfen, ggf. nachbuchen
      toast.warning("Achtung: Überverkauf", { description: "Beim Abbuchen reichte der Bestand nicht für die volle Menge (es wurde nur der freie Anteil abgebucht). Bitte Bestand prüfen und ggf. korrigieren.", duration: 12000 });
    } else {
      toast.success("Status geändert");
    }
    onChanged();
  };

  // Bestand nach Storno bewusst manuell wieder einbuchen (Ware kann beschädigt/verbraucht sein)
  const restock = async () => {
    if (!confirm("Bestand für diese Bestellung wieder einbuchen? Nur wenn die Körbe unversehrt zurück im Lager sind (Ware kann beschädigt oder verbraucht sein).")) return;
    setBusy(true);
    // Idempotent serverseitig (gift_orders.restocked_at): bucht genau die abgebuchten Mengen zurück, ein zweiter Klick ist wirkungslos
    const { data, error } = await supabase.rpc("gift_restock_order", { p_order_id: order.id });
    setBusy(false);
    if (error) { toast.error("Wiedereinbuchen fehlgeschlagen", { description: error.message }); return; }
    const res = (data ?? {}) as { already?: boolean; units?: number };
    if (res.already) { toast.info("Bestand war bereits wieder eingebucht"); onChanged(); return; }
    toast.success(res.units ? `Bestand wieder eingebucht (${res.units} Stück)` : "Nichts einzubuchen (unbegrenzter Bestand oder nichts abgebucht)");
    onChanged();
  };

  const canRestock = ["cancelled", "refunded"].includes(order.status) && !!order.paid_at && !order.restocked_at;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{order.order_number} · {STATUS_LABEL[order.status] ?? order.status}</DialogTitle></DialogHeader>

        {/* Lieferzettel: nur dieser Block wird gedruckt */}
        <div id="gift-slip" className="space-y-2 text-sm">
          <p><strong>{order.handover === "with_catering" ? <CateringLink number={order.catering_order_number} id={cateringId} label={`MIT CATERING #${order.catering_order_number ?? "?"}`} /> : order.handover === "pickup" ? "ABHOLUNG" : "LIEFERUNG"}</strong> {order.handover_date.split("-").reverse().join(".")}, {windowLabel}</p>
          <ul className="list-disc pl-5">{items.map((i) => <li key={i.id}>{i.qty} × {i.basket_name} – {i.variant_label}</li>)}</ul>
          <p><strong>{order.customer_name}</strong><br />{order.customer_email}{order.customer_phone ? <><br />{order.customer_phone}</> : null}</p>
          {order.handover === "delivery" && (
            <p>{order.delivery_street}<br />{order.delivery_zip} {order.delivery_city}{order.delivery_note ? <><br />Hinweis: {order.delivery_note}</> : null}</p>
          )}
          {order.gift_message && <p className="whitespace-pre-wrap rounded-md border border-border p-2"><strong>Grußkarte:</strong><br />{order.gift_message}</p>}
          <p className="font-semibold">Übergabe nur an Personen ab 16 Jahren (Wein/Crémant). Altersangabe im Shop bestätigt: {order.age_confirmed_at ? "ja" : "NEIN"}.</p>
          <p>
            {order.payment_method === "on_site" ? <strong>Zahlung VOR ORT: {formatEuro(order.total_cents)} bei Übergabe kassieren.</strong> : <>Bezahlt online: {formatEuro(order.total_cents)}</>}
            {order.handover === "delivery" && <> (davon Lieferung {formatEuro(order.delivery_fee_cents)}, {order.distance_km} km)</>}
          </p>
          {order.internal_note && <p className="font-semibold text-destructive">ACHTUNG: {order.internal_note}</p>}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button type="button" variant="outline" onClick={() => printSlip()}><Printer className="mr-2 h-4 w-4" />Lieferzettel drucken</Button>
          {(NEXT[order.status] ?? []).map((n) => <Button key={n.to} type="button" disabled={busy} variant={n.to === "cancelled" ? "destructive" : "default"} onClick={() => setStatus(n.to)}>{n.label}</Button>)}
          {canRestock && <Button type="button" variant="outline" disabled={busy} onClick={restock}>Bestand wieder einbuchen</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Druckt nur den Lieferzettel (eigenes Fenster, damit Admin-Navigation nicht mitgedruckt wird). */
function printSlip() {
  const el = document.getElementById("gift-slip");
  if (!el) return;
  const w = window.open("", "_blank", "width=700,height=900");
  if (!w) { toast.error("Pop-up blockiert – bitte Pop-ups für diese Seite erlauben"); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Lieferzettel</title><style>body{font-family:Arial,sans-serif;font-size:14px;padding:24px}ul{padding-left:20px}</style></head><body>${el.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
