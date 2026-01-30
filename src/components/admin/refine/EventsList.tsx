import { useState, useMemo } from "react";
import { useList } from "@refinedev/core";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Users, Building2, Mail, Phone, Plus, Edit3, Send } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventInquiry, InquiryStatus } from "@/types/refine";
import { EditorIndicator } from "@/components/admin/shared/EditorIndicator";
import { cn } from "@/lib/utils";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";

const statusConfig: Record<InquiryStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Neu", variant: "default" },
  contacted: { label: "Kontaktiert", variant: "secondary" },
  offer_sent: { label: "Angebot", variant: "outline" },
  confirmed: { label: "Bestätigt", variant: "default" },
  declined: { label: "Abgelehnt", variant: "destructive" },
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

type FilterType = 'all' | 'new' | 'in_progress' | 'offer_sent' | 'confirmed' | 'declined';

export const EventsList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [currentFilter, setCurrentFilter] = useState<FilterType>(initialFilter);

  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 100 },
    sorters: [{ field: "created_at", order: "desc" }],
  });

  const allEvents = eventsQuery.result?.data || [];
  const isLoading = eventsQuery.query.isLoading;

  // Categorize events based on status (the single source of truth)
  // Status 'offer_sent' means at least one version was sent - it stays there even when editing a new version
  const categorizedEvents = useMemo(() => {
    const newInquiries = allEvents.filter(e => 
      e.status === 'new' && !e.last_edited_at
    );
    const inProgress = allEvents.filter(e => 
      (e.last_edited_at || e.status === 'contacted') && 
      e.status !== 'offer_sent' && 
      e.status !== 'confirmed' && 
      e.status !== 'declined'
    );
    // offer_sent = status is the source of truth (set once, stays forever unless confirmed/declined)
    const offerSent = allEvents.filter(e => 
      e.status === 'offer_sent'
    );
    const confirmed = allEvents.filter(e => e.status === 'confirmed');
    const declined = allEvents.filter(e => e.status === 'declined');

    return { newInquiries, inProgress, offerSent, confirmed, declined };
  }, [allEvents]);

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
      default:
        return allEvents;
    }
  }, [currentFilter, categorizedEvents, allEvents]);

  // Filter pills with counts
  const filterPills = [
    { id: 'all', label: `Alle (${allEvents.length})`, value: 'all', active: currentFilter === 'all' },
    { id: 'new', label: `Neu (${categorizedEvents.newInquiries.length})`, value: 'new', active: currentFilter === 'new', icon: <span className="w-2 h-2 rounded-full bg-destructive/70 mr-1" /> },
    { id: 'in_progress', label: `In Bearbeitung (${categorizedEvents.inProgress.length})`, value: 'in_progress', active: currentFilter === 'in_progress', icon: <Edit3 className="h-3 w-3 mr-1 text-amber-600" /> },
    { id: 'offer_sent', label: `Angebot (${categorizedEvents.offerSent.length})`, value: 'offer_sent', active: currentFilter === 'offer_sent', icon: <Send className="h-3 w-3 mr-1 text-emerald-600" /> },
    { id: 'confirmed', label: `Bestätigt (${categorizedEvents.confirmed.length})`, value: 'confirmed', active: currentFilter === 'confirmed' },
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

        if (event.offer_sent_at && event.status !== 'confirmed' && event.status !== 'declined') {
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
          <div className="flex flex-col gap-0.5">
            <Badge variant="outline" className={cn("font-medium flex items-center w-fit", badgeClass)}>
              {statusIcon}
              {statusLabel}
            </Badge>
            {subLabel && (
              <span className="text-xs text-muted-foreground ml-0.5">{subLabel}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "preferred_date",
      header: "Datum",
      cell: ({ row }) => {
        const date = row.original.preferred_date;
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
        <div>
          <p className="font-medium">{row.original.contact_name}</p>
          {row.original.company_name && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {row.original.company_name}
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
    <AdminLayout activeTab="events">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Event-Anfragen</h1>
            <p className="text-base text-muted-foreground">
              Verwalten Sie Event-Anfragen und erstellen Sie Angebote.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/events/create">
              <Plus className="h-4 w-4 mr-2" />
              Neue Anfrage
            </Link>
          </Button>
        </div>

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
        />
      </div>
    </AdminLayout>
  );
};
