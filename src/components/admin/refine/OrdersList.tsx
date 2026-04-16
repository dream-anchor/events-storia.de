import { useList } from "@refinedev/core";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Package, CreditCard, Truck, MapPin, Phone, Mail, MessageCircle, CheckCircle2, AlertCircle, HandCoins } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Badge } from "@/components/ui/badge";
import { CateringOrder, OrderStatus } from "@/types/refine";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

/**
 * Filter-Konzept (Senior CX Review 16.04.2026):
 * - "Eingang": alles Aktive (pending + confirmed) — ersetzt die alten "Neu" / "Bestätigt"
 * - "Erledigt": completed (wird 1h nach Liefer-/Abholzeit automatisch gesetzt via pg_cron)
 * - "Storniert": cancelled
 * - "Alle": keine Filterung
 *
 * Payment-Labels pro Zeile:
 * - "Bezahlt" (grün): payment_status === 'paid'
 * - "Bezahlung bei Abholung" (amber): payment_method === 'cash' UND is_pickup === true
 * - "Unbezahlt" (rot): alles andere was nicht paid ist
 *
 * Antwort-Indikator (rechts):
 * - 🔴 "Antwort wartet": last_customer_message_at > last_our_reply_at
 * - 🟡 "Warten auf Kunden": last_our_reply_at > last_customer_message_at UND wir haben geschrieben
 * - nichts: kein aktiver Dialog
 */

type InboxFilter = 'inbox' | 'done' | 'cancelled' | 'all';

const filterToStatus: Record<InboxFilter, OrderStatus[] | null> = {
  inbox: ['pending', 'confirmed'],
  done: ['completed'],
  cancelled: ['cancelled'],
  all: null,
};

