import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatEuro } from "@/lib/gift/pricing";

/** Korb-Bestellung, die zu einer Catering-Bestellung gehört (Mischbestellung, handover `with_catering`). */
export interface LinkedGiftOrder {
  id: string;
  order_number: string;
  catering_order_number: string;
  status: string;
  total_cents: number;
  items: { id: string; basket_name: string; variant_label: string; qty: number }[];
}

const INACTIVE = ["cancelled", "expired", "refunded"];

/** Wert der verknüpften, nicht stornierten Korb-Bestellungen in Cent. Zählt zum Mindestbestellwert der Catering-Bestellung (Entscheidung 22.11.2026). */
export const activeGiftCents = (orders: LinkedGiftOrder[] | undefined): number =>
  (orders ?? []).filter((o) => !INACTIVE.includes(o.status)).reduce((sum, o) => sum + (o.total_cents ?? 0), 0);

/** Deep-Link in die Korb-Verwaltung: öffnet die Bestellung direkt. */
const giftOrderHref = (orderNumber: string) => `/admin/geschenkkoerbe?order=${encodeURIComponent(orderNumber)}`;

/**
 * Lädt alle Korb-Bestellungen mit Catering-Bezug samt Positionen (gift_orders + gift_order_items, Admin/Staff-Leserecht
 * laut Policies „gift_orders read“ / „gift_order_items read“) und gruppiert sie nach Catering-Bestellnummer.
 * Gleicher Query-Key in Liste, Kanban und Detail → ein gemeinsamer Cache-Eintrag.
 */
export function useGiftOrdersByCateringNumber() {
  return useQuery({
    queryKey: ["admin", "gift-orders-by-catering-number"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_orders")
        .select("id, order_number, catering_order_number, status, total_cents, gift_order_items(id, basket_name, variant_label, qty)")
        .eq("handover", "with_catering")
        .not("catering_order_number", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      const map = new Map<string, LinkedGiftOrder[]>();
      for (const row of data ?? []) {
        if (!row.catering_order_number) continue;
        const entry: LinkedGiftOrder = {
          id: row.id,
          order_number: row.order_number,
          catering_order_number: row.catering_order_number,
          status: row.status,
          total_cents: row.total_cents,
          items: row.gift_order_items ?? [],
        };
        map.set(row.catering_order_number, [...(map.get(row.catering_order_number) ?? []), entry]);
      }
      return map;
    },
  });
}

const baskets = (orders: LinkedGiftOrder[]) => orders.reduce((n, o) => n + o.items.reduce((m, i) => m + i.qty, 0), 0);

/** Kompaktes Badge „+ Geschenkkorb“ für Listen/Karten; Klick führt zur Korb-Bestellung. */
export function GiftBasketBadge({ orders, className }: { orders?: LinkedGiftOrder[]; className?: string }) {
  if (!orders || orders.length === 0) return null;
  const n = baskets(orders);
  return (
    <Link
      to={giftOrderHref(orders[0].order_number)}
      onClick={(e) => e.stopPropagation()}
      title={orders.map((o) => `Korb-Bestellung ${o.order_number}`).join(", ")}
      className={className}
    >
      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">
        <Gift className="h-3 w-3" />
        + Geschenkkorb{n > 1 ? ` (${n})` : ""}
      </Badge>
    </Link>
  );
}

/** Dauerhaft sichtbarer Block für die Catering-Detailansicht: Positionen + Link zur Korb-Bestellung. */
export function GiftBasketPanel({ orders }: { orders?: LinkedGiftOrder[] }) {
  if (!orders || orders.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 text-sm" data-testid="mixed-order-gift-panel">
      <p className="mb-2 flex items-center gap-2 font-semibold text-amber-900">
        <Gift className="h-4 w-4" /> Mischbestellung: Geschenkkorb dabei
      </p>
      {orders.map((o) => (
        <div key={o.id} className="mb-2 last:mb-0">
          <ul className="list-disc pl-5">
            {o.items.map((i) => (
              <li key={i.id}>{i.qty} × {i.basket_name} – {i.variant_label}</li>
            ))}
          </ul>
          <p className="mt-1">
            <Link to={giftOrderHref(o.order_number)} className="font-medium underline underline-offset-2">
              Korb-Bestellung {o.order_number}
            </Link>
            <span className="text-muted-foreground"> · {formatEuro(o.total_cents)}{INACTIVE.includes(o.status) ? " · storniert/abgelaufen" : ""}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
