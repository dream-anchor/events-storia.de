import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { LayoutGrid, Table2, Calendar } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { DataTable, sortableHeader } from "./DataTable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MobileCardItem } from "@/components/admin/shared/responsive/MobileCardList";
import { useUnifiedInquiries } from "@/hooks/useUnifiedInquiries";
import { getLifecycleBucket } from "@/types/inquiryRecord";
import type {
  InquiryRecord,
  LifecycleBucket,
  ServiceType,
} from "@/types/inquiryRecord";
import { UnifiedKanbanView, ServiceBadge } from "./UnifiedKanbanView";
import { GroupInquiryDetail, type GroupInquiry } from "./GroupInquiriesList";
import { useList } from "@refinedev/core";
import { getRecordActionState } from "@/lib/inquiryActionState";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "kanban";
type StatusFilter = LifecycleBucket;
type KindFilter = "all" | ServiceType;

const STATUS_LABELS: Record<StatusFilter, string> = {
  inbox: "Eingang",
  won: "Gebucht",
  done: "Erledigt",
  archive: "Archiv",
};

function statusMatches(r: InquiryRecord, f: StatusFilter): boolean {
  return getLifecycleBucket(r) === f;
}

function sortByBucket(list: InquiryRecord[], bucket: StatusFilter): InquiryRecord[] {
  const ts = (s?: string | null) => (s ? new Date(s).getTime() : 0);
  const dateAsc = (a: InquiryRecord, b: InquiryRecord) =>
    (ts(a.date) || Infinity) - (ts(b.date) || Infinity);
  const dateDesc = (a: InquiryRecord, b: InquiryRecord) => ts(b.date) - ts(a.date);
  const createdDesc = (a: InquiryRecord, b: InquiryRecord) =>
    ts(b.createdAt) - ts(a.createdAt);
  const updatedDesc = (a: InquiryRecord, b: InquiryRecord) =>
    ts(b.updatedAt) - ts(a.updatedAt);
  const sorted = [...list];
  switch (bucket) {
    case "inbox":
      sorted.sort(createdDesc);
      break;
    case "won":
      sorted.sort(dateAsc);
      break;
    case "done":
      sorted.sort(dateDesc);
      break;
    case "archive":
      sorted.sort(updatedDesc);
      break;
  }
  return sorted;
}