export const OrdersList = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<InboxFilter>('inbox');

  const statusValues = filterToStatus[activeFilter];

  const ordersQuery = useList<CateringOrder>({
    resource: "orders",
    pagination: { pageSize: 100 },
    filters: statusValues
      ? [{ field: "status", operator: "in", value: statusValues }]
      : [],
    // Sortierung: nächster Liefertermin oben, dann nach Erstellungszeit
    sorters: [
      { field: "desired_date", order: "asc" },
      { field: "desired_time", order: "asc" },
    ],
  });

  const orders = ordersQuery.result?.data || [];
  const isLoading = ordersQuery.query.isLoading;

  // Zählwerte für Filter-Badges (unabhängig vom aktuellen Filter)
  const counts = useMemo(() => {
    // Wir müssen die volle Liste kennen für korrekte Counts.
    // Trick: Wenn bereits "all" aktiv ist, nehmen wir die. Sonst: nur Schätzung via aktueller Liste.
    // Saubere Lösung wäre eine separate Query — für jetzt: Badge nur auf aktiven Filter.
    return {
      inbox: activeFilter === 'inbox' ? orders.length : null,
      done: activeFilter === 'done' ? orders.length : null,
      cancelled: activeFilter === 'cancelled' ? orders.length : null,
      all: activeFilter === 'all' ? orders.length : null,
    };
  }, [orders.length, activeFilter]);

  const filterPills = [
    { id: 'inbox', label: 'Eingang', value: 'inbox', active: activeFilter === 'inbox', count: counts.inbox },
    { id: 'done', label: 'Erledigt', value: 'done', active: activeFilter === 'done', count: counts.done },
    { id: 'cancelled', label: 'Storniert', value: 'cancelled', active: activeFilter === 'cancelled', count: counts.cancelled },
    { id: 'all', label: 'Alle', value: 'all', active: activeFilter === 'all', count: counts.all },
  ];

  const handleFilterChange = (_id: string, value: string) => {
    setActiveFilter((value as InboxFilter) || 'inbox');
  };

  const columns: ColumnDef<CateringOrder>[] = [
    // Spalte 1: Status + Payment-Label (vertikal gestapelt)
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const o = row.original;
        const isPaid = o.payment_status === 'paid';
        const isCashOnPickup = o.payment_method === 'cash' && o.is_pickup;

        return (
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            {/* Payment-Label als Haupt-Info */}
            {isPaid ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                <CreditCard className="h-3 w-3 mr-1" />
                Bezahlt
              </Badge>
            ) : isCashOnPickup ? (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                <HandCoins className="h-3 w-3 mr-1" />
                Bezahlung bei Abholung
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unbezahlt
              </Badge>
            )}
            {/* Sekundär-Status nur wenn nicht "pending" */}
            {o.status === 'completed' && (
              <Badge variant="secondary" className="w-fit text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Erledigt
              </Badge>
            )}
            {o.status === 'cancelled' && (
              <Badge variant="destructive" className="w-fit text-xs">Storniert</Badge>
            )}
            {o.status === 'confirmed' && (
              <Badge variant="secondary" className="w-fit text-xs">Bestätigt</Badge>
            )}
          </div>
        );
      },
    },

    // Spalte 2: Bestellnummer + Eingangsdatum
    {
      accessorKey: "order_number",
      header: "Bestellung",
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-medium text-sm">{row.original.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.created_at && format(parseISO(row.original.created_at), "dd.MM.yy HH:mm", { locale: de })}
          </p>
        </div>
      ),
    },

    // Spalte 3: Lieferung/Abholung + Adresse (oder Abholung-Label)
    {
      id: "delivery_address",
      header: "Lieferung / Abholung",
      cell: ({ row }) => {
        const o = row.original;
        if (o.is_pickup) {
          return (
            <div className="flex flex-col gap-1 min-w-[180px]">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Abholung
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Karlstr. 43, München
              </p>
            </div>
          );
        }
        const hasAddress = o.delivery_street || o.delivery_zip || o.delivery_city;
        return (
          <div className="flex flex-col gap-1 min-w-[180px]">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              Lieferung
            </div>
            {hasAddress ? (
              <p className="text-xs text-muted-foreground pl-5 flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  {o.delivery_street && <>{o.delivery_street}<br /></>}
                  {o.delivery_zip} {o.delivery_city}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/60 pl-5 italic">keine Adresse</p>
            )}
          </div>
        );
      },
    },

    // Spalte 4: Kunde
    {
      accessorKey: "customer_name",
      header: "Kunde",
      cell: ({ row }) => (
        <div className="min-w-[140px]">
          <p className="font-medium text-sm">{row.original.customer_name}</p>
          {row.original.company_name && (
            <p className="text-xs text-muted-foreground">{row.original.company_name}</p>
          )}
        </div>
      ),
    },

    // Spalte 5: Kontakt (Mail + Telefon)
    {
      id: "contact",
      header: "Kontakt",
      cell: ({ row }) => {
        const o = row.original;
        return (
          <div className="flex flex-col gap-1 min-w-[180px]">
            {o.customer_email && (
              <a
                href={`mailto:${o.customer_email}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-3 w-3" />
                <span className="truncate">{o.customer_email}</span>
              </a>
            )}
            {o.customer_phone && (
              <a
                href={`tel:${o.customer_phone.replace(/\s/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-3 w-3" />
                <span>{o.customer_phone}</span>
              </a>
            )}
          </div>
        );
      },
    },

    // Spalte 6: Liefertermin
    {
      accessorKey: "desired_date",
      header: "Termin",
      cell: ({ row }) => {
        const date = row.original.desired_date;
        const time = row.original.desired_time;
        if (!date) return <span className="text-muted-foreground">-</span>;

        const dateObj = parseISO(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const relativeLabel =
          diffDays === 0 ? 'Heute' :
          diffDays === 1 ? 'Morgen' :
          diffDays === -1 ? 'Gestern' :
          diffDays > 0 && diffDays <= 7 ? `in ${diffDays} Tagen` :
          null;

        return (
          <div className="flex items-start gap-1.5 min-w-[120px]">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">
                {format(dateObj, "EEE, dd.MM.yy", { locale: de })}
              </p>
              {time && <p className="text-xs text-muted-foreground">{time} Uhr</p>}
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

    // Spalte 7: Summe
    {
      accessorKey: "total_amount",
      header: "Summe",
      cell: ({ row }) => (
        <p className="font-semibold text-sm whitespace-nowrap">
          {row.original.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        </p>
      ),
    },

    // Spalte 8: Antwort-Status
    {
      id: "conversation",
      header: "Kommunikation",
      cell: ({ row }) => {
        const o = row.original;
        const lastCustomer = o.last_customer_message_at ? new Date(o.last_customer_message_at).getTime() : 0;
        const lastOurs = o.last_our_reply_at ? new Date(o.last_our_reply_at).getTime() : 0;

        if (lastCustomer > lastOurs) {
          return (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300">
              <MessageCircle className="h-3 w-3 mr-1" />
              Antwort wartet
            </Badge>
          );
        }
        if (lastOurs > 0) {
          return (
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Beantwortet
            </Badge>
          );
        }
        return <span className="text-xs text-muted-foreground/40">—</span>;
      },
    },
  ];

  const handleRowClick = (order: CateringOrder) => {
    navigate(`/admin/orders/${order.id}/edit`);
  };

  return (
    <AdminLayout activeTab="orders">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catering-Bestellungen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.length} {orders.length === 1 ? 'Bestellung' : 'Bestellungen'} im Filter „{filterPills.find(f => f.active)?.label}"
          </p>
        </div>

        <DataTable
          columns={columns}
          data={orders}
          searchPlaceholder="Suche nach Bestellnummer, Kunde, Adresse..."
          filterPills={filterPills}
          onFilterChange={handleFilterChange}
          onRefresh={() => ordersQuery.query.refetch()}
          onRowClick={handleRowClick}
          isLoading={isLoading}
          pageSize={25}
        />
      </div>
    </AdminLayout>
  );
};
