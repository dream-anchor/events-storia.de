import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  Calendar,
  Package,
  Truck,
  CreditCard,
  HandCoins,
  AlertCircle,
  MoreVertical,
  ArrowRightLeft,
  MessageCircle,
} from "lucide-react";
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

export type OrdersBucket = "inbox" | "done" | "archive";

interface OrdersKanbanViewProps {
  orders: CateringOrder[];
  bucket: OrdersBucket;
  onRefresh: () => void;
}

type SubColumn = {
  id: string;
  title: string;
  match: (o: CateringOrder) => boolean;
  dropStatus?: OrderStatus;
};

const BUCKET_COLUMNS: Record<OrdersBucket, SubColumn[]> = {
  inbox: [
    {
      id: "pending",
      title: "Neu / offen",
      match: (o) => o.status === "pending",
      dropStatus: "pending",
    },
    {
      id: "confirmed",
      title: "Bestätigt",
      match: (o) => o.status === "confirmed",
      dropStatus: "confirmed",
    },
  ],
  done: [
    {
      id: "completed",
      title: "Erledigt",
      match: (o) => o.status === "completed",
      dropStatus: "completed",
    },
  ],
  archive: [
    {
      id: "cancelled",
      title: "Storniert",
      match: (o) => o.status === "cancelled",
      dropStatus: "cancelled",
    },
  ],
};

function formatCurrency(amount: number | null) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
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

type OrderActionState = {
  label: string;
  dotClass: string;
  textClass: string;
  borderClass: string;
};

function getOrderActionState(o: CateringOrder): OrderActionState {
  const lastCustomer = o.last_customer_message_at ? new Date(o.last_customer_message_at).getTime() : 0;
  const lastOurs = o.last_our_reply_at ? new Date(o.last_our_reply_at).getTime() : 0;
  const isPaid = o.payment_status === "paid";
  const isCashOnPickup = o.payment_method === "cash" && o.is_pickup;
  const daysInfo = getDaysLabel(o.desired_date);

  if (lastCustomer > lastOurs) {
    return {
      label: "Antwort wartet",
      dotClass: "bg-destructive",
      textClass: "text-destructive",
      borderClass: "border-l-destructive",
    };
  }

  if (o.status === "pending" && !isPaid && !isCashOnPickup) {
    return {
      label: "Unbezahlt",
      dotClass: "bg-destructive",
      textClass: "text-destructive",
      borderClass: "border-l-destructive",
    };
  }

  if (o.status === "pending" && daysInfo?.urgent) {
    return {
      label: "Bestätigung offen",
      dotClass: "bg-foreground",
      textClass: "text-foreground",
      borderClass: "border-l-foreground",
    };
  }

  if (o.status === "confirmed" && daysInfo?.urgent) {
    return {
      label: "Bereit zur Auslieferung",
      dotClass: "bg-foreground/70",
      textClass: "text-foreground",
      borderClass: "border-l-foreground/60",
    };
  }

  if (o.status === "confirmed") {
    return {
      label: "Bestätigt",
      dotClass: "bg-foreground/40",
      textClass: "text-muted-foreground",
      borderClass: "border-l-foreground/30",
    };
  }

  if (o.status === "completed") {
    return {
      label: "Abgeschlossen",
      dotClass: "bg-muted-foreground/50",
      textClass: "text-muted-foreground",
      borderClass: "border-l-muted-foreground/40",
    };
  }

  if (o.status === "cancelled") {
    return {
      label: "Storniert",
      dotClass: "bg-muted-foreground/30",
      textClass: "text-muted-foreground",
      borderClass: "border-l-muted-foreground/30",
    };
  }

  return {
    label: "Offen",
    dotClass: "bg-foreground/30",
    textClass: "text-muted-foreground",
    borderClass: "border-l-foreground/20",
  };
}

function PaymentBadge({ order }: { order: CateringOrder }) {
  const isPaid = order.payment_status === "paid";
  const isCash = order.payment_method === "cash" && order.is_pickup;
  if (isPaid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
        <CreditCard className="h-2.5 w-2.5" /> Bezahlt
      </span>
    );
  }
  if (isCash) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <HandCoins className="h-2.5 w-2.5" /> Cash
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
      <AlertCircle className="h-2.5 w-2.5" /> Unbezahlt
    </span>
  );
}

interface CardProps {
  order: CateringOrder;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onMoveStatus: (status: OrderStatus) => void;
  moving: boolean;
}

