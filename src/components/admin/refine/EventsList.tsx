import { useState, useMemo } from "react";
import { useList, useUpdate } from "@refinedev/core";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Users, Building2, Mail, Phone, ChevronRight, Edit, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventInquiry, InquiryStatus } from "@/types/refine";
import { cn } from "@/lib/utils";

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

export const EventsList = () => {
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | null>(null);

  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 50 },
    filters: statusFilter ? [{ field: "status", operator: "eq", value: statusFilter }] : [],
    sorters: [{ field: "created_at", order: "desc" }],
  });

  const events = eventsQuery.result?.data || [];
  const isLoading = eventsQuery.query.isLoading;

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    const allEvents = events;
    return {
      all: allEvents.length,
      new: allEvents.filter(e => e.status === 'new').length,
      contacted: allEvents.filter(e => e.status === 'contacted').length,
      offer_sent: allEvents.filter(e => e.status === 'offer_sent').length,
      confirmed: allEvents.filter(e => e.status === 'confirmed').length,
      declined: allEvents.filter(e => e.status === 'declined').length,
    };
  }, [events]);

  const filterPills = [
    { id: 'all', label: `Alle (${statusCounts.all})`, value: '', active: !statusFilter },
    { id: 'new', label: `Neu (${statusCounts.new})`, value: 'new', active: statusFilter === 'new' },
    { id: 'contacted', label: `Kontaktiert (${statusCounts.contacted})`, value: 'contacted', active: statusFilter === 'contacted' },
    { id: 'offer_sent', label: `Angebot (${statusCounts.offer_sent})`, value: 'offer_sent', active: statusFilter === 'offer_sent' },
    { id: 'confirmed', label: `Bestätigt (${statusCounts.confirmed})`, value: 'confirmed', active: statusFilter === 'confirmed' },
  ];

  const handleFilterChange = (filterId: string, value: string) => {
    if (filterId === 'all' || !value) {
      setStatusFilter(null);
    } else {
      setStatusFilter(value as InquiryStatus);
    }
  };

  const columns: ColumnDef<EventInquiry>[] = [
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status as InquiryStatus;
        const config = statusConfig[status] || statusConfig.new;
        return (
          <Badge variant={config.variant} className="font-medium">
            {config.label}
          </Badge>
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
      accessorKey: "email",
      header: "Kontakt",
      cell: ({ row }) => (
        <div className="space-y-1">
          <a href={`mailto:${row.original.email}`} className="text-sm text-primary hover:underline flex items-center gap-1">
            <Mail className="h-3 w-3" />
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
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/admin/events/${row.original.id}/edit`}>
              <Edit className="h-4 w-4 mr-1" />
              Angebot
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout activeTab="events">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold">Event-Anfragen</h1>
            <p className="text-muted-foreground">
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
          data={events}
          searchPlaceholder="Suche nach Name, Firma, E-Mail..."
          filterPills={filterPills}
          onFilterChange={handleFilterChange}
          onRefresh={() => eventsQuery.query.refetch()}
          isLoading={isLoading}
          pageSize={15}
        />
      </div>
    </AdminLayout>
  );
};
