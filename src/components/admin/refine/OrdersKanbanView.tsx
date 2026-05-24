import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Package, Truck, CreditCard, HandCoins, AlertCircle, MoreVertical, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CateringOrder, OrderStatus } from "@/types/refine";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";

interface OrdersKanbanViewProps {
  orders: CateringOrder[];
  onRefresh: () => void;
}

const COLUMNS = [
  { id: "pending",   title: "Neu / offen", color: "bg-foreground" },
  { id: "confirmed", title: "Bestätigt",   color: "bg-foreground/70" },
  { id: "completed", title: "Erledigt",    color: "bg-muted-foreground/60" },
  { id: "cancelled", title: "Storniert",   color: "bg-muted-foreground/30" },
] as const;

type ColId = (typeof COLUMNS)[number]["id"];

function formatCurrency(amount: number | null) {
  if (!amount) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getDaysLabel(dateStr: string | null): { label: string; urgent: boolean } | null {
  if (!dateStr) return null;
  const diff = differenceInDays(parseISO(dateStr), new Date());
  if (diff === 0) return { label: "Heute", urgent: true };
  if (diff === 1) return { label: "Morgen", urgent: true };
  if (diff < 0) return { label: `vor ${Math.abs(diff)}d`, urgent: false };
  if (diff <= 7) return { label: `in ${diff}d`, urgent: true };
  return null;
}

function PaymentBadge({ order }: { order: CateringOrder }) {
  const isPaid = order.payment_status === "paid";
  const isCash = order.payment_method === "cash" && order.is_pickup;
  if (isPaid) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-foreground bg-muted border border-border rounded-full px-1.5 py-0.5">
      <CreditCard className="h-2.5 w-2.5" /> Bezahlt
    </span>
  );
  if (isCash) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted/60 border border-border rounded-full px-1.5 py-0.5">
      <HandCoins className="h-2.5 w-2.5" /> Cash
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-full px-1.5 py-0.5">
      <AlertCircle className="h-2.5 w-2.5" /> Unbezahlt
    </span>
  );
}

function OrderCard({ order, onRefresh }: { order: CateringOrder; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [moving, setMoving] = useState(false);

  const daysInfo = getDaysLabel(order.desired_date);

  const moveToStatus = async (status: OrderStatus) => {
    setMoving(true);
    const { error } = await supabase
      .from("catering_orders")
      .update({ status })
      .eq("id", order.id);
    setMoving(false);
    if (error) {
      toast.error("Status konnte nicht geändert werden");
    } else {
      toast.success("Status geändert");
      onRefresh();
    }
  };

  const allStatuses: { id: OrderStatus; label: string }[] = [
    { id: "pending",   label: "Neu" },
    { id: "confirmed", label: "Bestätigt" },
    { id: "completed", label: "Erledigt" },
    { id: "cancelled", label: "Storniert" },
  ];
  const otherStatuses = allStatuses.filter((s) => s.id !== (order.status as OrderStatus));

  return (
    <div
      className={cn(
        "group relative bg-white rounded-lg border border-border shadow-sm hover:shadow-md transition-all cursor-pointer p-3 space-y-2",
        moving && "opacity-50"
      )}
      onClick={() => navigate(`/admin/orders/${order.id}/edit`)}
    >
      {/* Header: Bestellnummer + Dropdown */}
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-xs font-semibold text-muted-foreground truncate">
          {order.order_number}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted">
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
              <ArrowRightLeft className="h-3 w-3" /> Status ändern
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {otherStatuses.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={(e) => { e.stopPropagation(); moveToStatus(s.id); }}
                className="text-xs"
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Kundenname */}
      <p className="text-sm font-semibold leading-tight line-clamp-1">
        {order.customer_name}
        {order.company_name && (
          <span className="text-muted-foreground font-normal"> · {order.company_name}</span>
        )}
      </p>

      {/* Lieferdatum */}
      {order.desired_date && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{format(parseISO(order.desired_date), "EEE dd.MM.yy", { locale: de })}</span>
          {order.desired_time && <span>· {order.desired_time}</span>}
          {daysInfo && (
            <span className={cn("font-medium", daysInfo.urgent ? "text-destructive" : "")}>
              ({daysInfo.label})
            </span>
          )}
        </div>
      )}

      {/* Lieferung / Abholung */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {order.is_pickup ? (
          <><Package className="h-3 w-3 shrink-0" /> Abholung</>
        ) : (
          <><Truck className="h-3 w-3 shrink-0" />
          {order.delivery_zip ? `${order.delivery_zip} ${order.delivery_city || ""}`.trim() : "Lieferung"}</>
        )}
      </div>

      {/* Footer: Betrag + Payment */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-sm font-bold">{formatCurrency(order.total_amount)}</span>
        <PaymentBadge order={order} />
      </div>
    </div>
  );
}

function emptyBucket() {
  return { items: [] as CateringOrder[], total: 0 };
}

export function OrdersKanbanView({ orders, onRefresh }: OrdersKanbanViewProps) {
  const columnData = useMemo(() => {
    const data: Record<ColId, { items: CateringOrder[]; total: number }> = {
      pending: emptyBucket(),
      confirmed: emptyBucket(),
      completed: emptyBucket(),
      cancelled: emptyBucket(),
    };

    orders.forEach((o) => {
      const col = (o.status as ColId) ?? "pending";
      if (data[col]) {
        data[col].items.push(o);
        data[col].total += o.total_amount || 0;
      }
    });

    // Sortierung: nächster Liefertermin zuerst, dann Eingang
    (Object.keys(data) as ColId[]).forEach((col) => {
      data[col].items.sort((a, b) => {
        const dateA = a.desired_date || a.created_at || "";
        const dateB = b.desired_date || b.created_at || "";
        return dateA.localeCompare(dateB);
      });
    });

    return data;
  }, [orders]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
      {COLUMNS.map((col) => {
        const { items, total } = columnData[col.id];
        return (
          <div key={col.id} className="flex-none w-72">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", col.color)} />
                <span className="text-sm font-semibold">{col.title}</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                  {items.length}
                </span>
              </div>
              {total > 0 && (
                <span className="text-xs font-medium text-muted-foreground">
                  {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(total)}
                </span>
              )}
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <p className="text-xs text-muted-foreground">Keine Bestellungen</p>
                </div>
              ) : (
                items.map((order) => (
                  <OrderCard key={order.id} order={order} onRefresh={onRefresh} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
