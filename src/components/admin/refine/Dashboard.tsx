import { useList } from "@refinedev/core";
import { Link } from "react-router-dom";
import { CalendarDays, FileText, UtensilsCrossed, TrendingUp, Clock, CheckCircle2, AlertCircle, ChefHat } from "lucide-react";
import { format, parseISO, isAfter, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventInquiry, CateringOrder } from "@/types/refine";
import { useEventBookings } from "@/hooks/useEventBookings";

export const Dashboard = () => {
  // Fetch recent events
  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 5 },
    filters: [{ field: "status", operator: "in", value: ["new", "contacted", "offer_sent"] }],
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

  const events = eventsQuery.result?.data || [];
  const orders = ordersQuery.result?.data || [];
  const pendingMenuBookings = bookings || [];

  // Stats
  const newEventsCount = events.filter(e => e.status === 'new').length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const pendingMenuCount = pendingMenuBookings.length;
  const upcomingOrdersCount = orders.filter(o => 
    o.desired_date && isAfter(parseISO(o.desired_date), new Date()) && 
    isAfter(addDays(new Date(), 7), parseISO(o.desired_date))
  ).length;

  return (
    <AdminLayout activeTab="dashboard">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-semibold">Event OS</h1>
          <p className="text-muted-foreground">
            Willkommen im Catering-Management-System
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Neue Anfragen
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{newEventsCount}</div>
              <p className="text-xs text-muted-foreground">
                Warten auf Bearbeitung
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Menü offen
              </CardTitle>
              <ChefHat className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingMenuCount}</div>
              <p className="text-xs text-muted-foreground">
                Buchungen ohne Menü
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Offene Bestellungen
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingOrdersCount}</div>
              <p className="text-xs text-muted-foreground">
                Noch nicht bestätigt
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Diese Woche
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{upcomingOrdersCount}</div>
              <p className="text-xs text-muted-foreground">
                Anstehende Lieferungen
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Events */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Neue Event-Anfragen
                  </CardTitle>
                  <CardDescription>Letzte offene Anfragen</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/events">Alle anzeigen</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Keine offenen Anfragen
                </p>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 5).map((event) => (
                    <Link
                      key={event.id}
                      to={`/admin/events/${event.id}/edit`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">
                          {event.company_name || event.contact_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {event.guest_count} Gäste • {event.event_type || 'Event'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={event.status === 'new' ? 'default' : 'secondary'}
                        >
                          {event.status === 'new' ? 'Neu' : 
                           event.status === 'contacted' ? 'Kontaktiert' : 'Angebot'}
                        </Badge>
                        {event.preferred_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(parseISO(event.preferred_date), "dd.MM.yy", { locale: de })}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Orders */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Anstehende Bestellungen
                  </CardTitle>
                  <CardDescription>Nächste Lieferungen</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/orders">Alle anzeigen</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Keine anstehenden Bestellungen
                </p>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium font-mono text-sm">
                          {order.order_number}
                        </p>
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
                            {order.desired_time && ` ${order.desired_time}`}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};
