import React from "react";
import { useList, useUpdate } from "@refinedev/core";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, FileText, Clock, CheckCircle2, AlertCircle, ChefHat, Plus, Send, Edit3, CreditCard, Receipt, Phone, MessageSquare, MoreVertical, Copy, Mail, Flame, ExternalLink, User, AlertTriangle } from "lucide-react";
import { format, parseISO, isAfter, addDays, formatDistanceToNow, differenceInHours } from "date-fns";
import { de } from "date-fns/locale";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { EventInquiry, CateringOrder } from "@/types/refine";
import { useEventBookings, usePaidEventBookings } from "@/hooks/useEventBookings";
import { PageTransition, MotionCard } from "@/components/admin/motion";
import { EditorIndicator } from "@/components/admin/shared/EditorIndicator";
import { AssigneeBadge, AssigneeSelector } from "@/components/admin/shared/AssigneeSelector";
import { PriorityBadge } from "@/components/admin/shared/PrioritySelector";
import { TasksWidget } from "@/components/admin/refine/TasksWidget";
import { supabase } from "@/integrations/supabase/client";

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
  
  // Fetch paid event bookings
  const { data: paidBookings } = usePaidEventBookings();

  const events = eventsQuery.result?.data || [];
  const orders = ordersQuery.result?.data || [];
  const pendingMenuBookings = bookings || [];
  const paidEventBookings = paidBookings || [];

  // Categorize events into 3 sections based on status (the single source of truth)
  // Status 'offer_sent' means at least one version was sent - it stays there even when editing a new version
  const newInquiries = events.filter(e => 
    e.status === 'new' && !e.last_edited_at
  );
  
  const inProgressInquiries = events.filter(e => 
    (e.last_edited_at || e.status === 'contacted') && 
    e.status !== 'offer_sent' && 
    e.status !== 'confirmed' && 
    e.status !== 'declined'
  );
  
  // offer_sent = status is the source of truth (set once, stays forever unless confirmed/declined)
  const offerSentInquiries = events.filter(e => 
    e.status === 'offer_sent'
  );

  // Stats
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const pendingMenuCount = pendingMenuBookings.length;
  const upcomingOrdersCount = orders.filter(o =>
    o.desired_date && isAfter(parseISO(o.desired_date), new Date()) &&
    isAfter(addDays(new Date(), 7), parseISO(o.desired_date))
  ).length;

  // Quick Action: Mark as contacted
  const { mutate: updateInquiry } = useUpdate();

  const handleMarkContacted = (id: string) => {
    updateInquiry({
      resource: "events",
      id,
      values: { status: "contacted" },
    });
  };

  return (
    <AdminLayout activeTab="dashboard">
      <PageTransition>
        <div className="space-y-12">
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

          {/* Stats Cards with Stagger Animation - Clickable for filtering */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Link to="/admin/events?filter=new" className="block">
              <MotionCard index={0} className="cursor-pointer hover:border-amber-500/50 transition-colors">
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
            </Link>

            <Link to="/admin/events?filter=in_progress" className="block">
              <MotionCard index={1} className="cursor-pointer hover:border-amber-500/50 transition-colors">
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
            </Link>

            <Link to="/admin/events?filter=offer_sent" className="block">
              <MotionCard index={2} className="cursor-pointer hover:border-emerald-500/50 transition-colors">
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
            </Link>

            <Link to="/admin/orders" className="block">
              <MotionCard index={3} className="cursor-pointer hover:border-primary/50 transition-colors">
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
            </Link>
          </div>

          {/* Three Column Layout for Inquiry Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* New Inquiries */}
            <Card className="border-l-4 border-l-amber-500/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
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
                  <p className="text-sm text-muted-foreground/60 text-center py-8">
                    Keine neuen Anfragen
                  </p>
                ) : (
                  newInquiries.slice(0, 5).map((event) => (
                    <InquiryCard
                      key={event.id}
                      event={event}
                      showQuickActions
                      onMarkContacted={handleMarkContacted}
                    />
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
                  <p className="text-sm text-muted-foreground/60 text-center py-8">
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
                  <p className="text-sm text-muted-foreground/60 text-center py-8">
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

          {/* Paid Event Bookings Box */}
          {paidEventBookings.length > 0 && (
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-emerald-600" />
                      Bezahlte Aufträge
                    </CardTitle>
                    <CardDescription>Erfolgreich bezahlte Event-Buchungen</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {paidEventBookings.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paidEventBookings.slice(0, 5).map((booking) => (
                    <Link
                      key={booking.id}
                      to={`/admin/bookings/${booking.id}/edit`}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-medium">
                            {booking.booking_number}
                          </p>
                          <Badge variant="default" className="bg-emerald-600 text-xs">
                            Bezahlt
                          </Badge>
                        </div>
                        <p className="font-medium">
                          {booking.company_name || booking.customer_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.guest_count} Gäste • {booking.event_date && format(parseISO(booking.event_date), "dd.MM.yy", { locale: de })}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {booking.lexoffice_invoice_id ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <Receipt className="h-3 w-3" />
                              LexOffice: Rechnung erstellt
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <Receipt className="h-3 w-3" />
                              LexOffice: ausstehend
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">
                          {booking.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {paidEventBookings.length > 5 && (
                    <Button variant="ghost" size="sm" asChild className="w-full">
                      <Link to="/admin/bookings?filter=paid">
                        +{paidEventBookings.length - 5} weitere anzeigen
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bottom Row: Tasks + Orders + Menu Pending */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tasks Widget */}
            <TasksWidget />

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

// Inquiry Card Component with Quick Actions Dropdown
function InquiryCard({
  event,
  showEditor = false,
  showOfferSent = false,
  showQuickActions = false,
  onMarkContacted
}: {
  event: EventInquiry;
  showEditor?: boolean;
  showOfferSent?: boolean;
  showQuickActions?: boolean;
  onMarkContacted?: (id: string) => void;
}) {
  const { toast } = useToast();

  // Calculate if inquiry is urgent (> 48h old and still 'new')
  const isUrgent = event.status === 'new' && event.created_at &&
    differenceInHours(new Date(), parseISO(event.created_at)) > 48;

  const handleMarkContacted = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMarkContacted) {
      onMarkContacted(event.id);
    }
  };

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (event.email) {
      navigator.clipboard.writeText(event.email);
      toast({
        description: `E-Mail kopiert: ${event.email}`,
      });
    }
  };

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (event.phone) {
      navigator.clipboard.writeText(event.phone);
      toast({
        description: `Telefon kopiert: ${event.phone}`,
      });
    }
  };

  const handleOpenEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (event.email) {
      window.open(`mailto:${event.email}`, '_blank');
    }
  };

  const handleAssignToMe = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase
        .from('event_inquiries')
        .update({
          assigned_to: user.email,
          assigned_at: new Date().toISOString(),
          assigned_by: user.email,
        })
        .eq('id', event.id);
      toast({ description: "Anfrage wurde dir zugewiesen" });
      // Trigger refetch by refreshing
      window.location.reload();
    }
  };

  const handleSetPriority = async (e: React.MouseEvent, priority: 'high' | 'urgent') => {
    e.preventDefault();
    e.stopPropagation();
    await supabase
      .from('event_inquiries')
      .update({ priority })
      .eq('id', event.id);
    toast({ description: `Priorität auf "${priority === 'high' ? 'Hoch' : 'Dringend'}" gesetzt` });
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group">
      <Link
        to={`/admin/events/${event.id}/edit`}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">
            {event.company_name || event.contact_name}
          </p>
          {/* Priority Badge - show if high/urgent OR auto-urgent */}
          {(event.priority === 'urgent' || event.priority === 'high' || isUrgent) && (
            <PriorityBadge priority={isUrgent && event.priority === 'normal' ? 'urgent' : event.priority} showLabel={false} />
          )}
          {/* Assignee Badge */}
          {event.assigned_to && <AssigneeBadge email={event.assigned_to} />}
        </div>
        <p className="text-sm text-muted-foreground">
          {event.guest_count} Gäste • {event.event_type || 'Event'}
        </p>
        {/* Message Preview */}
        {event.message && (
          <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 italic flex items-start gap-1">
            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
            <span>"{event.message.slice(0, 100)}{event.message.length > 100 ? '...' : ''}"</span>
          </p>
        )}
        {/* Antwortzeit-Anzeige */}
        {event.created_at && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Eingegangen {formatDistanceToNow(parseISO(event.created_at), { addSuffix: true, locale: de })}
          </p>
        )}
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
      </Link>
      <div className="text-right ml-2 flex flex-col items-end gap-1">
        {event.created_at && (
          <p className="text-xs text-muted-foreground">
            {format(parseISO(event.created_at), "dd.MM.yy", { locale: de })}
          </p>
        )}
        {/* Quick Actions Dropdown */}
        {showQuickActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {onMarkContacted && (
                <DropdownMenuItem onClick={handleMarkContacted}>
                  <Phone className="h-4 w-4 mr-2" />
                  Als kontaktiert markieren
                </DropdownMenuItem>
              )}
              {/* Assignment */}
              {!event.assigned_to && (
                <DropdownMenuItem onClick={handleAssignToMe}>
                  <User className="h-4 w-4 mr-2" />
                  Mir zuweisen
                </DropdownMenuItem>
              )}
              {/* Priority */}
              {event.priority !== 'urgent' && (
                <DropdownMenuItem onClick={(e) => handleSetPriority(e, 'urgent')}>
                  <Flame className="h-4 w-4 mr-2 text-red-500" />
                  Als dringend markieren
                </DropdownMenuItem>
              )}
              {event.priority !== 'high' && event.priority !== 'urgent' && (
                <DropdownMenuItem onClick={(e) => handleSetPriority(e, 'high')}>
                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                  Hohe Priorität setzen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {event.email && (
                <>
                  <DropdownMenuItem onClick={handleCopyEmail}>
                    <Copy className="h-4 w-4 mr-2" />
                    E-Mail kopieren
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenEmail}>
                    <Mail className="h-4 w-4 mr-2" />
                    E-Mail öffnen
                  </DropdownMenuItem>
                </>
              )}
              {event.phone && (
                <DropdownMenuItem onClick={handleCopyPhone}>
                  <Phone className="h-4 w-4 mr-2" />
                  Telefon kopieren
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={`/admin/events/${event.id}/edit`} onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Anfrage öffnen
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* Non-dropdown quick action for non-new cards */}
        {!showQuickActions && showEditor && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            asChild
          >
            <Link to={`/admin/events/${event.id}/edit`}>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
