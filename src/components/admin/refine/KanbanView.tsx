import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays, differenceInHours } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronDown, ChevronRight, Archive, MoreVertical, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { EventInquiry, InquiryStatus } from "@/types/refine";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import { getAdminInitials } from "@/lib/adminDisplayNames";
import { getInquiryActionState, type ActionState } from "@/lib/inquiryActionState";

interface KanbanViewProps {
  events: EventInquiry[];
  onRefresh: () => void;
}

const PIPELINE_COLUMNS = [
  { id: "lead", title: "Neu" },
  { id: "proposal", title: "In Bearbeitung" },
  { id: "pending", title: "Angebot raus" },
  { id: "won", title: "Gebucht" },
] as const;

const ARCHIVE_COLUMNS = [
  { id: "lost", title: "Abgelehnt" },
  { id: "closed", title: "Abgesagt" },
] as const;

type ColumnId =
  | (typeof PIPELINE_COLUMNS)[number]["id"]
  | (typeof ARCHIVE_COLUMNS)[number]["id"];

function getColumnFromStatus(event: EventInquiry): ColumnId {
  switch (event.status) {
    case "new":
      return "lead";
    case "contacted":
      return "proposal";
    case "offer_sent":
      return "pending";
    case "confirmed":
      return "won";
    case "declined":
      return "lost";
    case "cancelled":
      return "closed";
    default:
      return "lead";
  }
}

