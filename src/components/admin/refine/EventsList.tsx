import { useState, useMemo, useEffect } from "react";
import { useList } from "@refinedev/core";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Users, Building2, Mail, Phone, Plus, Edit3, Send, MessageSquare, User, Flag, AlertTriangle, LayoutGrid, Table2, Archive } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { KanbanView } from "./KanbanView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EventInquiry, InquiryStatus, InquiryPriority } from "@/types/refine";
import { EditorIndicator } from "@/components/admin/shared/EditorIndicator";
import { BulkActionBar } from "@/components/admin/shared/BulkActionBar";
import { cn } from "@/lib/utils";
import { getAdminDisplayName, getAdminInitials } from "@/lib/adminDisplayNames";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<InquiryStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Neu", variant: "default" },
  contacted: { label: "Kontaktiert", variant: "secondary" },
  offer_sent: { label: "Angebot", variant: "outline" },
  confirmed: { label: "Bestätigt", variant: "default" },
  declined: { label: "Abgelehnt", variant: "destructive" },
  cancelled: { label: "Storniert", variant: "destructive" },
};

const eventTypeLabels: Record<string, string> = {
  firmenfeier: "Firmenfeier",
  weihnachtsfeier: "Weihnachtsfeier",
  geburtstag: "Geburtstag",
  hochzeit: "Hochzeit",
  sommerfest: "Sommerfest",
  teamevent: "Teamevent",
  konferenz: "Konferenz",
  sonstiges: "Sonstiges",
};

type FilterType = 'all' | 'mine' | 'new' | 'in_progress' | 'offer_sent' | 'confirmed' | 'declined' | 'urgent' | 'archived';

// Priority badge component
const PriorityIndicator = ({ priority }: { priority?: InquiryPriority }) => {
  if (!priority || priority === "normal") return null;

  if (priority === "urgent") {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0">
        <AlertTriangle className="h-2.5 w-2.5" />
        Dringend
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-700 bg-amber-50">
      <Flag className="h-2.5 w-2.5" />
      Hoch
    </Badge>
  );
};

// Assignee indicator
const AssigneeIndicator = ({ email }: { email?: string | null }) => {
  if (!email) return null;

  const initials = getAdminInitials(email);
  const name = getAdminDisplayName(email);

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`Zugewiesen an ${name}`}>
      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
        {initials}
      </div>
    </div>
  );
};

