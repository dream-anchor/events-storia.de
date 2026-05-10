import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  Archive,
  Home,
  MoreVertical,
  UtensilsCrossed,
  Truck,
  ShoppingBag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import type {
  InquiryRecord,
  ServiceType,
  UnifiedColumn,
} from "@/types/inquiryRecord";
import { getRecordActionState } from "@/lib/inquiryActionState";

interface UnifiedKanbanViewProps {
  records: InquiryRecord[];
  onRefresh: () => void;
}

const PIPELINE_COLUMNS: { id: UnifiedColumn; title: string }[] = [
  { id: "lead", title: "Neu" },
  { id: "proposal", title: "In Bearbeitung" },
  { id: "pending", title: "Angebot raus / Bestätigt" },
  { id: "won", title: "Gebucht / Erledigt" },
];

const ARCHIVE_COLUMNS: { id: UnifiedColumn; title: string }[] = [
  { id: "lost", title: "Abgelehnt" },
  { id: "closed", title: "Storniert" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function UnifiedKanbanView({ records, onRefresh }: UnifiedKanbanViewProps) {
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<UnifiedColumn | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columnData = useMemo(() => {
    const data: Record<UnifiedColumn, { items: InquiryRecord[]; totalSum: number }> = {
      lead: { items: [], totalSum: 0 },
      proposal: { items: [], totalSum: 0 },
      pending: { items: [], totalSum: 0 },
      won: { items: [], totalSum: 0 },
      lost: { items: [], totalSum: 0 },
      closed: { items: [], totalSum: 0 },
    };
    records.forEach((r) => {
      data[r.column].items.push(r);
      data[r.column].totalSum += r.totalAmount || 0;
    });
    Object.values(data).forEach((b) => {
      b.items.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
    return data;
  }, [records]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, record: InquiryRecord) => {
      if (record.kind !== "event") {
        e.preventDefault();
        return;
      }
      setDraggingId(record.id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", record.id);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, col: UnifiedColumn) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(col);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverColumn(null), []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, target: UnifiedColumn) => {
      e.preventDefault();
      setDragOverColumn(null);
      const id = e.dataTransfer.getData("text/plain");
      const record = records.find((r) => r.id === id);
      if (!record || record.kind !== "event") return;
      if (record.column === target) return;
      // Map pipeline column → v2_events.status (and archived flag).
      const map: Record<UnifiedColumn, { status: string; archived: boolean }> = {
        lead: { status: "inquiry", archived: false },
        proposal: { status: "offer_draft", archived: false },
        pending: { status: "offer_sent", archived: false },
        won: { status: "paid", archived: false },
        lost: { status: "cancelled", archived: true },
        closed: { status: "cancelled", archived: false },
      };
      const upd = map[target];
      try {
        const { error } = await supabase
          .from("v2_events")
          .update({
            status: upd.status as any,
            archived: upd.archived,
            archived_at: upd.archived ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id);
        if (error) throw error;
        toast.success("Status geändert");
        onRefresh();
      } catch (err) {
        console.error(err);
        toast.error("Fehler beim Aktualisieren");
      }
    },
    [records, onRefresh]
  );

  const handleArchiveCard = useCallback(
    async (record: InquiryRecord) => {
      if (record.kind !== "event") {
        toast.info("Shop-Bestellungen werden über den Status „Storniert“ aus dem aktiven Board entfernt.");
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("v2_events")
          .update({
            archived: true,
            archived_at: new Date().toISOString(),
            archived_by: user?.email || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id);
        if (error) throw error;
        toast.success("Anfrage archiviert");
        onRefresh();
      } catch (err) {
        console.error("Archive error:", err);
        toast.error("Fehler beim Archivieren");
      }
    },
    [onRefresh],
  );

  const renderColumn = (column: { id: UnifiedColumn; title: string }) => {
    const { items, totalSum } = columnData[column.id];
    const isDragOver = dragOverColumn === column.id;
    return (
      <div
        key={column.id}
        className={cn(
          "flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60 transition-all min-w-0",
          isDragOver && "ring-2 ring-foreground/40 border-foreground/40 bg-foreground/5"
        )}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.id)}
      >
        <div className="px-4 pt-4 pb-3 border-b border-slate-200/70">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="font-semibold text-slate-700 text-sm">{column.title}</h2>
            <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
              {items.length}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 text-right tabular-nums">
            {formatCurrency(totalSum)}
          </div>
        </div>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
          {items.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 flex items-center justify-center text-[11px] text-slate-400 uppercase tracking-wider">
              {column.id === "lead" || column.id === "proposal" || column.id === "pending" || column.id === "won"
                ? "Hierher ziehen"
                : "Leer"}
            </div>
          ) : (
            items.map((r) => (
              <UnifiedKanbanCard
                key={`${r.kind}-${r.id}`}
                record={r}
                isDragging={draggingId === r.id}
                onDragStart={(e) => handleDragStart(e, r)}
                onDragEnd={handleDragEnd}
                onClick={() =>
                  navigate(
                    r.kind === "event"
                      ? `/admin/events/${r.id}/edit`
                      : `/admin/orders/${r.id}/edit`
                  )
                }
                onArchive={() => handleArchiveCard(r)}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  const archiveCount = columnData.lost.items.length + columnData.closed.items.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PIPELINE_COLUMNS.map(renderColumn)}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <button
          onClick={() => setArchiveOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors rounded-2xl"
        >
          <div className="flex items-center gap-2.5">
            {archiveOpen ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Abgelehnt & Storniert
            </span>
            <span className="bg-slate-100 text-slate-500 text-[11px] px-2 py-0.5 rounded-full font-semibold tabular-nums">
              {archiveCount}
            </span>
          </div>
        </button>
        {archiveOpen && (
          <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ARCHIVE_COLUMNS.map(renderColumn)}
          </div>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  record: InquiryRecord;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function UnifiedKanbanCard({ record, isDragging, onDragStart, onDragEnd, onClick }: CardProps) {
  const isEvent = record.kind === "event";
  const title =
    record.companyName?.trim() ||
    record.customerName?.trim() ||
    "Unbenannte Anfrage";
  const action = getRecordActionState(record);
  return (
    <div
      draggable={isEvent}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      title={isEvent ? "" : "Status nur im Detail änderbar"}
      className={cn(
        "group relative bg-white p-3 rounded-xl border border-slate-200 border-l-[3px]",
        action.borderClass,
        "hover:shadow-sm hover:border-foreground/30 transition-all",
        isEvent ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40 scale-[0.98] shadow-md"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <ServiceBadge serviceType={record.serviceType} />
        <h3 className="font-semibold text-slate-800 text-[13px] truncate flex-1 min-w-0">
          {title}
        </h3>
        {record.date && (
          <span className="text-[11px] text-slate-500 tabular-nums flex-shrink-0">
            {format(parseISO(record.date), "d. MMM", { locale: de })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", action.dotClass)} />
        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", action.textClass)}>
          {action.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
        {isEvent && record.guestCount ? <span>{record.guestCount} Gäste</span> : null}
        {!isEvent && record.itemsCount ? <span>{record.itemsCount} Artikel</span> : null}
        {record.totalAmount ? (
          <>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-700 tabular-nums">
              {formatCurrency(record.totalAmount)}
            </span>
          </>
        ) : null}
        <span className="ml-auto text-slate-400 truncate max-w-[40%]" title={record.email}>
          {record.customerName}
        </span>
      </div>
    </div>
  );
}

const SERVICE_META: Record<
  ServiceType,
  { label: string; tooltip: string; Icon: typeof UtensilsCrossed; chip: string }
> = {
  restaurant: {
    label: "Im Haus",
    tooltip: "Event im Restaurant",
    Icon: Home,
    chip: "bg-foreground text-background ring-1 ring-foreground",
  },
  catering: {
    label: "Außer Haus",
    tooltip: "Event-Catering an externen Ort",
    Icon: Truck,
    chip: "bg-foreground/10 text-foreground ring-1 ring-foreground/25",
  },
  catering_order: {
    label: "Catering-Shop",
    tooltip: "Bestellung über den Catering-Online-Shop",
    Icon: ShoppingBag,
    chip: "bg-foreground/5 text-foreground/80 ring-1 ring-foreground/15",
  },
};

export function ServiceBadge({
  serviceType,
  compact = false,
}: {
  serviceType: ServiceType;
  compact?: boolean;
}) {
  const m = SERVICE_META[serviceType];
  const Icon = m.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap",
        m.chip,
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]",
      )}
      title={m.tooltip}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

/** Backwards-compat alias — still imported by the legacy EventsList. */
export function KindBadge({
  kind,
  compact = false,
}: {
  kind: "event" | "catering";
  compact?: boolean;
}) {
  return (
    <ServiceBadge
      serviceType={kind === "event" ? "restaurant" : "catering_order"}
      compact={compact}
    />
  );
}
