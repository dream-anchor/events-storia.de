import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInHours, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  Calendar,
  Users,
  Clock,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EventInquiry, InquiryStatus } from "@/types/refine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAdminInitials } from "@/lib/adminDisplayNames";

interface KanbanViewProps {
  events: EventInquiry[];
  onRefresh: () => void;
}

const COLUMNS = [
  {
    id: "lead",
    title: "Lead",
    dotColor: "bg-blue-500",
    badgeClass: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
  {
    id: "proposal",
    title: "Proposal",
    dotColor: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  },
  {
    id: "pending",
    title: "Pending",
    dotColor: "bg-purple-500",
    badgeClass: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
  },
  {
    id: "won",
    title: "Won",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  {
    id: "lost",
    title: "Lost",
    dotColor: "bg-red-500",
    badgeClass: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  },
  {
    id: "closed",
    title: "Closed",
    dotColor: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
  },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

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

function getBadgeLabel(event: EventInquiry, columnId: ColumnId): { label: string; class: string } {
  // Kunde hat geantwortet — höchste Priorität-Badge
  if (event.offer_phase === 'customer_responded') {
    return { label: 'Kunde antwortete', class: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400 ring-1 ring-teal-300' };
  }

  const isUrgent = event.priority === 'urgent' ||
    (event.status === 'new' && event.created_at && differenceInHours(new Date(), parseISO(event.created_at)) > 48);

  if (isUrgent) {
    return { label: 'Dringend', class: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' };
  }
  if (event.priority === 'high') {
    return { label: 'Hot Lead', class: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' };
  }

  switch (columnId) {
    case 'lead':
      return { label: 'Neu', class: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' };
    case 'proposal':
      return { label: 'In Bearbeitung', class: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' };
    case 'pending':
      return { label: 'Angebot versendet', class: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400' };
    case 'won':
      return { label: 'Gebucht', class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' };
    case 'lost':
      return { label: 'Abgesagt', class: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' };
    case 'closed':
      return { label: 'Abgeschlossen', class: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400' };
    default:
      return { label: 'Anfrage', class: 'bg-slate-100 text-slate-600' };
  }
}

function getInactivityLabel(event: EventInquiry): string | null {
  const lastActivity = event.updated_at || event.created_at;
  if (!lastActivity) return null;

  const hours = differenceInHours(new Date(), parseISO(lastActivity));
  const days = differenceInDays(new Date(), parseISO(lastActivity));

  if (days > 0) {
    return `Inaktiv seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
  }
  if (hours > 1) {
    return `Inaktiv seit ${hours} Std.`;
  }
  return 'Zuletzt: Gerade eben';
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
  const [collapsedColumns, setCollapsedColumns] = useState<Set<ColumnId>>(new Set());
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columnData = useMemo(() => {
    const data: Record<ColumnId, { items: EventInquiry[]; totalSum: number; totalGuests: number }> = {
      lead: { items: [], totalSum: 0, totalGuests: 0 },
      proposal: { items: [], totalSum: 0, totalGuests: 0 },
      pending: { items: [], totalSum: 0, totalGuests: 0 },
      won: { items: [], totalSum: 0, totalGuests: 0 },
      lost: { items: [], totalSum: 0, totalGuests: 0 },
      closed: { items: [], totalSum: 0, totalGuests: 0 },
    };

    events.forEach((event) => {
      const columnId = getColumnFromStatus(event);
      data[columnId].items.push(event);
      data[columnId].totalSum += event.total_amount || 0;
      data[columnId].totalGuests += parseInt(String(event.guest_count || '0'), 10) || 0;
    });

    return data;
  }, [events]);

  const toggleCollapsed = (columnId: ColumnId) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

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

      let newStatus: InquiryStatus;
      switch (targetColumn) {
        case "lead": newStatus = "new"; break;
        case "proposal": newStatus = "contacted"; break;
        case "pending": newStatus = "offer_sent"; break;
        case "won": newStatus = "confirmed"; break;
        case "lost": newStatus = "declined"; break;
        case "closed": newStatus = "cancelled"; break;
        default: return;
      }

      if (event.status === newStatus) return;

      try {
        const { error } = await supabase
          .from("event_inquiries")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", eventId);

        if (error) throw error;

        toast.success(`Status geändert zu "${COLUMNS.find((c) => c.id === targetColumn)?.title}"`);
        onRefresh();
      } catch (error) {
        console.error("Status update error:", error);
        toast.error("Fehler beim Aktualisieren des Status");
      }
    },
    [events, onRefresh]
  );

  return (
    <div className="space-y-6">
      {COLUMNS.map((column) => {
        const { items, totalSum, totalGuests } = columnData[column.id];
        const isCollapsed = collapsedColumns.has(column.id);
        const isDragOver = dragOverColumn === column.id;

        return (
          <section
            key={column.id}
            className={cn(
              "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all",
              isDragOver && "ring-2 ring-primary border-primary"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Section Header */}
            <button
              onClick={() => toggleCollapsed(column.id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-2xl"
            >
              <div className="flex items-center gap-3">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
                <div className={cn("w-2.5 h-2.5 rounded-full", column.dotColor)} />
                <h2 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-widest">
                  {column.title}
                </h2>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                  {items.length}
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-3">
                <span>{formatCurrency(totalSum)} Summe</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>{totalGuests} Gäste</span>
              </div>
            </button>

            {/* Cards Grid */}
            {!isCollapsed && (
              <div className="px-6 pb-5">
                {items.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-6 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <GripVertical className="h-5 w-5" />
                    <span className="text-xs font-medium uppercase tracking-widest">Hierher ziehen</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map((event) => (
                      <KanbanCard
                        key={event.id}
                        event={event}
                        columnId={column.id}
                        isDragging={draggingId === event.id}
                        onDragStart={(e) => handleDragStart(e, event.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => navigate(`/admin/events/${event.id}/edit`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Kanban Card Component
interface KanbanCardProps {
  event: EventInquiry;
  columnId: ColumnId;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function KanbanCard({
  event,
  columnId,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: KanbanCardProps) {
  const badge = getBadgeLabel(event, columnId);
  const inactivityLabel = getInactivityLabel(event);

  const isUrgent = event.priority === 'urgent' ||
    (event.status === 'new' && event.created_at && differenceInHours(new Date(), parseISO(event.created_at)) > 48);
  const hasCustomerResponse = event.offer_phase === 'customer_responded';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700",
        "hover:shadow-md hover:border-primary/40 transition-all group cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 rotate-1 scale-105 shadow-lg",
        hasCustomerResponse && "border-l-4 border-l-teal-500 bg-teal-50/30 dark:bg-teal-900/10",
        isUrgent && !hasCustomerResponse && "border-l-4 border-l-red-500"
      )}
    >
      {/* Header with badge */}
      <div className="flex justify-between items-start mb-3">
        <span className={cn(
          "text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider",
          badge.class
        )}>
          {badge.label}
        </span>
        <GripVertical className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>

      {/* Title */}
      <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2 line-clamp-2 text-sm">
        {event.company_name || event.contact_name || 'Unbenannte Anfrage'}
      </h3>

      {/* Event Details */}
      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        {event.preferred_date && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{format(parseISO(event.preferred_date), "d. MMM yyyy", { locale: de })}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          {event.guest_count ? (
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{event.guest_count} Gäste</span>
            </div>
          ) : <span />}
          {event.total_amount ? (
            <span className="text-primary font-bold">{formatCurrency(event.total_amount)}</span>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        {inactivityLabel ? (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 italic">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>{inactivityLabel}</span>
          </div>
        ) : <span />}
        {event.assigned_to && (
          <div
            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary ml-auto"
            title={event.assigned_to}
          >
            {getAdminInitials(event.assigned_to)}
          </div>
        )}
      </div>
    </div>
  );
}
