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
  Activity,
  Ban,
  RefreshCw
} from "lucide-react";
import { useList } from "@refinedev/core";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
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
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [guestCount, setGuestCount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [bookingStatus, setBookingStatus] = useState<string>("menu_pending");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMarkingRefunded, setIsMarkingRefunded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setEventDate(booking.event_date || "");
    setEventTime((booking.event_time || "").slice(0, 5));
    setGuestCount(booking.guest_count || 0);
    setTotalAmount(Number(booking.total_amount) || 0);
    setBookingStatus(booking.status || "menu_pending");
    setCustomerName(booking.customer_name || "");
    setCustomerEmail(booking.customer_email || "");
    setPhone(booking.phone || "");
    setCompanyName(booking.company_name || "");
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
        event_date: eventDate || null,
        event_time: eventTime || null,
        guest_count: guestCount || 0,
        total_amount: totalAmount || 0,
        status: bookingStatus,
        customer_name: customerName,
        customer_email: customerEmail,
        phone: phone || null,
        company_name: companyName || null,
      } as any,
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
  }, [id, updateBooking, menuSelection, internalNotes, eventDate, eventTime, guestCount, totalAmount, bookingStatus, customerName, customerEmail, phone, companyName]);

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
  }, [menuSelection, internalNotes, eventDate, eventTime, guestCount, totalAmount, bookingStatus, customerName, customerEmail, phone, companyName, performSave]);

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
      onSuccess: (result: { ok: boolean; emailSent: boolean } | void) => {
        if (result?.emailSent) {
          toast.success("Menü bestätigt und E-Mail gesendet!");
        } else {
          toast.warning("Menü bestätigt — E-Mail-Versand fehlgeschlagen");
        }
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

            {bookingStatus !== "cancelled" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Ban className="h-4 w-4 mr-2" />
                    Stornieren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Buchung stornieren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Die Buchung wird als storniert markiert. Bei bereits geleisteten Zahlungen muss die Rückerstattung manuell vorgenommen und anschließend als „zurückerstattet" markiert werden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Stornierungsgrund (optional)</Label>
                    <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="z.B. Kunde hat abgesagt..." />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelBooking} disabled={isCancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {isCancelling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wird storniert...</> : "Stornieren"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Datum</Label>
                        <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
                        <Input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Gäste</Label>
                      <Input type="number" min="0" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value) || 0)} />
                    </div>
                    {eventDate && (
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(eventDate), "EEEE, dd. MMMM yyyy", { locale: de })}
                      </p>
                    )}
                    
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
                    
                    <div>
                      <Label className="text-xs text-muted-foreground">Gesamtbetrag (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
                        className="text-right font-semibold text-base"
                      />
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={bookingStatus} onValueChange={setBookingStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="menu_pending">Menü ausstehend</SelectItem>
                          <SelectItem value="ready">Bereit</SelectItem>
                          <SelectItem value="completed">Abgeschlossen</SelectItem>
                          <SelectItem value="cancelled">Storniert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {booking.payment_status === "paid" && (
                      <Button variant="outline" size="sm" className="w-full" onClick={markRefundedManually} disabled={isMarkingRefunded}>
                        {isMarkingRefunded ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                        Als zurückerstattet markieren
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Info Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Kunde</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Name</Label>
                      <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Firma</Label>
                      <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="optional" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><AtSign className="h-3 w-3" /> E-Mail</Label>
                      <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Telefon</Label>
                      <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" />
                    </div>
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
