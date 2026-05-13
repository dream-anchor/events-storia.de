import { useState, useMemo, useEffect } from "react";
import { useList } from "@refinedev/core";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Users, Building2, Mail, Phone, Plus, Edit3, Send, MessageSquare, User, Flag, AlertTriangle, LayoutGrid, Table2, Archive, Printer } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import { DataTable, sortableHeader } from "./DataTable";
import { KanbanView } from "./KanbanView";
import { Home, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EventInquiry, InquiryStatus, InquiryPriority } from "@/types/refine";
import { EditorIndicator } from "@/components/admin/shared/EditorIndicator";
import { useTestMode } from "@/contexts/TestModeContext";
import { BulkActionBar } from "@/components/admin/shared/BulkActionBar";
import { cn } from "@/lib/utils";
import { getAdminDisplayName, getAdminInitials } from "@/lib/adminDisplayNames";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getInquiryActionState } from "@/lib/inquiryActionState";
import { MobileCardItem } from "@/components/admin/shared/responsive/MobileCardList";
import { UpcomingOrdersPrintDialog } from "./print/UpcomingOrdersPrintDialog";
import type { InquiryRecord } from "@/types/inquiryRecord";

function eventToInquiryRecord(e: EventInquiry): InquiryRecord {
  const kind = getServiceKind(e);
  const serviceType = kind === "in_house" ? "restaurant" : kind === "catering" ? "catering" : "group";
  const guests = typeof e.guest_count === "string" ? parseInt(e.guest_count, 10) : (e.guest_count as any);
  return {
    id: e.id,
    kind: "event",
    serviceType: serviceType as InquiryRecord["serviceType"],
    number: (e as any).booking_number || e.id.slice(0, 8),
    customerName: e.contact_name,
    companyName: e.company_name,
    email: e.email,
    phone: e.phone ?? null,
    date: e.preferred_date ?? null,
    time: e.time_slot ?? null,
    guestCount: Number.isFinite(guests) ? guests : null,
    totalAmount: (e as any).total_amount ?? null,
    status: e.status,
    offerPhase: (e as any).offer_phase ?? null,
    column: "lead" as InquiryRecord["column"],
    createdAt: e.created_at,
    updatedAt: e.updated_at ?? e.created_at,
    archivedAt: e.archived_at ?? null,
    archived: !!e.archived_at,
    raw: e as any,
  };
}

const statusConfig: Record<InquiryStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Neu", variant: "default" },
  contacted: { label: "Kontaktiert", variant: "secondary" },
  offer_sent: { label: "Angebot verschickt", variant: "outline" },
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

type ServiceKind = "in_house" | "catering" | "group";
function getServiceKind(event: EventInquiry): ServiceKind {
  const src = (event as any).source?.toString().toLowerCase() ?? "";
  if (src.includes("reisegruppen") || src === "group") return "group";
  if ((event as any).inquiry_type === "catering") return "catering";
  const loc = (event as any).location_type;
  if (loc === "company" || loc === "custom") return "catering";
  return "in_house";
}
const SERVICE_LABELS: Record<ServiceKind, { label: string; Icon: typeof Home }> = {
  in_house: { label: "Im Haus", Icon: Home },
  catering: { label: "Außer Haus", Icon: Truck },
  group:    { label: "Reisegruppe", Icon: Users },
};

