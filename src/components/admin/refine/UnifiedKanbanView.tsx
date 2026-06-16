import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  Archive,
  Home,
  UtensilsCrossed,
  Truck,
  ShoppingBag,
  Users,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import type {
  InquiryRecord,
  ServiceType,
  LifecycleBucket,
} from "@/types/inquiryRecord";
import { getRecordActionState } from "@/lib/inquiryActionState";
import { useFailedDeliveryInquiries } from "@/hooks/useFailedDeliveryInquiries";
import { useAiOriginInquiries } from "@/hooks/useAiOriginInquiries";

interface UnifiedKanbanViewProps {
  records: InquiryRecord[];
  onRefresh: () => void;
  bucket: LifecycleBucket;
  onOpenGroup?: (id: string) => void;
}

/**
 * Sub-Spalten innerhalb eines Buckets. Eine ID = ein Ziel-Status (für Drag-and-Drop).
 * Drag wechselt nur innerhalb desselben Buckets — Bucket-Wechsel passiert über
 * Status-Änderung (z.B. „als bezahlt markieren") oder den Archiv-Button.
 */
type SubColumn = {
  id: string;
  title: string;
  match: (r: InquiryRecord) => boolean;
  /** Optional: Drop auf diese Spalte setzt diesen Status (nur events). */
  dropStatus?: string;
  /** Optional: Drop setzt zusätzlich `archived = true`. */
  dropArchive?: boolean;
};

