import { useList } from "@refinedev/core";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, FileText, Clock, CheckCircle2, AlertCircle, ChefHat, Plus, Send, Edit3 } from "lucide-react";
import { format, parseISO, isAfter, addDays, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventInquiry, CateringOrder } from "@/types/refine";
import { useEventBookings } from "@/hooks/useEventBookings";
import { PageTransition, MotionCard } from "@/components/admin/motion";
import { EditorIndicator } from "@/components/admin/shared/EditorIndicator";

export const Dashboard = () => {
  // Fetch ALL events to categorize them
  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 100 },
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

  // Categorize events into 3 sections
  const newInquiries = events.filter(e => 
    e.status === 'new' && !e.last_edited_at
  );
  
  const inProgressInquiries = events.filter(e => 
    e.last_edited_at && !e.offer_sent_at && e.status !== 'confirmed' && e.status !== 'declined'
  );
  
  const offerSentInquiries = events.filter(e => 
    e.offer_sent_at && e.status !== 'confirmed' && e.status !== 'declined'
  );

  // Stats
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const pendingMenuCount = pendingMenuBookings.length;
  const upcomingOrdersCount = orders.filter(o => 
    o.desired_date && isAfter(parseISO(o.desired_date), new Date()) && 
    isAfter(addDays(new Date(), 7), parseISO(o.desired_date))
  ).length;

  return (
    <AdminLayout activeTab="dashboard">
      <PageTransition>
        <div className="space-y-8">
          {/* Header with Quick Action */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between"
          >
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">StoriaMaestro</h1>
              <p className="text-base text-muted-foreground">
                Willkommen im Event- & Catering-Management
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button asChild className="shadow-lg rounded-2xl">
                <Link to="/admin/events/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Neue Anfrage
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Stats Cards with Stagger Animation */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MotionCard index={0}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">
                  Neue Anfragen
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{newInquiries.length}</div>
                <p className="text-sm text-muted-foreground">
                  Warten auf Bearbeitung
                </p>
              </CardContent>
            </MotionCard>

            <MotionCard index={1}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">
                  In Bearbeitung
                </CardTitle>
                <Edit3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{inProgressInquiries.length}</div>
                <p className="text-sm text-muted-foreground">
                  Angebot wird erstellt
                </p>
              </CardContent>
            </MotionCard>

            <MotionCard index={2}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">
                  Angebot versendet
                </CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{offerSentInquiries.length}</div>
                <p className="text-sm text-muted-foreground">
                  Wartet auf Rückmeldung
                </p>
              </CardContent>
            </MotionCard>

            <MotionCard index={3}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">
                  Diese Woche
                </CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{upcomingOrdersCount}</div>
                <p className="text-sm text-muted-foreground">
                  Anstehende Lieferungen
                </p>
              </CardContent>
            </MotionCard>
          </div>

          {/* Three Column Layout for Inquiry Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* New Inquiries */}
            <Card className="border-l-4 border-l-destructive/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive/70" />
                    <CardTitle className="text-base">Neue Anfragen</CardTitle>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {newInquiries.length}
                  </Badge>
                </div>
                <CardDescription>Noch nicht bearbeitet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {newInquiries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine neuen Anfragen
                  </p>
                ) : (
                  newInquiries.slice(0, 5).map((event) => (
                    <InquiryCard key={event.id} event={event} />
                  ))
                )}
                {newInquiries.length > 5 && (
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link to="/admin/events?filter=new">
                      +{newInquiries.length - 5} weitere anzeigen
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* In Progress */}
            <Card className="border-l-4 border-l-amber-500/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-amber-600" />
                    <CardTitle className="text-base">In Bearbeitung</CardTitle>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {inProgressInquiries.length}
                  </Badge>
                </div>
                <CardDescription>Angebot wird erstellt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {inProgressInquiries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Anfragen in Bearbeitung
                  </p>
                ) : (
                  inProgressInquiries.slice(0, 5).map((event) => (
                    <InquiryCard key={event.id} event={event} showEditor />
                  ))
                )}
                {inProgressInquiries.length > 5 && (
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link to="/admin/events?filter=in_progress">
                      +{inProgressInquiries.length - 5} weitere anzeigen
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Offer Sent */}
            <Card className="border-l-4 border-l-emerald-500/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base">Angebot versendet</CardTitle>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {offerSentInquiries.length}
                  </Badge>
                </div>
                <CardDescription>Wartet auf Rückmeldung</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {offerSentInquiries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine versendeten Angebote
                  </p>
                ) : (
                  offerSentInquiries.slice(0, 5).map((event) => (
                    <InquiryCard key={event.id} event={event} showOfferSent />
                  ))
                )}
                {offerSentInquiries.length > 5 && (
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link to="/admin/events?filter=offer_sent">
                      +{offerSentInquiries.length - 5} weitere anzeigen
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row: Orders + Menu Pending */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Menu Bookings */}
            {pendingMenuCount > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ChefHat className="h-5 w-5" />
                        Menü offen
                      </CardTitle>
                      <CardDescription>Buchungen ohne finales Menü</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/admin/bookings?filter=menu_pending">Alle anzeigen</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
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
                          <Badge variant="outline">Menü offen</Badge>
                          {booking.event_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(parseISO(booking.event_date), "dd.MM.yy", { locale: de })}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
      </PageTransition>
    </AdminLayout>
  );
};

// Inquiry Card Component
function InquiryCard({ 
  event, 
  showEditor = false,
  showOfferSent = false 
}: { 
  event: EventInquiry; 
  showEditor?: boolean;
  showOfferSent?: boolean;
}) {
  return (
    <Link
      to={`/admin/events/${event.id}/edit`}
      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {event.company_name || event.contact_name}
        </p>
        <p className="text-sm text-muted-foreground">
          {event.guest_count} Gäste • {event.event_type || 'Event'}
        </p>
        {showEditor && event.last_edited_at && (
          <div className="mt-1">
            <EditorIndicator 
              editedAt={event.last_edited_at} 
              compact 
            />
          </div>
        )}
        {showOfferSent && event.offer_sent_at && (
          <p className="text-xs text-muted-foreground mt-1">
            Versendet {formatDistanceToNow(parseISO(event.offer_sent_at), { addSuffix: true, locale: de })}
          </p>
        )}
      </div>
      <div className="text-right ml-2">
        {event.preferred_date && (
          <p className="text-xs text-muted-foreground">
            {format(parseISO(event.preferred_date), "dd.MM.yy", { locale: de })}
          </p>
        )}
      </div>
    </Link>
  );
}