export const EventsList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [currentFilter, setCurrentFilter] = useState<FilterType>(initialFilter);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "kanban">(
    () => (localStorage.getItem("eventsViewMode") as "table" | "kanban") || "table"
  );

  // Save view preference
  useEffect(() => {
    localStorage.setItem("eventsViewMode", viewMode);
  }, [viewMode]);

  // Get current user email
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserEmail(user?.email || null);
    });
  }, []);

  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 100 },
    sorters: [{ field: "created_at", order: "desc" }],
  });

  const allEvents = eventsQuery.result?.data || [];
  const isLoading = eventsQuery.query.isLoading;

  // Separate archived and active events
  const { activeEvents, archivedEvents } = useMemo(() => {
    const archived = allEvents.filter(e => e.archived_at);
    const active = allEvents.filter(e => !e.archived_at);
    return { activeEvents: active, archivedEvents: archived };
  }, [allEvents]);

  // Categorize events based on status (the single source of truth)
  // Status 'offer_sent' means at least one version was sent - it stays there even when editing a new version
  const categorizedEvents = useMemo(() => {
    const newInquiries = activeEvents.filter(e =>
      e.status === 'new' && !e.last_edited_at
    );
    const inProgress = activeEvents.filter(e =>
      (e.last_edited_at || e.status === 'contacted') &&
      e.status !== 'offer_sent' &&
      e.status !== 'confirmed' &&
      e.status !== 'declined'
    );
    // offer_sent = status is the source of truth (set once, stays forever unless confirmed/declined)
    const offerSent = activeEvents.filter(e =>
      e.status === 'offer_sent'
    );
    const confirmed = activeEvents.filter(e => e.status === 'confirmed');
    const declined = activeEvents.filter(e => e.status === 'declined');

    // My assigned inquiries (non-archived only)
    const mine = activeEvents.filter(e =>
      e.assigned_to === currentUserEmail &&
      e.status !== 'confirmed' &&
      e.status !== 'declined'
    );

    // Urgent/High priority (non-archived only)
    const urgent = activeEvents.filter(e =>
      (e.priority === 'urgent' || e.priority === 'high') &&
      e.status !== 'confirmed' &&
      e.status !== 'declined'
    );

    return { newInquiries, inProgress, offerSent, confirmed, declined, mine, urgent };
  }, [activeEvents, currentUserEmail]);

  // Get filtered events based on current filter
  const filteredEvents = useMemo(() => {
    switch (currentFilter) {
      case 'new':
        return categorizedEvents.newInquiries;
      case 'in_progress':
        return categorizedEvents.inProgress;
      case 'offer_sent':
        return categorizedEvents.offerSent;
      case 'confirmed':
        return categorizedEvents.confirmed;
      case 'declined':
        return categorizedEvents.declined;
      case 'mine':
        return categorizedEvents.mine;
      case 'urgent':
        return categorizedEvents.urgent;
      case 'archived':
        return archivedEvents;
      default:
        return activeEvents; // 'all' shows only active (non-archived) events
    }
  }, [currentFilter, categorizedEvents, activeEvents, archivedEvents]);

  // Filter pills with counts
  const filterPills = [
    { id: 'all', label: `Alle (${activeEvents.length})`, value: 'all', active: currentFilter === 'all' },
    ...(currentUserEmail && categorizedEvents.mine.length > 0 ? [{
      id: 'mine',
      label: `Meine (${categorizedEvents.mine.length})`,
      value: 'mine',
      active: currentFilter === 'mine',
      icon: <User className="h-3 w-3 mr-1 text-primary" />
    }] : []),
    ...(categorizedEvents.urgent.length > 0 ? [{
      id: 'urgent',
      label: `Dringend (${categorizedEvents.urgent.length})`,
      value: 'urgent',
      active: currentFilter === 'urgent',
      icon: <AlertTriangle className="h-3 w-3 mr-1 text-destructive" />
    }] : []),
    { id: 'new', label: `Neu (${categorizedEvents.newInquiries.length})`, value: 'new', active: currentFilter === 'new', icon: <span className="w-2 h-2 rounded-full bg-destructive/70 mr-1" /> },
    { id: 'in_progress', label: `In Bearbeitung (${categorizedEvents.inProgress.length})`, value: 'in_progress', active: currentFilter === 'in_progress', icon: <Edit3 className="h-3 w-3 mr-1 text-amber-600" /> },
    { id: 'offer_sent', label: `Angebot (${categorizedEvents.offerSent.length})`, value: 'offer_sent', active: currentFilter === 'offer_sent', icon: <Send className="h-3 w-3 mr-1 text-emerald-600" /> },
    { id: 'confirmed', label: `Bestätigt (${categorizedEvents.confirmed.length})`, value: 'confirmed', active: currentFilter === 'confirmed' },
    { id: 'archived', label: `Archiv (${archivedEvents.length})`, value: 'archived', active: currentFilter === 'archived', icon: <Archive className="h-3 w-3 mr-1 text-muted-foreground" /> },
  ];

  const handleFilterChange = (filterId: string, value: string) => {
    const newFilter = value as FilterType || 'all';
    setCurrentFilter(newFilter);
    if (newFilter === 'all') {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', newFilter);
    }
    setSearchParams(searchParams);
  };

  const columns: ColumnDef<EventInquiry>[] = [
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const event = row.original;
        // Determine visual status based on tracking
        let statusLabel = '';
        let statusIcon = null;
        let badgeClass = '';
        let subLabel: string | null = null;

        // Kunde hat geantwortet — prominentes Badge
        if (event.offer_phase === 'customer_responded') {
          statusLabel = 'Kunde antwortete';
          badgeClass = 'border-teal-500/50 text-teal-700 bg-teal-50 ring-1 ring-teal-300';
        }
        // Check if archived first
        else if (event.archived_at) {
          statusLabel = 'Archiviert';
          statusIcon = <Archive className="h-3 w-3 mr-1" />;
          badgeClass = 'border-slate-400/50 text-slate-600 bg-slate-100';
          if (event.archived_by) {
            subLabel = `von ${getAdminDisplayName(event.archived_by)}`;
          }
        } else if (event.offer_sent_at && event.status !== 'confirmed' && event.status !== 'declined') {
          statusLabel = 'Angebot gesendet';
          statusIcon = <Send className="h-3 w-3 mr-1" />;
          badgeClass = 'border-emerald-500/50 text-emerald-700 bg-emerald-50';
          // Use central admin display name
          if (event.offer_sent_by) {
            subLabel = `von ${getAdminDisplayName(event.offer_sent_by)}`;
          }
        } else if (event.last_edited_at && !event.offer_sent_at) {
          statusLabel = 'In Bearbeitung';
          statusIcon = <Edit3 className="h-3 w-3 mr-1" />;
          badgeClass = 'border-amber-500/50 text-amber-700 bg-amber-50';
          // Use central admin display name
          if (event.last_edited_by) {
            subLabel = `von ${getAdminDisplayName(event.last_edited_by)}`;
          }
        } else if (event.status === 'confirmed') {
          statusLabel = 'Bestätigt';
          badgeClass = 'border-foreground/50 text-foreground bg-muted';
        } else if (event.status === 'declined') {
          statusLabel = 'Abgelehnt';
          badgeClass = 'border-muted-foreground/50 text-muted-foreground bg-muted';
        } else {
          statusLabel = 'Neu';
          badgeClass = 'border-amber-500/50 text-amber-700 bg-amber-50';
        }

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={cn("font-medium flex items-center w-fit", badgeClass)}>
                {statusIcon}
                {statusLabel}
              </Badge>
              <PriorityIndicator priority={event.priority as InquiryPriority} />
              <AssigneeIndicator email={event.assigned_to} />
            </div>
            {subLabel && (
              <span className="text-xs text-muted-foreground ml-0.5">{subLabel}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: "Eingegangen",
      cell: ({ row }) => {
        const date = row.original.created_at;
        if (!date) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(parseISO(date), "EEE, dd.MM.yy", { locale: de })}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "contact_name",
      header: "Kontakt",
      cell: ({ row }) => (
        <div className="max-w-[280px]">
          <p className="font-medium">{row.original.contact_name}</p>
          {row.original.company_name && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {row.original.company_name}
            </p>
          )}
          {row.original.message && (
            <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 italic flex items-start gap-1">
              <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="truncate">"{row.original.message.slice(0, 80)}{row.original.message.length > 80 ? '...' : ''}"</span>
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "event_type",
      header: "Event",
      cell: ({ row }) => {
        const type = row.original.event_type;
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {eventTypeLabels[type || ''] || type || '-'}
            </Badge>
            {row.original.guest_count && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {row.original.guest_count}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "last_edited_at",
      header: "Bearbeitet",
      cell: ({ row }) => {
        const event = row.original;
        if (!event.last_edited_at) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <EditorIndicator 
            editedAt={event.last_edited_at}
            compact
          />
        );
      },
    },
    {
      accessorKey: "email",
      header: "E-Mail",
      cell: ({ row }) => (
        <div className="space-y-1">
          <a href={`mailto:${row.original.email}`} className="text-sm text-foreground hover:underline flex items-center gap-1">
            <Mail className="h-3 w-3 text-muted-foreground" />
            {row.original.email}
          </a>
          {row.original.phone && (
            <a href={`tel:${row.original.phone}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {row.original.phone}
            </a>
          )}
        </div>
      ),
    },
  ];

  const handleRowClick = (event: EventInquiry) => {
    navigate(`/admin/events/${event.id}/edit`);
  };

  return (
    <AdminLayout activeTab="events" showCreateButton={false}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Event-Anfragen</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeEvents.length} aktive Anfragen • {archivedEvents.length} archiviert
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as "table" | "kanban")}
              className="bg-muted/50 rounded-lg p-1"
            >
              <ToggleGroupItem
                value="table"
                aria-label="Tabellenansicht"
                className="h-8 px-3 data-[state=on]:bg-white dark:data-[state=on]:bg-gray-800 data-[state=on]:shadow-sm rounded-md"
              >
                <Table2 className="h-4 w-4 mr-1.5" />
                Tabelle
              </ToggleGroupItem>
              <ToggleGroupItem
                value="kanban"
                aria-label="Kanban-Ansicht"
                className="h-8 px-3 data-[state=on]:bg-white dark:data-[state=on]:bg-gray-800 data-[state=on]:shadow-sm rounded-md"
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Kanban
              </ToggleGroupItem>
            </ToggleGroup>

            <Button asChild className="shadow-sm">
              <Link to="/admin/events/create">
                <Plus className="h-4 w-4 mr-2" />
                Neue Anfrage
              </Link>
            </Button>
          </div>
        </div>

        {viewMode === "table" ? (
          <>
            <DataTable
              columns={columns}
              data={filteredEvents}
              searchPlaceholder="Suche nach Name, Firma, E-Mail..."
              filterPills={filterPills}
              onFilterChange={handleFilterChange}
              onRefresh={() => eventsQuery.query.refetch()}
              onRowClick={handleRowClick}
              isLoading={isLoading}
              pageSize={15}
              enableSelection
              selectedRowIds={selectedIds}
              onSelectionChange={setSelectedIds}
              getRowId={(row) => row.id}
            />

            {/* Bulk Action Bar */}
            <BulkActionBar
              selectedIds={selectedIds}
              onClearSelection={() => setSelectedIds([])}
              onActionComplete={() => eventsQuery.query.refetch()}
              showRestoreAction={currentFilter === 'archived'}
            />
          </>
        ) : (
          <KanbanView
            events={allEvents}
            onRefresh={() => eventsQuery.query.refetch()}
          />
        )}
      </div>
    </AdminLayout>
  );
};