const BUCKET_COLUMNS: Record<LifecycleBucket, SubColumn[]> = {
  inbox: [
    {
      id: "lead",
      title: "Neu",
      match: (r) => r.status === "inquiry" || r.status === "pending",
      dropStatus: "inquiry",
    },
    {
      id: "proposal",
      title: "In Bearbeitung",
      match: (r) => r.status === "offer_draft",
      dropStatus: "offer_draft",
    },
    {
      id: "pending",
      title: "Angebot raus",
      match: (r) => r.status === "offer_sent",
      dropStatus: "offer_sent",
    },
  ],
  won: [
    {
      id: "confirmed",
      title: "Bestätigt",
      match: (r) => r.status === "offer_chosen" || r.status === "confirmed",
      dropStatus: "offer_chosen",
    },
    {
      id: "paid",
      title: "Bezahlt",
      match: (r) => r.status === "paid",
      dropStatus: "paid",
    },
  ],
  done: [
    {
      id: "completed",
      title: "Abgeschlossen",
      match: () => true,
    },
  ],
  archive: [
    {
      id: "cancelled",
      title: "Storniert",
      match: (r) => r.status === "cancelled",
    },
    {
      id: "declined",
      title: "Abgelehnt",
      match: (r) =>
        r.status === "offer_declined" ||
        r.status === "payment_failed" ||
        r.status === "no_response",
    },
    {
      id: "manual",
      title: "Manuell archiviert",
      match: (r) =>
        !!r.archived &&
        r.status !== "cancelled" &&
        r.status !== "offer_declined" &&
        r.status !== "payment_failed" &&
        r.status !== "no_response",
    },
  ],
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function UnifiedKanbanView({ records, onRefresh, bucket, onOpenGroup }: UnifiedKanbanViewProps) {
  const navigate = useNavigate();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const failedDeliveryIds = useFailedDeliveryInquiries();
  const aiOriginIds = useAiOriginInquiries();

  const columns = BUCKET_COLUMNS[bucket];

  const columnData = useMemo(() => {
    const data: Record<string, { items: InquiryRecord[]; totalSum: number }> = {};
    columns.forEach((c) => {
      data[c.id] = { items: [], totalSum: 0 };
    });
    // Fallback-Bucket für Records, die in keine Sub-Spalte fallen.
    const fallback = columns[0]?.id;
    records.forEach((r) => {
      const target = columns.find((c) => c.match(r))?.id ?? fallback;
      if (!target) return;
      data[target].items.push(r);
      data[target].totalSum += r.totalAmount || 0;
    });
    // Sortierung passend zum Bucket
    const ts = (s?: string | null) => (s ? new Date(s).getTime() : 0);
    const sorter =
      bucket === "won"
        ? (a: InquiryRecord, b: InquiryRecord) =>
            (ts(a.date) || Infinity) - (ts(b.date) || Infinity)
        : bucket === "done"
          ? (a: InquiryRecord, b: InquiryRecord) => ts(b.date) - ts(a.date)
          : (a: InquiryRecord, b: InquiryRecord) =>
              ts(b.updatedAt) - ts(a.updatedAt);
    Object.values(data).forEach((b) => b.items.sort(sorter));
    return data;
  }, [records, columns, bucket]);

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
      const record = records.find((r) => r.id === id);
      if (!record || record.kind !== "event") return;
      const target = columns.find((c) => c.id === targetId);
      if (!target?.dropStatus) return;
      if (record.status === target.dropStatus) return;
      try {
        const { error } = await supabase
          .from("v2_events")
          .update({
            status: target.dropStatus as any,
            ...(target.dropArchive
              ? {
                  archived: true,
                  archived_at: new Date().toISOString(),
                }
              : {}),
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
    [records, onRefresh, columns]
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

  const renderColumn = (column: SubColumn) => {
    const { items, totalSum } = columnData[column.id];
    const isDragOver = dragOverColumn === column.id;
    const isDroppable = !!column.dropStatus;
    return (
      <div
        key={column.id}
        className={cn(
          "flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60 transition-all min-w-0",
          isDragOver && "ring-2 ring-foreground/40 border-foreground/40 bg-foreground/5"
        )}
        onDragOver={(e) => isDroppable && handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => isDroppable && handleDrop(e, column.id)}
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
              {isDroppable ? "Hierher ziehen" : "Leer"}
            </div>
          ) : (
            items.map((r) => (
              <UnifiedKanbanCard
                key={`${r.kind}-${r.id}`}
                record={r}
                isDragging={draggingId === r.id}
                hasDeliveryFailure={r.kind === "event" && failedDeliveryIds.has(r.id)}
                hasAiOrigin={r.kind === "event" && aiOriginIds.has(r.id)}
                onDragStart={(e) => handleDragStart(e, r)}
                onDragEnd={handleDragEnd}
                onClick={() =>
                  navigate(
                    r.kind === "event"
                      ? `/admin/inquiries/${r.id}/edit`
                      : `/admin/orders/${r.id}/edit`,
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

  const total = columns.reduce(
    (sum, c) => sum + (columnData[c.id]?.items.length ?? 0),
    0,
  );

  // Spalten-Grid-Klassen abhängig von Anzahl
  const gridClass =
    columns.length >= 3
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      : columns.length === 2
        ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
        : "grid grid-cols-1 gap-3";

  return (
    <div className="space-y-4">
      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-16 text-center text-sm text-slate-400">
          Keine Anfragen in diesem Bereich
        </div>
      ) : (
        <div className={gridClass}>{columns.map(renderColumn)}</div>
      )}
    </div>
  );
}

interface CardProps {
  record: InquiryRecord;
  isDragging: boolean;
  hasDeliveryFailure?: boolean;
  hasAiOrigin?: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onArchive: () => void;
}

function UnifiedKanbanCard({ record, isDragging, hasDeliveryFailure, hasAiOrigin, onDragStart, onDragEnd, onClick, onArchive }: CardProps) {
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
        isDragging && "opacity-40 scale-[0.98] shadow-md",
        hasDeliveryFailure && "border-red-500 border-2 ring-1 ring-red-200 bg-red-50/40"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {hasDeliveryFailure && (
          <span
            className="text-base leading-none flex-shrink-0"
            title="Letzte E-Mail an den Kunden konnte nicht zugestellt werden (Bounce / Fehler)"
            aria-label="Zustellfehler"
          >
            🚨
          </span>
        )}
        <ServiceBadge serviceType={record.serviceType} />
        {hasAiOrigin && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full bg-foreground/8 text-foreground/70 ring-1 ring-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap flex-shrink-0"
            title="Über KI-Bar angefragt"
            aria-label="Über KI-Bar angefragt"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            KI
          </span>
        )}
        <h3 className="font-semibold text-slate-800 text-[13px] truncate flex-1 min-w-0">
          {title}
        </h3>
        <button
          type="button"
          disabled={record.kind !== "event"}
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Archivieren"
          title={record.kind === "event" ? "Archivieren" : "Shop-Bestellungen über Status stornieren"}
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
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
  group: {
    label: "Reisegruppe",
    tooltip: "Anfrage von ristorantestoria.de/reisegruppen",
    Icon: Users,
    chip: "bg-foreground/10 text-foreground ring-1 ring-foreground/25",
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
