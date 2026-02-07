import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Calendar, Users, ChefHat, Loader2 } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEventBookings, BookingStatus } from "@/hooks/useEventBookings";
import { useList } from "@refinedev/core";

type FilterTab = 'all' | 'menu_pending' | 'ready' | 'completed';

export const EventBookingsList = () => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  
  const { data: bookings, isLoading, error } = useEventBookings(
    activeFilter === 'all' ? 'all' : activeFilter as BookingStatus
  );

  // Fetch packages for display
  const packagesQuery = useList({
    resource: "packages" as never,
    pagination: { pageSize: 100 },
  });
  const packages = packagesQuery.result?.data || [];

  const getPackageName = (packageId: string | null) => {
    if (!packageId) return "Kein Paket";
    const pkg = packages.find((p: any) => p.id === packageId);
    return pkg?.name || "Unbekanntes Paket";
  };

  const getStatusBadge = (booking: { status: string | null; menu_confirmed: boolean | null }) => {
    if (booking.status === 'completed') {
      return <Badge variant="secondary">Abgeschlossen</Badge>;
    }
    if (booking.status === 'cancelled') {
      return <Badge variant="destructive">Storniert</Badge>;
    }
    if (booking.menu_confirmed) {
      return <Badge>Bereit</Badge>;
    }
    return (
      <Badge variant="outline">
        <AlertCircle className="h-3 w-3 mr-1" />
        Menü offen
      </Badge>
    );
  };

  if (error) {
    return (
      <AdminLayout activeTab="bookings">
        <div className="text-center py-12 text-destructive">
          Fehler beim Laden der Buchungen
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="bookings">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Events</h1>
            <p className="text-sm text-muted-foreground">
              Bezahlte Events mit Menü-Konfiguration
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="menu_pending" className="gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Menü offen
            </TabsTrigger>
            <TabsTrigger value="ready">Bereit</TabsTrigger>
            <TabsTrigger value="completed">Abgeschlossen</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Bookings List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bookings?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {activeFilter === 'menu_pending' 
                  ? 'Keine Buchungen mit offenem Menü'
                  : 'Keine Buchungen gefunden'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings?.map((booking) => (
              <Card key={booking.id} className="rounded-xl border border-border/60 bg-white dark:bg-gray-900 hover:shadow-md hover:border-primary/40 transition-all">
                <CardContent className="p-0">
                  <Link
                    to={`/admin/bookings/${booking.id}/edit`}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center
                        ${booking.menu_confirmed 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'}
                      `}>
                        {booking.menu_confirmed 
                          ? <CheckCircle2 className="h-6 w-6" />
                          : <ChefHat className="h-6 w-6" />}
                      </div>

                      {/* Booking Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base text-muted-foreground">
                            {booking.booking_number}
                          </span>
                          {getStatusBadge(booking)}
                        </div>
                        <p className="font-medium text-lg">
                          {booking.company_name || booking.customer_name}
                        </p>
                        <p className="text-base text-muted-foreground">
                          {getPackageName(booking.package_id)}
                        </p>
                      </div>
                    </div>

                    {/* Right Side: Date & Details */}
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-base text-muted-foreground justify-end mb-1">
                        <Calendar className="h-4 w-4" />
                        {booking.event_date && format(parseISO(booking.event_date), "dd.MM.yyyy", { locale: de })}
                        {booking.event_time && `, ${booking.event_time}`}
                      </div>
                      <div className="flex items-center gap-4 text-base">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {booking.guest_count} Gäste
                        </span>
                        <span className="font-semibold">
                          {booking.total_amount?.toLocaleString('de-DE', { 
                            style: 'currency', 
                            currency: 'EUR' 
                          })}
                        </span>
                      </div>
                      
                      {!booking.menu_confirmed && (
                        <Button size="sm" variant="outline" className="mt-2">
                          Menü festlegen
                        </Button>
                      )}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