function formatCurrency(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export const UnifiedInquiriesList = () => {
  const navigate = useNavigate();
  const { records, isLoading, refetch } = useUnifiedInquiries();
  const { result: groupResult, query: groupQuery } = useList<GroupInquiry>({
    resource: "group_inquiries",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 200 },
  });
  const groupItems = (groupResult?.data ?? []) as GroupInquiry[];
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selectedGroup = useMemo(
    () => groupItems.find((g) => g.id === selectedGroupId) ?? null,
    [groupItems, selectedGroupId],
  );

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("inbox");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const filtered = useMemo(() => {
    const list = records.filter((r) => {
      if (kindFilter !== "all" && r.serviceType !== kindFilter) return false;
      return statusMatches(r, statusFilter);
    });
    return sortByBucket(list, statusFilter);
  }, [records, statusFilter, kindFilter]);

  const kanbanRecords = useMemo(() => {
    return records.filter((r) => {
      if (kindFilter !== "all" && r.serviceType !== kindFilter) return false;
      return statusMatches(r, statusFilter);
    });
  }, [records, kindFilter, statusFilter]);

  const counts = useMemo(() => {
    const filterByKind = (r: InquiryRecord) =>
      kindFilter === "all" || r.serviceType === kindFilter;
    return {
      inbox: records.filter((r) => filterByKind(r) && statusMatches(r, "inbox")).length,
      won: records.filter((r) => filterByKind(r) && statusMatches(r, "won")).length,
      done: records.filter((r) => filterByKind(r) && statusMatches(r, "done")).length,
      archive: records.filter((r) => filterByKind(r) && statusMatches(r, "archive")).length,
    };
  }, [records, kindFilter]);

  const kindCounts = useMemo(() => {
    return {
      all: records.length,
      restaurant: records.filter((r) => r.serviceType === "restaurant").length,
      catering: records.filter((r) => r.serviceType === "catering").length,
      catering_order: records.filter((r) => r.serviceType === "catering_order").length,
      group: records.filter((r) => r.serviceType === "group").length,
    };
  }, [records]);

  const filterPills = (
    ["inbox", "won", "done", "archive"] as StatusFilter[]
  ).map((id) => ({
    id,
    label: STATUS_LABELS[id],
    value: id,
    active: statusFilter === id,
    count: counts[id],
  }));

  const handleFilterChange = (_id: string, value: string) => {
    setStatusFilter((value as StatusFilter) || "inbox");
  };

  const handleRowClick = (r: InquiryRecord) => {
    if (r.serviceType === "group") {
      setSelectedGroupId(r.id);
      return;
    }
    navigate(
      r.kind === "event"
        ? `/admin/events/${r.id}/edit`
        : `/admin/orders/${r.id}/edit`,
    );
  };

  const columns: ColumnDef<InquiryRecord>[] = [
    {
      id: "action",
      header: "Status",
      accessorFn: (r) => getRecordActionState(r).label,
      cell: ({ row }) => {
        const a = getRecordActionState(row.original);
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
              a.chipClass,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", a.dotClass)} />
            {a.label}
          </span>
        );
      },
      size: 130,
    },
    {
      id: "serviceType",
      header: sortableHeader<InquiryRecord>("Art"),
      accessorFn: (r) => r.serviceType,
      cell: ({ row }) => <ServiceBadge serviceType={row.original.serviceType} />,
      size: 110,
    },
    {
      accessorKey: "number",
      header: sortableHeader<InquiryRecord>("Nr."),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.number}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: sortableHeader<InquiryRecord>("Datum"),
      cell: ({ row }) => {
        const d = row.original.date;
        if (!d) return <span className="text-muted-foreground/40">—</span>;
        return (
          <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {format(parseISO(d), "EEE dd.MM.yy", { locale: de })}
            {row.original.time ? (
              <span className="text-muted-foreground">· {row.original.time}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "customer",
      header: sortableHeader<InquiryRecord>("Kunde"),
      accessorFn: (r) => r.companyName || r.customerName,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-sm truncate">
              {r.companyName || r.customerName}
            </span>
            {r.companyName && (
              <span className="text-xs text-muted-foreground truncate">
                {r.customerName}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "contact",
      header: "Kontakt",
      cell: ({ row }) => (
        <div className="flex flex-col text-xs text-muted-foreground min-w-0">
          <span className="truncate">{row.original.email}</span>
          {row.original.phone && <span className="truncate">{row.original.phone}</span>}
        </div>
      ),
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        const r = row.original;
        if (r.kind === "event") {
          return (
            <span className="text-xs text-muted-foreground">
              {r.guestCount ? `${r.guestCount} Gäste` : "—"}
            </span>
          );
        }
        return (
          <span className="text-xs text-muted-foreground">
            {r.itemsCount ? `${r.itemsCount} Artikel` : "—"}
            {r.isPickup ? " · Abholung" : " · Lieferung"}
          </span>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: sortableHeader<InquiryRecord>("Summe"),
      sortingFn: "basic",
      cell: ({ row }) => (
        <span className="font-semibold text-sm whitespace-nowrap tabular-nums">
          {formatCurrency(row.original.totalAmount)}
        </span>
      ),
    },
  ];

  return (
    <AdminLayout activeTab="inquiries" title="Anfragen">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Anfragen</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {viewMode === "kanban"
                ? `${kanbanRecords.length} im Kanban-Board`
                : `${filtered.length} im Filter „${STATUS_LABELS[statusFilter]}“`}
              {kindFilter !== "all"
                ? ` · ${
                    kindFilter === "restaurant"
                      ? "Im Haus"
                      : kindFilter === "catering"
                        ? "Außer Haus"
                        : "Catering-Shop"
                  }`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Kind filter */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/60">
              {(
                ["all", "restaurant", "catering", "catering_order", "group"] as KindFilter[]
              ).map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                    kindFilter === k
                      ? "bg-white text-foreground shadow-sm ring-1 ring-foreground/10"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k === "all"
                    ? "Alle"
                    : k === "restaurant"
                      ? "Im Haus"
                      : k === "catering"
                        ? "Außer Haus"
                        : k === "catering_order"
                          ? "Shop"
                          : "Reisegruppen"}
                  <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                    {kindCounts[k]}
                  </span>
                </button>
              ))}
            </div>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              className="rounded-2xl bg-muted/60 p-1"
            >
              <ToggleGroupItem value="table" aria-label="Tabelle" className="rounded-xl px-3">
                <Table2 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Kanban" className="rounded-xl px-3">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {viewMode === "kanban" ? (
          <>
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/60 w-fit">
              {filterPills.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setStatusFilter(p.value as StatusFilter)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                    p.active
                      ? "bg-white text-foreground shadow-sm ring-1 ring-foreground/10"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                  <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                    {p.count}
                  </span>
                </button>
              ))}
            </div>
            <UnifiedKanbanView
              records={kanbanRecords}
              onRefresh={refetch}
              bucket={statusFilter}
              onOpenGroup={(id) => setSelectedGroupId(id)}
            />
          </>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            searchPlaceholder="Suche nach Kunde, Nr., E-Mail..."
            filterPills={filterPills as any}
            onFilterChange={handleFilterChange}
            onRefresh={refetch}
            onRowClick={handleRowClick}
            isLoading={isLoading}
            pageSize={25}
            getRowId={(r) => `${r.kind}-${r.id}`}
            defaultSorting={[{ id: "date", desc: false }]}
            mobileCardRender={(r) => (
              <MobileCardItem
                onClick={() => handleRowClick(r)}
                title={
                  <span className="flex items-center gap-2">
                    <ServiceBadge serviceType={r.serviceType} compact />
                    <span className="truncate">{r.companyName || r.customerName}</span>
                  </span>
                }
                subtitle={
                  r.companyName ? <span>{r.customerName}</span> : <span>{r.email}</span>
                }
                meta={
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {r.date
                      ? format(parseISO(r.date), "EEE dd.MM.yy", { locale: de })
                      : "—"}
                    {r.time ? <span>· {r.time}</span> : null}
                  </span>
                }
                trailing={
                  <span className="font-semibold text-sm whitespace-nowrap tabular-nums">
                    {formatCurrency(r.totalAmount)}
                  </span>
                }
              />
            )}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default UnifiedInquiriesList;