function OrderKanbanCard({
  order,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onMoveStatus,
  moving,
}: CardProps) {
  const action = getOrderActionState(order);
  const daysInfo = getDaysLabel(order.desired_date);
  const lastCustomer = order.last_customer_message_at
    ? new Date(order.last_customer_message_at).getTime()
    : 0;
  const lastOurs = order.last_our_reply_at ? new Date(order.last_our_reply_at).getTime() : 0;
  const hasUnreadCustomer = lastCustomer > lastOurs;

  const allStatuses: { id: OrderStatus; label: string }[] = [
    { id: "pending", label: "Neu / offen" },
    { id: "confirmed", label: "Bestätigt" },
    { id: "completed", label: "Erledigt" },
    { id: "cancelled", label: "Storniert" },
  ];
  const otherStatuses = allStatuses.filter((s) => s.id !== order.status);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group relative cursor-grab rounded-xl border border-slate-200 border-l-[3px] bg-white p-3 transition-all hover:border-foreground/30 hover:shadow-sm active:cursor-grabbing",
        action.borderClass,
        isDragging && "scale-[0.98] opacity-40 shadow-md",
        moving && "opacity-50",
      )}
    >
      {/* Header: Payment-Badge + Bestellnummer + Datum + Menu */}
      <div className="flex items-center gap-2 min-w-0">
        <PaymentBadge order={order} />
        <span className="font-mono text-[11px] font-semibold text-slate-500 truncate flex-1 min-w-0">
          {order.order_number}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
              aria-label="Status ändern"
            >
              <MoreVertical className="h-3.5 w-3.5" />
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
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveStatus(s.id);
                }}
                className="text-xs"
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {order.desired_date && (
          <span className="flex-shrink-0 text-[11px] tabular-nums text-slate-500">
            {format(parseISO(order.desired_date), "d. MMM", { locale: de })}
          </span>
        )}
      </div>

      {/* Action-Zeile: Dot + Label */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", action.dotClass)} />
        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", action.textClass)}>
          {action.label}
        </span>
        {hasUnreadCustomer && (
          <MessageCircle className="h-3 w-3 text-destructive" />
        )}
      </div>

      {/* Kunde */}
      <p className="mt-1.5 truncate text-[13px] font-semibold text-slate-800">
        {order.customer_name}
        {order.company_name && (
          <span className="font-normal text-slate-500"> · {order.company_name}</span>
        )}
      </p>

      {/* Footer: Lieferung/Abholung + Datum-Detail + Summe */}
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
        {order.is_pickup ? (
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3" /> Abholung
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 truncate">
            <Truck className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {order.delivery_zip
                ? `${order.delivery_zip} ${order.delivery_city || ""}`.trim()
                : "Lieferung"}
            </span>
          </span>
        )}
        {order.desired_time && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Calendar className="h-3 w-3" /> {order.desired_time}
          </span>
        )}
        {daysInfo && (
          <span className={cn("font-medium", daysInfo.urgent ? "text-destructive" : "")}>
            {daysInfo.label}
          </span>
        )}
        <span className="ml-auto font-semibold tabular-nums text-slate-700">
          {formatCurrency(order.total_amount)}
        </span>
      </div>
    </div>
  );
}

export function OrdersKanbanView({ orders, bucket, onRefresh }: OrdersKanbanViewProps) {
  const navigate = useNavigate();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const columns = BUCKET_COLUMNS[bucket];

  const columnData = useMemo(() => {
    const data: Record<string, { items: CateringOrder[]; totalSum: number }> = {};
    columns.forEach((c) => {
      data[c.id] = { items: [], totalSum: 0 };
    });
    orders.forEach((o) => {
      const target = columns.find((c) => c.match(o))?.id;
      if (!target || !data[target]) return;
      data[target].items.push(o);
      data[target].totalSum += o.total_amount || 0;
    });
    // Sortierung: neueste Bestellung zuerst
    Object.values(data).forEach((b) =>
      b.items.sort((a, b) => {
        const da = a.created_at || "";
        const db = b.created_at || "";
        return db.localeCompare(da);
      }),
    );
    return data;
  }, [orders, columns]);

  const moveToStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      setMovingId(orderId);
      const { error } = await supabase
        .from("catering_orders")
        .update({ status })
        .eq("id", orderId);
      setMovingId(null);
      if (error) {
        toast.error("Status konnte nicht geändert werden");
      } else {
        toast.success("Status geändert");
        onRefresh();
      }
    },
    [onRefresh],
  );

  const handleDragStart = useCallback((e: React.DragEvent, order: CateringOrder) => {
    setDraggingId(order.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", order.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, col: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(col);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverColumn(null), []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setDragOverColumn(null);
      const id = e.dataTransfer.getData("text/plain");
      const order = orders.find((o) => o.id === id);
      if (!order) return;
      const target = columns.find((c) => c.id === targetId);
      if (!target?.dropStatus) return;
      if (order.status === target.dropStatus) return;
      await moveToStatus(order.id, target.dropStatus);
    },
    [orders, columns, moveToStatus],
  );

  const total = columns.reduce(
    (sum, c) => sum + (columnData[c.id]?.items.length ?? 0),
    0,
  );

  const gridClass =
    columns.length >= 3
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      : columns.length === 2
        ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
        : "grid grid-cols-1 gap-3";

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-16 text-center text-sm text-slate-400">
        Keine Bestellungen in diesem Bereich
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {columns.map((column) => {
        const { items, totalSum } = columnData[column.id];
        const isDragOver = dragOverColumn === column.id;
        const isDroppable = !!column.dropStatus;
        return (
          <div
            key={column.id}
            className={cn(
              "flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/60 transition-all",
              isDragOver && "border-foreground/40 bg-foreground/5 ring-2 ring-foreground/40",
            )}
            onDragOver={(e) => isDroppable && handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => isDroppable && handleDrop(e, column.id)}
          >
            <div className="border-b border-slate-200/70 px-4 pb-3 pt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">{column.title}</h2>
                <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                  {items.length}
                </span>
              </div>
              <div className="text-right text-[10px] tabular-nums text-slate-400">
                {formatCurrency(totalSum)}
              </div>
            </div>
            <div className="max-h-[calc(100vh-320px)] flex-1 space-y-2 overflow-y-auto p-2">
              {items.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-8 text-[11px] uppercase tracking-wider text-slate-400">
                  {isDroppable ? "Hierher ziehen" : "Leer"}
                </div>
              ) : (
                items.map((order) => (
                  <OrderKanbanCard
                    key={order.id}
                    order={order}
                    isDragging={draggingId === order.id}
                    moving={movingId === order.id}
                    onDragStart={(e) => handleDragStart(e, order)}
                    onDragEnd={handleDragEnd}
                    onClick={() => navigate(`/admin/orders/${order.id}/edit`)}
                    onMoveStatus={(s) => moveToStatus(order.id, s)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}