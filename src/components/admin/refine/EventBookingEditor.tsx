import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { 
  ArrowLeft, 
  Loader2, 
  Mail, 
  CheckCircle2, 
  Calendar, 
  Users, 
  CreditCard,
  Building2,
  User,
  Phone,
  AtSign,
  Activity
} from "lucide-react";
import { useList } from "@refinedev/core";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  useEventBooking, 
  useUpdateEventBooking, 
  useConfirmBookingMenu 
} from "@/hooks/useEventBookings";
import { MenuComposer, MenuSelection } from "./InquiryEditor/MenuComposer";
import { Timeline } from "@/components/admin/shared/Timeline";
import { EmailStatusCard } from "@/components/admin/shared/EmailStatusCard";

export const EventBookingEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: booking, isLoading, error } = useEventBooking(id);
  const { mutate: updateBooking } = useUpdateEventBooking();
  const { mutate: confirmMenu, isPending: isConfirming } = useConfirmBookingMenu();
  
  const [menuSelection, setMenuSelection] = useState<MenuSelection>({ courses: [], drinks: [] });
  const [internalNotes, setInternalNotes] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Fetch package for display
  const packagesQuery = useList({
    resource: "packages" as never,
    pagination: { pageSize: 100 },
  });
  const packages = packagesQuery.result?.data || [];

  // Initialize state from booking
  if (booking && !isInitialized) {
    if (booking.menu_selection) {
      // Cast to proper types since we store compatible data
      setMenuSelection({
        courses: (booking.menu_selection.courses || []) as MenuSelection['courses'],
        drinks: (booking.menu_selection.drinks || []) as MenuSelection['drinks'],
      });
    }
    setInternalNotes(booking.internal_notes || "");
    setIsInitialized(true);
  }

  const selectedPackage = packages.find((p: any) => p.id === booking?.package_id);

  // Auto-save function
  const performSave = useCallback(() => {
    if (!id || !isInitializedRef.current) return;
    setSaveStatus('saving');
    
    updateBooking({
      bookingId: id,
      updates: {
        menu_selection: menuSelection as any,
        internal_notes: internalNotes,
      },
    }, {
      onSuccess: () => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: () => {
        toast.error("Fehler beim Speichern");
        setSaveStatus('idle');
      },
    });
  }, [id, updateBooking, menuSelection, internalNotes]);

  // Auto-save on any change (debounced)
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 800);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [menuSelection, internalNotes, performSave]);

  // Mark as initialized after first load
  useEffect(() => {
    if (booking && !isInitializedRef.current) {
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }
  }, [booking]);

  const handleConfirmAndSend = useCallback(() => {
    if (!id) return;
    
    confirmMenu({
      bookingId: id,
      menuSelection: menuSelection as any,
      sendEmail: true,
    }, {
      onSuccess: () => {
        toast.success("Menü bestätigt und E-Mail gesendet!");
        navigate('/admin/bookings');
      },
      onError: () => toast.error("Fehler beim Bestätigen"),
    });
  }, [id, confirmMenu, menuSelection, navigate]);

  if (isLoading) {
    return (
      <AdminLayout activeTab="bookings">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !booking) {
    return (
      <AdminLayout activeTab="bookings">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Buchung nicht gefunden</p>
          <Button variant="link" onClick={() => navigate('/admin/bookings')}>
            Zurück zur Übersicht
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="bookings">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/bookings')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-muted-foreground">
                  {booking.booking_number}
                </span>
                {booking.payment_status === 'paid' && (
                  <Badge>
                    <CreditCard className="h-3 w-3 mr-1" />
                    Bezahlt
                  </Badge>
                )}
                {booking.menu_confirmed && (
                  <Badge variant="secondary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Menü bestätigt
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-serif font-semibold">
                {booking.company_name || booking.customer_name}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Auto-save status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Speichert...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Gespeichert</span>
                </>
              )}
            </div>
            
            {!booking.menu_confirmed && (
              <Button onClick={handleConfirmAndSend} disabled={isConfirming}>
                {isConfirming ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Bestätigung senden
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="aktivitaeten" className="gap-1.5">
              <Activity className="h-4 w-4" />
              Aktivitäten
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Menu Configuration */}
              <div className="lg:col-span-2 space-y-6">
                <MenuComposer
                  packageId={booking.package_id}
                  packageName={selectedPackage?.name || null}
                  guestCount={booking.guest_count}
                  menuSelection={menuSelection}
                  onMenuSelectionChange={setMenuSelection}
                />
              </div>

              {/* Right: Booking Details */}
              <div className="space-y-4">
                {/* Event Details Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Event-Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {booking.event_date && format(parseISO(booking.event_date), "EEEE, dd. MMMM yyyy", { locale: de })}
                      </span>
                    </div>
                    {booking.event_time && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-4" />
                        <span className="text-muted-foreground">{booking.event_time} Uhr</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{booking.guest_count} Gäste</span>
                    </div>
                    
                    <Separator />
                    
                    {selectedPackage && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Paket</p>
                        <p className="font-medium">{selectedPackage.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedPackage.price_per_person 
                            ? `${selectedPackage.price}€ p.P.`
                            : `${selectedPackage.price}€ pauschal`}
                        </p>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Gesamtbetrag</span>
                      <span className="text-xl font-bold text-primary">
                        {booking.total_amount?.toLocaleString('de-DE', { 
                          style: 'currency', 
                          currency: 'EUR' 
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Info Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Kunde</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{booking.customer_name}</span>
                    </div>
                    {booking.company_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.company_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <AtSign className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${booking.customer_email}`} className="text-primary hover:underline">
                        {booking.customer_email}
                      </a>
                    </div>
                    {booking.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${booking.phone}`} className="text-primary hover:underline">
                          {booking.phone}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Email Status */}
                <EmailStatusCard entityType="event_booking" entityId={id!} />

                {/* Internal Notes Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Interne Notizen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Notizen für das Team..."
                      rows={4}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="aktivitaeten">
            <div className="max-w-3xl">
              <Timeline entityType="event_booking" entityId={id!} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};