function getInactivityLabel(event: EventInquiry): string | null {
  const lastActivity = event.updated_at || event.created_at;
  if (!lastActivity) return null;

  const hours = differenceInHours(new Date(), parseISO(lastActivity));
  const days = differenceInDays(new Date(), parseISO(lastActivity));

  if (days > 0) {
    return `${days}${days === 1 ? "d" : "d"}`;
  }
  if (hours > 1) return `${hours}h`;
  return null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function KanbanView({ events, onRefresh }: KanbanViewProps) {
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columnData = useMemo(() => {
    const data: Record<
      ColumnId,
      {
        items: EventInquiry[];
        totalSum: number;
        totalGuests: number;
        actionCounts: Record<ActionState, number>;
      }
    > = {
      lead: emptyBucket(),
      proposal: emptyBucket(),
      pending: emptyBucket(),
      won: emptyBucket(),
      lost: emptyBucket(),
      closed: emptyBucket(),
    };

    events.forEach((event) => {
      const columnId = getColumnFromStatus(event);
      data[columnId].items.push(event);
      data[columnId].totalSum += event.total_amount || 0;
      data[columnId].totalGuests += parseInt(String(event.guest_count || "0"), 10) || 0;
      const action = getInquiryActionState(event).state;
      data[columnId].actionCounts[action] += 1;
    });

    // Sort each column: respond first, then in_progress, then by date desc
    const order: Record<ActionState, number> = { respond: 0, in_progress: 1, won: 2, done: 3 };
    Object.values(data).forEach((bucket) => {
      bucket.items.sort((a, b) => {
        const aOrder = order[getInquiryActionState(a).state];
        const bOrder = order[getInquiryActionState(b).state];
        if (aOrder !== bOrder) return aOrder - bOrder;
        const aTime = a.updated_at || a.created_at || "";
        const bTime = b.updated_at || b.created_at || "";
        return bTime.localeCompare(aTime);
      });
    });

    return data;
  }, [events]);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, eventId: string) => {
      e.dataTransfer.setData("text/plain", eventId);
      setDraggingId(eventId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetColumn: ColumnId) => {
      e.preventDefault();
      const eventId = e.dataTransfer.getData("text/plain");
      setDraggingId(null);
      setDragOverColumn(null);

      if (!eventId) return;

      const event = events.find((ev) => ev.id === eventId);
      if (!event) return;

      await applyStatusChange(event, targetColumn);
    },
    [events]
  );

  const applyStatusChange = useCallback(
    async (event: EventInquiry, targetColumn: ColumnId) => {
      const map: Record<ColumnId, InquiryStatus> = {
        lead: "new",
        proposal: "contacted",
        pending: "offer_sent",
        won: "confirmed",
        lost: "declined",
        closed: "cancelled",
      };
      const newStatus = map[targetColumn];
      if (event.status === newStatus) return;
      try {
        const { error } = await supabase
          .from("event_inquiries")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", event.id);
        if (error) throw error;
        const allCols = [...PIPELINE_COLUMNS, ...ARCHIVE_COLUMNS];
        toast.success(
          `Status geändert zu „${allCols.find((c) => c.id === targetColumn)?.title}"`
        );
        onRefresh();
      } catch (error) {
        console.error("Status update error:", error);
        toast.error("Fehler beim Aktualisieren des Status");
      }
    },
    [onRefresh]
  );

  const handleArchiveCard = useCallback(
    async (eventId: string) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("event_inquiries")
          .update({
            archived_at: new Date().toISOString(),
            archived_by: user?.email || null,
          })
          .eq("id", eventId);
        if (error) throw error;
        toast.success("Anfrage archiviert");
        onRefresh();
      } catch (error) {
        console.error("Archive error:", error);
        toast.error("Fehler beim Archivieren");
      }
    },
    [onRefresh]
  );

  const renderColumn = (column: { id: ColumnId; title: string }) => {
    const { items, totalSum, actionCounts } = columnData[column.id];
    const isDragOver = dragOverColumn === column.id;
    return (
      <div
        key={column.id}
        className={cn(
          "flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60 transition-all min-w-0",
          isDragOver && "ring-2 ring-primary border-primary bg-primary/5"
        )}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.id)}
      >
        {/* Column Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-200/70">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="font-semibold text-slate-700 text-sm">{column.title}</h2>
            <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
              {items.length}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            {actionCounts.respond > 0 && (
              <span className="flex items-center gap-1 text-red-600 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {actionCounts.respond}
              </span>
            )}
            {actionCounts.in_progress > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {actionCounts.in_progress}
              </span>
            )}
            {actionCounts.won > 0 && (
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {actionCounts.won}
              </span>
            )}
            <span className="ml-auto tabular-nums">{formatCurrency(totalSum)}</span>
          </div>
        </div>

        {/* Cards */}
        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
          {items.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 flex items-center justify-center text-[11px] text-slate-400 uppercase tracking-wider">
              Hierher ziehen
            </div>
          ) : (
            items.map((event) => (
              <KanbanCard
                key={event.id}
                event={event}
                isDragging={draggingId === event.id}
                onDragStart={(e) => handleDragStart(e, event.id)}
                onDragEnd={handleDragEnd}
                onClick={() => navigate(`/admin/events/${event.id}/edit`)}
                onArchive={() => handleArchiveCard(event.id)}
                onMoveToColumn={(col) => applyStatusChange(event, col)}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  const archiveCount =
    columnData.lost.items.length + columnData.closed.items.length;

  return (
    <div className="space-y-4">
      {/* Pipeline: 4 columns horizontal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PIPELINE_COLUMNS.map(renderColumn)}
      </div>

      {/* Archive footer (collapsed by default) */}
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
              Abgelehnt & Abgesagt
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

function emptyBucket() {
  return {
    items: [] as EventInquiry[],
    totalSum: 0,
    totalGuests: 0,
    actionCounts: { respond: 0, in_progress: 0, won: 0, done: 0 } as Record<ActionState, number>,
  };
}

// Compact Kanban Card
interface KanbanCardProps {
  event: EventInquiry;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onArchive: () => void;
  onMoveToColumn: (col: ColumnId) => void;
}

function KanbanCard({
  event,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onArchive,
  onMoveToColumn,
}: KanbanCardProps) {
  const action = getInquiryActionState(event);
  const inactivity = getInactivityLabel(event);
  const rawCompany = event.company_name?.trim() ?? "";
  const isPlaceholderCompany = /^(private|privat)$/i.test(rawCompany);
  const title =
    (!isPlaceholderCompany && rawCompany) ||
    event.contact_name?.trim() ||
    "Unbenannte Anfrage";

  const currentColumn = (() => {
    switch (event.status) {
      case "new": return "lead" as ColumnId;
      case "contacted": return "proposal" as ColumnId;
      case "offer_sent": return "pending" as ColumnId;
      case "confirmed": return "won" as ColumnId;
      case "declined": return "lost" as ColumnId;
      case "cancelled": return "closed" as ColumnId;
      default: return "lead" as ColumnId;
    }
  })();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group relative bg-white p-3 rounded-xl border border-slate-200 border-l-[3px]",
        action.borderClass,
        "hover:shadow-sm hover:border-primary/40 transition-all cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-[0.98] shadow-md"
      )}
      title={action.label}
    >
      {/* Card actions menu — always visible (touch-friendly) */}
      <div
        className="absolute top-1 right-1"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              draggable={false}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-60 group-hover:opacity-100 transition-opacity"
              title="Aktionen"
              aria-label="Aktionen"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex items-center gap-2 text-xs">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Status ändern
            </DropdownMenuLabel>
            {PIPELINE_COLUMNS.map((c) => (
              <DropdownMenuItem
                key={c.id}
                disabled={c.id === currentColumn}
                onSelect={() => onMoveToColumn(c.id)}
              >
                {c.title}
                {c.id === currentColumn && (
                  <span className="ml-auto text-[10px] text-slate-400">aktuell</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {ARCHIVE_COLUMNS.map((c) => (
              <DropdownMenuItem
                key={c.id}
                disabled={c.id === currentColumn}
                onSelect={() => onMoveToColumn(c.id)}
                className="text-slate-500"
              >
                Als {c.title.toLowerCase()} markieren
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive} className="text-slate-700">
              <Archive className="h-3.5 w-3.5 mr-2" />
              Archivieren
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 1: dot + name + date */}
      <div className="flex items-center gap-2 min-w-0 pr-7">
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", action.dotClass)} />
        <h3 className="font-semibold text-slate-800 text-[13px] truncate flex-1 min-w-0">
          {title}
        </h3>
        {event.preferred_date && (
          <span className="text-[11px] text-slate-500 tabular-nums flex-shrink-0">
            {format(parseISO(event.preferred_date), "d. MMM", { locale: de })}
          </span>
        )}
      </div>

      {/* Row 2: meta */}
      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
        {event.guest_count ? <span>{event.guest_count} Gäste</span> : null}
        {event.guest_count && event.total_amount ? <span className="text-slate-300">·</span> : null}
        {event.total_amount ? (
          <span className="font-semibold text-slate-700 tabular-nums">
            {formatCurrency(event.total_amount)}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5">
          {inactivity && <span className="text-slate-400 tabular-nums">{inactivity}</span>}
          {event.assigned_to && (
            <span
              className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary"
              title={event.assigned_to}
            >
              {getAdminInitials(event.assigned_to)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