// Filter-Konzept (Option C, 16.04.2026):
// - 'all':       alle aktiven (non-archived) — Default
// - 'inbox':     Eingang = aktive ohne confirmed/declined (ersetzt Neu + In Bearbeitung + Angebot)
// - 'confirmed': Bestätigte Events
// - 'declined':  Abgelehnte Events
// - 'archived':  Archivierte
// - 'mine':      Mir zugewiesen (kontext-sensitiv, nur wenn >0)
// - 'urgent':    Dringend/Hoch (kontext-sensitiv, nur wenn >0)
type FilterType = 'all' | 'inbox' | 'confirmed' | 'declined' | 'archived' | 'mine' | 'urgent';

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
  const [paymentStatus, setPaymentStatus] = useState<Record<string, 'none' | 'pending' | 'partial' | 'complete' | 'overdue'>>({});
  const [printOpen, setPrintOpen] = useState(false);
  const { showTestData } = useTestMode();

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
    filters: showTestData
      ? []
      : [{ field: "is_test", operator: "ne", value: true }],
    queryOptions: {
      queryKey: ["events-list", showTestData] as unknown as readonly unknown[],
    },
  });

  const allEvents = eventsQuery.result?.data || [];
  const isLoading = eventsQuery.query.isLoading;

  // Bookings ohne Quell-Inquiry → eigenständige „Gebucht"-Karten im Kanban
  const bookingsQuery = useQuery({
    queryKey: ["events-list-bookings", showTestData],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_bookings")
        .select(
          "id, booking_number, customer_name, company_name, customer_email, phone, guest_count, event_date, event_time, status, payment_status, total_amount, source_inquiry_id, menu_confirmed, created_at, updated_at, is_test"
        )
        .is("source_inquiry_id", null)
        .not("status", "in", "(cancelled,refunded)")
        .limit(200);
      if (error) throw error;
      const rows = (data || []) as any[];
      return showTestData ? rows : rows.filter(r => r.is_test !== true);
    },
  });

  // Map standalone bookings into EventInquiry shape (status='confirmed' for Kanban "Gebucht")
  const bookingEvents: EventInquiry[] = useMemo(() => {
    const rows = bookingsQuery.data || [];
    return rows.map((b: any) => ({
      id: `booking-${b.id}`,
      company_name: b.company_name ?? null,
      contact_name: b.customer_name ?? "",
      email: b.customer_email ?? "",
      phone: b.phone ?? null,
      guest_count: b.guest_count ? String(b.guest_count) : null,
      event_type: null,
      preferred_date: b.event_date ?? null,
      event_end_date: null,
      time_slot: b.event_time ?? null,
      venue: null,
      message: null,
      source: "booking",
      status: "confirmed" as InquiryStatus,
      internal_notes: null,
      notification_sent: true,
      created_at: b.created_at,
      updated_at: b.updated_at ?? b.created_at,
      last_edited_by: null,
      last_edited_at: null,
      offer_sent_at: null,
      offer_sent_by: null,
      assigned_to: null,
      assigned_at: null,
      assigned_by: null,
      priority: "normal",
      archived_at: null,
      archived_by: null,
      lexoffice_invoice_id: null,
      lexoffice_document_type: null,
      lexoffice_contact_id: null,
      offer_phase: "confirmed",
      total_amount: b.total_amount ?? null,
      selected_option_id: null,
    }));
  }, [bookingsQuery.data]);

  // Separate archived and active events. Standalone bookings always count as active "Gebucht".
  const { activeEvents, archivedEvents } = useMemo(() => {
    const archived = allEvents.filter(e => e.archived_at);
    const active = allEvents.filter(e => !e.archived_at);
    return {
      activeEvents: [...active, ...bookingEvents],
      archivedEvents: archived,
    };
  }, [allEvents, bookingEvents]);

  // Batch-load payment status for all visible events
  useEffect(() => {
    if (!allEvents.length) return;
    const ids = allEvents.map(e => e.id);
    (supabase as any)
      .from('event_payments')
      .select('inquiry_id, status')
      .in('inquiry_id', ids)
      .not('status', 'in', '(cancelled,refunded)')
      .then(({ data }: { data: any[] | null }) => {
        if (!data) return;
        const result: Record<string, 'none' | 'pending' | 'partial' | 'complete' | 'overdue'> = {};
        for (const p of data) {
          const cur = result[p.inquiry_id];
          if (p.status === 'overdue') {
            result[p.inquiry_id] = 'overdue';
          } else if (!cur || cur === 'none') {
            result[p.inquiry_id] = p.status === 'paid' ? 'partial' : 'pending';
          } else if (cur === 'partial' && p.status !== 'paid') {
            result[p.inquiry_id] = 'partial';
          }
        }
        // Alle paid → complete
        const paidCounts: Record<string, number> = {};
        const totalCounts: Record<string, number> = {};
        for (const p of data) {
          totalCounts[p.inquiry_id] = (totalCounts[p.inquiry_id] || 0) + 1;
          if (p.status === 'paid') paidCounts[p.inquiry_id] = (paidCounts[p.inquiry_id] || 0) + 1;
        }
        for (const id of Object.keys(totalCounts)) {
          if (result[id] !== 'overdue' && paidCounts[id] === totalCounts[id]) {
            result[id] = 'complete';
          }
        }
        setPaymentStatus(result);
      });
  }, [allEvents]);

  // Categorize events (Option C — vereinfachtes Filter-Konzept)
  const categorizedEvents = useMemo(() => {
    // Eingang = alles Aktive außer confirmed/declined
    const inbox = activeEvents.filter(e =>
      e.status !== 'confirmed' && e.status !== 'declined'
    );
    const confirmed = activeEvents.filter(e => e.status === 'confirmed');
    const declined = activeEvents.filter(e => e.status === 'declined');

    // Meine (kontext-sensitiv)
    const mine = activeEvents.filter(e =>
      e.assigned_to === currentUserEmail &&
      e.status !== 'confirmed' &&
      e.status !== 'declined'
    );

    // Dringend/Hoch (kontext-sensitiv)
    const urgent = activeEvents.filter(e =>
      (e.priority === 'urgent' || e.priority === 'high') &&
      e.status !== 'confirmed' &&
      e.status !== 'declined'
    );

    return { inbox, confirmed, declined, mine, urgent };
  }, [activeEvents, currentUserEmail]);

  // Get filtered events based on current filter
  const filteredEvents = useMemo(() => {
    switch (currentFilter) {
      case 'inbox':
        return categorizedEvents.inbox;
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

  // Filter pills mit Counts (Option C: Eingang / Bestätigt / Abgelehnt / Archiv / Alle)
  const filterPills = [
    {
      id: 'inbox',
      label: `Eingang (${categorizedEvents.inbox.length})`,
      value: 'inbox',
      active: currentFilter === 'inbox',
    },
    // Meine + Dringend bleiben kontext-sensitiv als Zusatzfilter
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
    ...(categorizedEvents.confirmed.length > 0 || currentFilter === 'confirmed' ? [{
      id: 'confirmed',
      label: `Bestätigt (${categorizedEvents.confirmed.length})`,
      value: 'confirmed',
      active: currentFilter === 'confirmed',
    }] : []),
    ...(categorizedEvents.declined.length > 0 || currentFilter === 'declined' ? [{
      id: 'declined',
      label: `Abgelehnt (${categorizedEvents.declined.length})`,
      value: 'declined',
      active: currentFilter === 'declined',
    }] : []),
    ...(archivedEvents.length > 0 || currentFilter === 'archived' ? [{
      id: 'archived',
      label: `Archiv (${archivedEvents.length})`,
      value: 'archived',
      active: currentFilter === 'archived',
      icon: <Archive className="h-3 w-3 mr-1 text-muted-foreground" />
    }] : []),
    {
      id: 'all',
      label: `Alle (${activeEvents.length})`,
      value: 'all',
      active: currentFilter === 'all',
    },
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
    // Spalte 1: Status (bleibt wie bisher — mit allen Extras)
    {
      accessorKey: "status",
      header: sortableHeader<EventInquiry>("Status"),
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
          statusLabel = 'Angebot verschickt';
          statusIcon = <Send className="h-3 w-3 mr-1" />;
          badgeClass = 'border-emerald-500/50 text-emerald-700 bg-emerald-50';
          if (event.offer_sent_by) {
            subLabel = `von ${getAdminDisplayName(event.offer_sent_by)}`;
          }
        } else if (event.last_edited_at && !event.offer_sent_at) {
          statusLabel = 'In Bearbeitung';
          statusIcon = <Edit3 className="h-3 w-3 mr-1" />;
          badgeClass = 'border-amber-500/50 text-amber-700 bg-amber-50';
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

        const pmt = paymentStatus[event.id];
        const pmtBadge = pmt === 'overdue'
          ? <span title="Zahlung überfällig" className="text-red-500">💰⚠️</span>
          : pmt === 'complete'
          ? <span title="Vollständig bezahlt" className="text-green-600">💰✓</span>
          : pmt === 'partial'
          ? <span title="Teilweise bezahlt" className="text-amber-600">💰½</span>
          : pmt === 'pending'
          ? <span title="Zahlung ausstehend" className="text-amber-500">💰⏳</span>
          : null;

        return (
          <div className="flex flex-col gap-1 min-w-[160px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  getInquiryActionState(event).dotClass
                )}
                title={getInquiryActionState(event).label}
                aria-label={getInquiryActionState(event).label}
              />
              <Badge variant="outline" className={cn("font-medium flex items-center w-fit", badgeClass)}>
                {statusIcon}
                {statusLabel}
              </Badge>
              <PriorityIndicator priority={event.priority as InquiryPriority} />
              <AssigneeIndicator email={event.assigned_to} />
              {pmtBadge && <span className="text-xs leading-none">{pmtBadge}</span>}
            </div>
            {subLabel && (
              <span className="text-xs text-muted-foreground ml-0.5">{subLabel}</span>
            )}
          </div>
        );
      },
    },

    // Spalte 2: Anfrage (Eingangsdatum — Events haben keine order_number)
    {
      accessorKey: "created_at",
      header: sortableHeader<EventInquiry>("Anfrage"),
      sortingFn: "datetime",
      cell: ({ row }) => {
        const date = row.original.created_at;
        if (!date) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{format(parseISO(date), "dd.MM.yy", { locale: de })}</span>
          </div>
        );
      },
    },

    // Spalte: Art (In Haus / Catering / Reisegruppe)
    {
      id: "service_kind",
      header: "Art",
      accessorFn: (row) => SERVICE_LABELS[getServiceKind(row)].label,
      cell: ({ row }) => {
        const kind = getServiceKind(row.original);
        const m = SERVICE_LABELS[kind];
        const Icon = m.Icon;
        const chip =
          kind === "in_house"
            ? "bg-foreground text-background ring-1 ring-foreground"
            : "bg-foreground/10 text-foreground ring-1 ring-foreground/25";
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                chip,
              )}
            >
              <Icon className="h-3 w-3" />
              {m.label}
            </span>
            {kind === "group" && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-foreground text-background ring-1 ring-foreground">
                <Home className="h-3 w-3" />
                In Haus
              </span>
            )}
          </div>
        );
      },
      size: 160,
    },

    // Spalte 3: Eventdatum (VORGEZOGEN analog Orders-Liefertermin)
    {
      accessorKey: "preferred_date",
      header: sortableHeader<EventInquiry>("Eventdatum"),
      sortingFn: "datetime",
      cell: ({ row }) => {
        const date = row.original.preferred_date;
        if (!date) return <span className="text-muted-foreground">-</span>;

        const dateObj = parseISO(date);
        const time = row.original.time_slot;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const relativeLabel =
          diffDays === 0 ? 'Heute' :
          diffDays === 1 ? 'Morgen' :
          diffDays === -1 ? 'Gestern' :
          diffDays > 0 && diffDays <= 7 ? `in ${diffDays} Tagen` :
          diffDays > 7 && diffDays <= 30 ? `in ${diffDays} Tagen` :
          diffDays < 0 ? `vor ${Math.abs(diffDays)} Tagen` :
          null;

        return (
          <div className="flex items-start gap-1.5 min-w-[120px]">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">
                {format(dateObj, "EEE, dd.MM.yy", { locale: de })}
              </p>
              {time && (
                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  {time} Uhr
                </p>
              )}
              {relativeLabel && (
                <p className={cn(
                  "text-xs font-medium mt-0.5",
                  diffDays <= 2 && diffDays >= 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )}>
                  {relativeLabel}
                </p>
              )}
            </div>
          </div>
        );
      },
    },

    // Spalte 4: Event-Typ + Gäste
    {
      accessorKey: "event_type",
      header: sortableHeader<EventInquiry>("Event"),
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

    // Spalte 5: Kunde
    {
      id: "customer",
      accessorFn: (row) => (row.company_name || row.contact_name || "").toLowerCase(),
      header: sortableHeader<EventInquiry>("Kunde"),
      cell: ({ row }) => (
        <div className="max-w-[240px] min-w-[160px]">
          <p className="font-medium text-sm">{row.original.contact_name}</p>
          {row.original.company_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
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

    // Spalte 6: Kontakt (Mail + Telefon — analog Orders)
    {
      id: "contact",
      accessorFn: (row) => (row.email || row.phone || "").toLowerCase(),
      header: sortableHeader<EventInquiry>("Kontakt"),
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className="flex flex-col gap-1 min-w-[180px]">
            {event.email && (
              <a
                href={`mailto:${event.email}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-3 w-3" />
                <span className="truncate">{event.email}</span>
              </a>
            )}
            {event.phone && (
              <a
                href={`tel:${event.phone.replace(/\s/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-3 w-3" />
                <span>{event.phone}</span>
              </a>
            )}
          </div>
        );
      },
    },

    // Spalte 7: Bearbeitet (bleibt erhalten — wichtig bei Events mit langen Zyklen)
    {
      accessorKey: "last_edited_at",
      header: sortableHeader<EventInquiry>("Bearbeitet"),
      sortingFn: "datetime",
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
  ];

  const handleRowClick = (event: EventInquiry) => {
    navigate(`/admin/inquiries/${event.id}/edit`);
  };

  return (
    <AdminLayout activeTab="events" showCreateButton={selectedIds.length === 0}>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrintOpen(true)}
              className="rounded-lg gap-2"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Nächste Aufträge</span>
            </Button>
            {/* View Toggle */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as "table" | "kanban")}
              className="bg-muted/50 rounded-lg p-1"
            >
              <ToggleGroupItem value="table" aria-label="Tabellenansicht" className="h-8 px-2 sm:px-3 data-[state=on]:bg-white dark:data-[state=on]:bg-gray-800 data-[state=on]:shadow-sm rounded-md">
                <Table2 className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Tabelle</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Kanban-Ansicht" className="h-8 px-2 sm:px-3 data-[state=on]:bg-white dark:data-[state=on]:bg-gray-800 data-[state=on]:shadow-sm rounded-md">
                <LayoutGrid className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Kanban</span>
              </ToggleGroupItem>
            </ToggleGroup>

            <Button asChild className="shadow-sm hidden sm:flex">
              <Link to="/admin/inquiries/create">
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
              defaultSorting={[{ id: "created_at", desc: true }]}
              mobileCardRender={(event) => {
                const dateStr = event.preferred_date
                  ? format(parseISO(event.preferred_date), "EEE dd.MM.yy", { locale: de })
                  : "—";
                let statusLabel = "Neu";
                let statusClass = "border-amber-500/50 text-amber-700 bg-amber-50";
                if (event.offer_phase === 'customer_responded') {
                  statusLabel = 'Kunde antwortete';
                  statusClass = 'border-teal-500/50 text-teal-700 bg-teal-50';
                } else if (event.archived_at) {
                  statusLabel = 'Archiviert';
                  statusClass = 'border-slate-400/50 text-slate-600 bg-slate-100';
                } else if (event.offer_sent_at && event.status !== 'confirmed' && event.status !== 'declined') {
                  statusLabel = 'Angebot gesendet';
                  statusClass = 'border-emerald-500/50 text-emerald-700 bg-emerald-50';
                } else if (event.status === 'confirmed') {
                  statusLabel = 'Bestätigt';
                  statusClass = 'border-foreground/50 text-foreground bg-muted';
                } else if (event.status === 'declined') {
                  statusLabel = 'Abgelehnt';
                  statusClass = 'border-muted-foreground/50 text-muted-foreground bg-muted';
                } else if (event.last_edited_at) {
                  statusLabel = 'In Bearbeitung';
                  statusClass = 'border-amber-500/50 text-amber-700 bg-amber-50';
                }
                return (
                  <MobileCardItem
                    onClick={() => handleRowClick(event)}
                    title={event.contact_name || "—"}
                    subtitle={event.company_name || event.email || ""}
                    meta={
                      <span className="flex items-center gap-2 flex-wrap">
                        <Calendar className="h-3 w-3" />
                        {dateStr}
                        {event.guest_count && (
                          <>
                            <span>·</span>
                            <Users className="h-3 w-3" />
                            {event.guest_count}
                          </>
                        )}
                        {event.event_type && (
                          <>
                            <span>·</span>
                            <span>{eventTypeLabels[event.event_type] || event.event_type}</span>
                          </>
                        )}
                      </span>
                    }
                    trailing={
                      <Badge variant="outline" className={cn("text-[10px]", statusClass)}>
                        {statusLabel}
                      </Badge>
                    }
                  />
                );
              }}
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
            events={activeEvents}
            onRefresh={() => eventsQuery.query.refetch()}
          />
        )}
      </div>
      <UpcomingOrdersPrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        records={activeEvents.map((e) => eventToInquiryRecord(e))}
      />
    </AdminLayout>
  );
};
