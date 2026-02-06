import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, formatDistanceToNow, differenceInHours } from "date-fns";
import { de } from "date-fns/locale";
import {
  GripVertical,
  Calendar,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

// Kanban column configuration matching mockup
const COLUMNS = [
  {
    id: "new",
    title: "Neue Anfragen",
    color: "bg-blue-400",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  {
    id: "in_progress",
    title: "Qualifizierung",
    color: "bg-orange-400",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  {
    id: "offer_sent",
    title: "Angebot versendet",
    color: "bg-purple-400",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  {
    id: "confirmed",
    title: "Bestätigt",
    color: "bg-green-400",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

// Get badge label based on status and priority
function getBadgeLabel(event: EventInquiry, columnId: ColumnId): { label: string; class: string } {
  const isUrgent = event.status === 'new' && event.created_at &&
    differenceInHours(new Date(), parseISO(event.created_at)) > 48;

  if (event.priority === 'urgent' || isUrgent) {
    return { label: 'Dringend', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  }
  if (event.priority === 'high') {
    return { label: 'Hot Lead', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
  }

  switch (columnId) {
    case 'new':
      return { label: 'Anfrage', class: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
    case 'in_progress':
      return { label: 'In Prüfung', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
    case 'offer_sent':
      return { label: 'Wartet', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
    case 'confirmed':
      return { label: 'Gebucht', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
    default:
      return { label: 'Anfrage', class: 'bg-gray-100 text-gray-600' };
  }
}

export function KanbanView({ events, onRefresh }: KanbanViewProps) {
  const navigate = useNavigate();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  // Categorize events into columns
  const columnData = useMemo(() => {
    const newInquiries = events.filter(
      (e) => e.status === "new" && !e.last_edited_at
    );
    const inProgress = events.filter(
      (e) =>
        (e.last_edited_at || e.status === "contacted") &&
        e.status !== "offer_sent" &&
        e.status !== "confirmed" &&
        e.status !== "declined"
    );
    const offerSent = events.filter((e) => e.status === "offer_sent");
    const confirmed = events.filter((e) => e.status === "confirmed");

    return {
      new: newInquiries,
      in_progress: inProgress,
      offer_sent: offerSent,
      confirmed: confirmed,
    };
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

      let newStatus: InquiryStatus;
      switch (targetColumn) {
        case "new":
          newStatus = "new";
          break;
        case "in_progress":
          newStatus = "contacted";
          break;
        case "offer_sent":
          newStatus = "offer_sent";
          break;
        case "confirmed":
          newStatus = "confirmed";
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

  return (
    <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[500px] overflow-x-auto pb-4">
      {COLUMNS.map((column) => {
        const items = columnData[column.id];

        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-[300px] flex flex-col rounded-xl border border-border",
              "bg-muted/30 dark:bg-gray-800/30",
              dragOverColumn === column.id && "ring-2 ring-primary bg-primary/5"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <span className={cn("size-2 rounded-full", column.color)} />
                {column.title}
              </h3>
              <span className="bg-muted px-2 py-0.5 rounded text-xs font-bold">
                {items.length}
              </span>
            </div>

            {/* Column Content */}
            <ScrollArea className="flex-1 px-3 pb-3">
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Keine Anfragen
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

                {/* Drop zone indicator for confirmed column */}
                {column.id === 'confirmed' && (
                  <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all cursor-pointer">
                    <span className="text-xs font-bold uppercase tracking-widest">Hierher ziehen</span>
                  </div>
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

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-border",
        "cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all group",
        isDragging && "opacity-50 rotate-1 scale-105 shadow-lg",
        columnId === 'confirmed' && "border-l-4 border-l-green-500"
      )}
    >
      {/* Header with badge and drag handle */}
      <div className="flex justify-between items-start mb-3">
        <span className={cn(
          "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide",
          badge.class
        )}>
          {badge.label}
        </span>
        <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
      </div>

      {/* Title */}
      <h4 className="font-bold text-foreground mb-3 line-clamp-2">
        {event.company_name || event.contact_name}
      </h4>

      {/* Event Details */}
      <div className="space-y-2">
        {event.preferred_date && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {format(parseISO(event.preferred_date), "d. MMM yyyy", { locale: de })}
          </div>
        )}
        {event.guest_count && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {event.guest_count} Gäste
          </div>
        )}
      </div>

      {/* Footer with avatar and details link */}
      <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
        {event.assigned_to ? (
          <div
            className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary"
            title={event.assigned_to}
          >
            {getAdminInitials(event.assigned_to)}
          </div>
        ) : (
          <div className="size-6 rounded-full bg-muted" />
        )}
        <button className="text-xs text-primary font-bold hover:underline">
          Details
        </button>
      </div>
    </div>
  );
}
