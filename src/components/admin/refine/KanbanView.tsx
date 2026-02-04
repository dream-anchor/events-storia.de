import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import {
  AlertCircle,
  Edit3,
  Send,
  CheckCircle2,
  Users,
  Building2,
  Phone,
  Mail,
  GripVertical,
  AlertTriangle,
  Flag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { EventInquiry, InquiryPriority, InquiryStatus } from "@/types/refine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAdminDisplayName, getAdminInitials } from "@/lib/adminDisplayNames";

interface KanbanViewProps {
  events: EventInquiry[];
  onRefresh: () => void;
}

// Kanban column configuration
const COLUMNS = [
  {
    id: "new",
    title: "Neu",
    icon: AlertCircle,
    color: "text-amber-600",
    borderColor: "border-l-amber-500",
    description: "Noch nicht bearbeitet",
  },
  {
    id: "in_progress",
    title: "In Bearbeitung",
    icon: Edit3,
    color: "text-blue-600",
    borderColor: "border-l-blue-500",
    description: "Angebot wird erstellt",
  },
  {
    id: "offer_sent",
    title: "Angebot versendet",
    icon: Send,
    color: "text-emerald-600",
    borderColor: "border-l-emerald-500",
    description: "Wartet auf Rückmeldung",
  },
  {
    id: "confirmed",
    title: "Bestätigt",
    icon: CheckCircle2,
    color: "text-green-600",
    borderColor: "border-l-green-500",
    description: "Buchung bestätigt",
  },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

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

      // Find the event
      const event = events.find((ev) => ev.id === eventId);
      if (!event) return;

      // Determine new status based on target column
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

      // Don't update if same status
      if (event.status === newStatus) return;

      // Update in database
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
    <div className="w-full overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-4">
        {COLUMNS.map((column) => {
          const items = columnData[column.id];
          const Icon = column.icon;

          return (
            <div
              key={column.id}
              className={cn(
                "flex-1 min-w-[300px] max-w-[350px] rounded-xl border bg-muted/30",
                column.borderColor,
                "border-l-4",
                dragOverColumn === column.id && "bg-primary/5 border-primary"
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="p-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", column.color)} />
                    <span className="font-medium">{column.title}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {items.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {column.description}
                </p>
              </div>

              {/* Column Content */}
              <ScrollArea className="h-[calc(100vh-340px)]">
                <div className="p-2 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Keine Anfragen
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
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Kanban Card Component
interface KanbanCardProps {
  event: EventInquiry;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function KanbanCard({
  event,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: KanbanCardProps) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "cursor-pointer hover:shadow-md transition-all",
        isDragging && "opacity-50 rotate-2 scale-105 shadow-lg"
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {event.company_name || event.contact_name}
              </p>
              {event.company_name && (
                <p className="text-xs text-muted-foreground truncate">
                  {event.contact_name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Priority */}
            {event.priority === "urgent" && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                <AlertTriangle className="h-2.5 w-2.5" />
              </Badge>
            )}
            {event.priority === "high" && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-700 bg-amber-50"
              >
                <Flag className="h-2.5 w-2.5" />
              </Badge>
            )}
            {/* Assignee */}
            {event.assigned_to && (
              <div
                className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium"
                title={getAdminDisplayName(event.assigned_to)}
              >
                {getAdminInitials(event.assigned_to)}
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {event.guest_count && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {event.guest_count}
            </span>
          )}
          {event.event_type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {event.event_type}
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <span>
            {event.created_at &&
              formatDistanceToNow(parseISO(event.created_at), {
                addSuffix: true,
                locale: de,
              })}
          </span>
          <div className="flex items-center gap-2">
            {event.email && <Mail className="h-3 w-3" />}
            {event.phone && <Phone className="h-3 w-3" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
