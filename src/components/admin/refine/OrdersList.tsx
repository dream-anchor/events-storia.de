import { useList } from "@refinedev/core";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Users, Package, CreditCard, Truck, MapPin, Receipt, Download } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CateringOrder, OrderStatus } from "@/types/refine";
import { cn } from "@/lib/utils";
import { useState } from "react";

const statusConfig: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Neu", variant: "default" },
  confirmed: { label: "Bestätigt", variant: "secondary" },
  completed: { label: "Erledigt", variant: "outline" },
  cancelled: { label: "Storniert", variant: "destructive" },
};

export const OrdersList = () => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null);

  const ordersQuery = useList<CateringOrder>({
    resource: "orders",
    pagination: { pageSize: 50 },
    filters: statusFilter ? [{ field: "status", operator: "eq", value: statusFilter }] : [],
    sorters: [{ field: "desired_date", order: "asc" }],
  });

  const orders = ordersQuery.result?.data || [];
  const isLoading = ordersQuery.query.isLoading;

  const filterPills = [
    { id: 'all', label: 'Alle', value: '', active: !statusFilter },
    { id: 'pending', label: 'Neu', value: 'pending', active: statusFilter === 'pending' },
    { id: 'confirmed', label: 'Bestätigt', value: 'confirmed', active: statusFilter === 'confirmed' },
    { id: 'completed', label: 'Erledigt', value: 'completed', active: statusFilter === 'completed' },
    { id: 'cancelled', label: 'Storniert', value: 'cancelled', active: statusFilter === 'cancelled' },
  ];

  const handleFilterChange = (filterId: string, value: string) => {
    if (filterId === 'all' || !value) {
      setStatusFilter(null);
    } else {
      setStatusFilter(value as OrderStatus);
    }
  };

  const columns: ColumnDef<CateringOrder>[] = [
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const config = statusConfig[status] || statusConfig.pending;
        const isPaid = row.original.payment_method === 'stripe' && row.original.payment_status === 'paid';
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={config.variant}>{config.label}</Badge>
            {isPaid && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CreditCard className="h-3 w-3 mr-1" />
                Bezahlt
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "order_number",
      header: "Bestellung",
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-medium">{row.original.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.created_at && format(parseISO(row.original.created_at), "dd.MM.yy HH:mm", { locale: de })}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "desired_date",
      header: "Liefertermin",
      cell: ({ row }) => {
        const date = row.original.desired_date;
        const time = row.original.desired_time;
        if (!date) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p>{format(parseISO(date), "EEE, dd.MM.yy", { locale: de })}</p>
              {time && <p className="text-xs text-muted-foreground">{time} Uhr</p>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "customer_name",
      header: "Kunde",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.customer_name}</p>
          {row.original.company_name && (
            <p className="text-sm text-muted-foreground">{row.original.company_name}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "delivery",
      header: "Lieferung",
      cell: ({ row }) => {
        if (row.original.is_pickup) {
          return (
            <Badge variant="outline">
              <Package className="h-3 w-3 mr-1" />
              Abholung
            </Badge>
          );
        }
        return (
          <div className="text-sm">
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3 text-muted-foreground" />
              Lieferung
            </div>
            {row.original.delivery_city && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {row.original.delivery_zip} {row.original.delivery_city}
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "total_amount",
      header: "Summe",
      cell: ({ row }) => (
        <p className="font-semibold">
          {row.original.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        </p>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.lexoffice_invoice_id && (
            <Button size="icon" variant="ghost">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout activeTab="orders">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Catering</h1>
          <p className="text-muted-foreground">
            Übersicht aller eingegangenen Bestellungen.
          </p>
        </div>

        <DataTable
          columns={columns}
          data={orders}
          searchPlaceholder="Suche nach Bestellnummer, Kunde..."
          filterPills={filterPills}
          onFilterChange={handleFilterChange}
          onRefresh={() => ordersQuery.query.refetch()}
          isLoading={isLoading}
          pageSize={15}
        />
      </div>
    </AdminLayout>
  );
};
