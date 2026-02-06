import React from "react";
import { useList, useUpdate } from "@refinedev/core";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarDays,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChefHat,
  Plus,
  Send,
  Edit3,
  CreditCard,
  Receipt,
  TrendingUp,
  Users,
  Euro,
  ArrowRight,
} from "lucide-react";
import { format, parseISO, isAfter, addDays, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventInquiry, CateringOrder } from "@/types/refine";
import { useEventBookings, usePaidEventBookings } from "@/hooks/useEventBookings";
import { KanbanView } from "./KanbanView";
import { cn } from "@/lib/utils";

export const Dashboard = () => {
  // Fetch ALL events to categorize them (excluding archived)
  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 100 },
    filters: [
      { field: "status", operator: "in", value: ["new", "contacted", "offer_sent", "confirmed"] },
      { field: "archived_at", operator: "null", value: true },
    ],
    sorters: [{ field: "created_at", order: "desc" }],
  });

  // Fetch recent orders
  const ordersQuery = useList<CateringOrder>({
    resource: "orders",
    pagination: { pageSize: 5 },
    filters: [{ field: "status", operator: "in", value: ["pending", "confirmed"] }],
    sorters: [{ field: "desired_date", order: "asc" }],
  });

  // Fetch bookings with pending menu
  const { data: bookings } = useEventBookings('menu_pending');

  // Fetch paid event bookings
  const { data: paidBookings } = usePaidEventBookings();

  const events = eventsQuery.result?.data || [];
  const orders = ordersQuery.result?.data || [];
  const pendingMenuBookings = bookings || [];
  const paidEventBookings = paidBookings || [];

  // Stats calculation
  const newInquiries = events.filter(e => e.status === 'new' && !e.last_edited_at);
  const inProgressInquiries = events.filter(e =>
    (e.last_edited_at || e.status === 'contacted') &&
    e.status !== 'offer_sent' &&
    e.status !== 'confirmed' &&
    e.status !== 'declined'
  );
  const offerSentInquiries = events.filter(e => e.status === 'offer_sent');
  const confirmedEvents = events.filter(e => e.status === 'confirmed');

  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const upcomingOrdersCount = orders.filter(o =>
    o.desired_date && isAfter(parseISO(o.desired_date), new Date()) &&
    isAfter(addDays(new Date(), 7), parseISO(o.desired_date))
  ).length;

  // Calculate total revenue from paid bookings
  const totalRevenue = paidEventBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const handleRefresh = () => {
    eventsQuery.refetch();
  };

  return (
    <AdminLayout activeTab="dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Übersicht</h1>
            <p className="text-muted-foreground">
              Willkommen zurück im StoriaMaestro
            </p>
          </div>
          <Button asChild className="shadow-sm">
            <Link to="/admin/events/create">
              <Plus className="h-4 w-4 mr-2" />
              Neue Anfrage
            </Link>
          </Button>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Neue Anfragen"
            value={newInquiries.length}
            icon={AlertCircle}
            color="amber"
            href="/admin/events?filter=new"
          />
          <StatCard
            title="In Bearbeitung"
            value={inProgressInquiries.length}
            icon={Edit3}
            color="blue"
            href="/admin/events?filter=in_progress"
          />
          <StatCard
            title="Angebote versendet"
            value={offerSentInquiries.length}
            icon={Send}
            color="emerald"
            href="/admin/events?filter=offer_sent"
          />
          <StatCard
            title="Bestätigt"
            value={confirmedEvents.length}
            icon={CheckCircle2}
            color="green"
            href="/admin/events?filter=confirmed"
          />
        </div>

        {/* Kanban Pipeline - Main Feature */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Event-Pipeline</CardTitle>
                <CardDescription>Alle aktiven Anfragen im Überblick</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/events">
                  Alle anzeigen
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <KanbanView events={events} onRefresh={handleRefresh} />
          </CardContent>
        </Card>

        {/* Bottom Row: Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Paid Bookings */}
          {paidEventBookings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base">Bezahlte Buchungen</CardTitle>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {paidEventBookings.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {paidEventBookings.slice(0, 4).map((booking) => (
                  <Link
                    key={booking.id}
                    to={`/admin/bookings/${booking.id}/edit`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm">{booking.booking_number}</p>
                        <Badge variant="default" className="bg-emerald-600 text-xs">
                          Bezahlt
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mt-1">
                        {booking.company_name || booking.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.guest_count} Gäste • {booking.event_date && format(parseISO(booking.event_date), "dd.MM.yy", { locale: de })}
                      </p>
                    </div>
                    <p className="font-semibold text-emerald-600">
                      {booking.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </p>
                  </Link>
                ))}
                {paidEventBookings.length > 4 && (
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link to="/admin/bookings?filter=paid">
                      +{paidEventBookings.length - 4} weitere anzeigen
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Catering Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <CardTitle className="text-base">Catering-Bestellungen</CardTitle>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/orders">Alle</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">
                  Keine anstehenden Bestellungen
                </p>
              ) : (
                <div className="space-y-2">
                  {orders.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-mono text-sm">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.customer_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {order.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </p>
                        {order.desired_date && (
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(order.desired_date), "EEE, dd.MM.", { locale: de })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Menu Pending - Only show if there are items */}
          {pendingMenuBookings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-amber-600" />
                    <CardTitle className="text-base">Menü ausstehend</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-200">
                    {pendingMenuBookings.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingMenuBookings.slice(0, 3).map((booking) => (
                  <Link
                    key={booking.id}
                    to={`/admin/bookings/${booking.id}/edit`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">
                        {booking.company_name || booking.customer_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.guest_count} Gäste
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-amber-600">Menü offen</Badge>
                      {booking.event_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(booking.event_date), "dd.MM.yy", { locale: de })}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'amber' | 'blue' | 'emerald' | 'green';
  href: string;
}) {
  const colorClasses = {
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    green: 'bg-green-50 text-green-600 border-green-200',
  };

  return (
    <Link to={href}>
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "p-4 rounded-xl border transition-shadow hover:shadow-md cursor-pointer",
          colorClasses[color]
        )}
      >
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5" />
          <span className="text-2xl font-bold tabular-nums">{value}</span>
        </div>
        <p className="text-sm mt-2 font-medium">{title}</p>
      </motion.div>
    </Link>
  );
}
