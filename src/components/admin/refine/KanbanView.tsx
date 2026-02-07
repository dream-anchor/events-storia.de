import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInHours, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  Calendar,
  Users,
  Clock,
  GripVertical,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { EventInquiry, InquiryStatus } from "@/types/refine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAdminInitials } from "@/lib/adminDisplayNames";

interface KanbanViewProps {
  events: EventInquiry[];
  onRefresh: () => void;
}

// Updated Kanban columns matching user request
const COLUMNS = [
  {
    id: "lead",
    title: "Lead",
    color: "bg-blue-500",
    badgeClass: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  {
    id: "proposal",
    title: "Proposal",
    color: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  {
    id: "pending",
    title: "Pending",
    color: "bg-purple-500",
    badgeClass: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
    dotColor: "bg-purple-500",
  },
  {
    id: "won",
    title: "Won",
    color: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  {
    id: "lost",
    title: "Lost",
    color: "bg-red-500",
    badgeClass: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    dotColor: "bg-red-500",
  },
  {
    id: "closed",
    title: "Closed",
    color: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
    dotColor: "bg-slate-400",
  },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

// Map internal status to column
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

// Get badge label based on status and priority
function getBadgeLabel(event: EventInquiry, columnId: ColumnId): { label: string; class: string } {
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

// Calculate inactivity time
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

export function KanbanView({ events, onRefresh }: KanbanViewProps) {
  const navigate = useNavigate();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  // Categorize events into columns with stats
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
      data[columnId].totalGuests += event.guest_count || 0;
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

      // Map column to status
      let newStatus: InquiryStatus;
      switch (targetColumn) {
        case "lead":
          newStatus = "new";
          break;
        case "proposal":
          newStatus = "contacted";
          break;
        case "pending":
          newStatus = "offer_sent";
          break;
        case "won":
          newStatus = "confirmed";
          break;
        case "lost":
          newStatus = "declined";
          break;
        case "closed":
          newStatus = "cancelled";
          break;
        default:
          return;
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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[500px] overflow-x-auto pb-4">
      {COLUMNS.map((column) => {
        const { items, totalSum, totalGuests } = columnData[column.id];
        const isEmpty = items.length === 0;

        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-80 flex flex-col gap-4",
              dragOverColumn === column.id && "ring-2 ring-primary rounded-2xl"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="flex flex-col gap-1 px-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", column.dotColor)} />
                  <h2 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-widest">
                    {column.title}
                  </h2>
                  <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {items.length}
                  </span>
                </div>
              </div>
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-2">
                <span>{formatCurrency(totalSum)} Summe</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>{totalGuests} Gäste</span>
              </div>
            </div>

            {/* Column Content */}
            <ScrollArea className="flex-1 pr-2">
              <div className="flex flex-col gap-3">
                {isEmpty ? (
                  <div className="h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-2">
                    <GripVertical className="h-6 w-6" />
                    <span className="text-xs font-medium uppercase tracking-widest">Hierher ziehen</span>
                  </div>
                ) : (
                  items.map((event) => (
                    <KanbanCard
                      key={event.id}
                      event={event}
                      columnId={column.id}
                      isDragging={draggingId === event.id}
                      onDragStart={(e) => handleDragStart(e, event.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/admin/events/${event.id}/edit`)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
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

  // Determine if card should have left border (urgent)
  const isUrgent = event.priority === 'urgent' ||
    (event.status === 'new' && event.created_at && differenceInHours(new Date(), parseISO(event.created_at)) > 48);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800",
        "shadow-sm hover:shadow-md transition-all group cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 rotate-1 scale-105 shadow-lg",
        isUrgent && "border-l-4 border-l-red-500"
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
        <button
          className="text-slate-300 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      {/* Title */}
      <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2 line-clamp-2">
        {event.company_name || event.contact_name || 'Unbenannte Anfrage'}
      </h3>

      {/* Event Details */}
      <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
        {event.preferred_date && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(parseISO(event.preferred_date), "d. MMM yyyy", { locale: de })}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          {event.guest_count && (
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              <span>{event.guest_count} Gäste</span>
            </div>
          )}
          {event.total_amount ? (
            <div className="text-primary font-bold">
              {formatCurrency(event.total_amount)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        {inactivityLabel && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 italic">
            <Clock className="h-3.5 w-3.5" />
            <span>{inactivityLabel}</span>
          </div>
        )}
        <div className="flex -space-x-2 ml-auto">
          {event.assigned_to && (
            <div
              className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary"
              title={event.assigned_to}
            >
              {getAdminInitials(event.assigned_to)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
