import { useState, useEffect, useMemo } from "react";
import { useList } from "@refinedev/core";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Users, Building2, LayoutGrid, Table2, Plus, Send, Edit3, Archive } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { KanbanView } from "./KanbanView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EventInquiry } from "@/types/refine";
import { cn } from "@/lib/utils";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";

const columns: ColumnDef<EventInquiry>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const e = row.original;
      let label = "Neu";
      let cls = "border-amber-500/50 text-amber-700 bg-amber-50";

      if (e.offer_phase === "customer_responded") {
        label = "Kunde antwortete";
        cls = "border-teal-500/50 text-teal-700 bg-teal-50 ring-1 ring-teal-300";
      } else if (e.offer_sent_at && e.status !== "confirmed" && e.status !== "declined") {
        label = "Angebot gesendet";
        cls = "border-emerald-500/50 text-emerald-700 bg-emerald-50";
      } else if (e.last_edited_at && !e.offer_sent_at) {
        label = "In Bearbeitung";
        cls = "border-amber-500/50 text-amber-700 bg-amber-50";
      } else if (e.status === "confirmed") {
        label = "Bestätigt";
        cls = "border-foreground/50 text-foreground bg-muted";
      } else if (e.status === "declined") {
        label = "Abgelehnt";
        cls = "border-muted-foreground/50 text-muted-foreground bg-muted";
      }

      return <Badge variant="outline" className={cn("font-medium w-fit", cls)}>{label}</Badge>;
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
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {row.original.event_type || "-"}
        </Badge>
        {row.original.guest_count && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            {row.original.guest_count}
          </span>
        )}
      </div>
    ),
  },
];

export const Dashboard = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"table" | "kanban">(
    () => (localStorage.getItem("dashboardViewMode") as "table" | "kanban") || "kanban"
  );

  useEffect(() => {
    localStorage.setItem("dashboardViewMode", viewMode);
  }, [viewMode]);

  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 100 },
    filters: [
      { field: "status", operator: "in", value: ["new", "contacted", "offer_sent", "confirmed", "declined", "cancelled"] },
      { field: "archived_at", operator: "null", value: true },
    ],
    sorters: [{ field: "created_at", order: "desc" }],
  });

  const events = eventsQuery.result?.data || [];

  return (
    <AdminLayout activeTab="dashboard" title="Dashboard" showCreateButton={true} createButtonText="Neue Anfrage">
      <div className="space-y-6">
        {/* Header mit Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {events.length} aktive Anfragen
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as "table" | "kanban")}
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
        </div>

        {viewMode === "kanban" ? (
          <KanbanView events={events} onRefresh={() => eventsQuery.query.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            data={events}
            searchPlaceholder="Suche nach Name, Firma..."
            onRefresh={() => eventsQuery.query.refetch()}
            onRowClick={(e) => navigate(`/admin/events/${e.id}/edit`)}
            isLoading={eventsQuery.query.isLoading}
            pageSize={15}
          />
        )}
      </div>
    </AdminLayout>
  );
};
