import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate } from "@refinedev/core";
import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Loader2, Save, Phone, Mail, Building2, MapPin, 
  Calendar, Clock, CreditCard, Receipt, User, BadgeCheck, 
  FileText, Truck, Package, Ban, RefreshCw, AlertCircle, Activity
} from "lucide-react";
import { Timeline } from "@/components/admin/shared/Timeline";
import { EmailStatusCard } from "@/components/admin/shared/EmailStatusCard";

type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

const statusConfig: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Neu", variant: "default" },
  confirmed: { label: "Bestätigt", variant: "secondary" },
  completed: { label: "Erledigt", variant: "outline" },
  cancelled: { label: "Storniert", variant: "destructive" },
};

export const CateringOrderEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const orderQuery = useOne({
    resource: "orders",
    id: id || "",
  });
  
  const updateMutation = useUpdate();
  
  const order = orderQuery.result;
  const isSaving = updateMutation.mutation.isPending;
  
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState<OrderStatus>("pending");
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize state from order
  useEffect(() => {
    if (order && !isInitialized) {
      setInternalNotes(order.internal_notes || "");
      setStatus(order.status || "pending");
      setIsInitialized(true);
    }
  }, [order, isInitialized]);

  const handleSave = useCallback(() => {
    if (!id) return;
    
    updateMutation.mutate({
      resource: "orders",
      id,
      values: {
        internal_notes: internalNotes,
        status,
      },
    }, {
      onSuccess: () => toast.success("Änderungen gespeichert"),
      onError: () => toast.error("Fehler beim Speichern"),
    });
  }, [id, updateMutation, internalNotes, status]);

  const handleCancelOrder = async () => {
    if (!id || !order) return;
    
    setIsCancelling(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("cancel-catering-order", {
        body: {
          orderId: id,
          reason: cancelReason || "Stornierung durch Admin",
        },
      });

      if (fnError) throw fnError;

      toast.success("Bestellung storniert" + (result?.refunded ? " und Rückerstattung eingeleitet" : ""));
      orderQuery.query.refetch();
    } catch (err: any) {
      console.error("Cancel error:", err);
      toast.error(err.message || "Fehler beim Stornieren");
    } finally {
      setIsCancelling(false);
    }
  };

  if (orderQuery.query.isLoading) {
    return (
      <AdminLayout activeTab="orders">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (orderQuery.query.error || !order) {
    return (
      <AdminLayout activeTab="orders">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Bestellung nicht gefunden</p>
          <Button variant="link" onClick={() => navigate('/admin/orders')}>
            Zurück zur Übersicht
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const isCancelled = order.status === 'cancelled';
  const isPaid = order.payment_method === 'stripe' && order.payment_status === 'paid';

  return (
    <AdminLayout activeTab="orders">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/orders')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-muted-foreground">
                  {order.order_number}
                </span>
                <Badge variant={statusConfig[order.status as OrderStatus]?.variant || "default"}>
                  {statusConfig[order.status as OrderStatus]?.label || order.status}
                </Badge>
                {isPaid && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    <CreditCard className="h-3 w-3 mr-1" />
                    Bezahlt
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-serif font-semibold">
                {order.company_name || order.customer_name}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
            
            {!isCancelled && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Ban className="h-4 w-4 mr-2" />
                    Stornieren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bestellung stornieren?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div>
                          {isPaid ? (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <AlertCircle className="h-4 w-4 text-primary" />
                              Die Zahlung wird automatisch über Stripe zurückerstattet.
                            </span>
                          ) : (
                            <span>Diese Bestellung wird als storniert markiert.</span>
                          )}
                        </div>
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Stornierungsgrund (optional)</label>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="z.B. Kunde hat abgesagt..."
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelOrder}
                      disabled={isCancelling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Wird storniert...
                        </>
                      ) : (
                        "Bestellung stornieren"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Cancelled Notice */}
        {isCancelled && (
          <Card className="border-muted-foreground/30 bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Ban className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-muted-foreground">Bestellung storniert</p>
                  {order.cancellation_reason && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Grund: {order.cancellation_reason}
                    </p>
                  )}
                  {order.cancelled_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Storniert am: {format(parseISO(order.cancelled_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="details">Bestellung</TabsTrigger>
            <TabsTrigger value="aktivitaeten" className="gap-1.5">
              <Activity className="h-4 w-4" />
              Aktivitäten
            </TabsTrigger>
          </TabsList>

          {/* Tab: Details */}
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Order Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Bestellte Artikel</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3 font-medium">Artikel</th>
                            <th className="text-center p-3 font-medium">Menge</th>
                            <th className="text-right p-3 font-medium">Preis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item: any, index: number) => (
                            <tr key={index} className="border-t">
                              <td className="p-3">{item.name}</td>
                              <td className="p-3 text-center">{item.quantity}x</td>
                              <td className="p-3 text-right">
                                {((item.price || 0) * (item.quantity || 1)).toFixed(2).replace('.', ',')} €
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/50">
                          <tr className="border-t">
                            <td className="p-3" colSpan={2}>Zwischensumme</td>
                            <td className="p-3 text-right">
                              {items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0).toFixed(2).replace('.', ',')} €
                            </td>
                          </tr>
                          {order.minimum_order_surcharge > 0 && (
                            <tr className="border-t text-muted-foreground">
                              <td className="p-3" colSpan={2}>Mindestbestellwert-Aufschlag</td>
                              <td className="p-3 text-right">
                                +{order.minimum_order_surcharge.toFixed(2).replace('.', ',')} €
                              </td>
                            </tr>
                          )}
                          {order.delivery_cost > 0 && (
                            <tr className="border-t">
                              <td className="p-3" colSpan={2}>
                                Lieferkosten
                                {order.calculated_distance_km && (
                                  <span className="text-muted-foreground ml-1">
                                    ({order.calculated_distance_km.toFixed(1)} km)
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                +{order.delivery_cost.toFixed(2).replace('.', ',')} €
                              </td>
                            </tr>
                          )}
                          <tr className="border-t-2 font-semibold bg-muted">
                            <td className="p-3" colSpan={2}>Gesamtsumme (inkl. MwSt.)</td>
                            <td className="p-3 text-right text-primary text-lg">
                              {(order.total_amount || 0).toFixed(2).replace('.', ',')} €
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Notes */}
                {order.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Kundenanmerkungen
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm bg-muted/50 rounded-lg p-4">{order.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Internal Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Interne Notizen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Notizen für das Team (z.B. Besonderheiten, Rücksprache nötig...)"
                      className="min-h-[100px]"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Info Cards */}
              <div className="space-y-6">
                {/* Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select 
                      value={status} 
                      onValueChange={(v) => setStatus(v as OrderStatus)}
                      disabled={isCancelled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Neu</SelectItem>
                        <SelectItem value="confirmed">Bestätigt</SelectItem>
                        <SelectItem value="completed">Erledigt</SelectItem>
                        <SelectItem value="cancelled">Storniert</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Customer */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Kunde</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="font-medium text-lg">{order.customer_name}</p>
                    {order.company_name && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        {order.company_name}
                      </p>
                    )}
                    <a href={`mailto:${order.customer_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Mail className="h-4 w-4" />
                      {order.customer_email}
                    </a>
                    <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Phone className="h-4 w-4" />
                      {order.customer_phone}
                    </a>
                    <div className="pt-2 border-t">
                      {order.user_id ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          <BadgeCheck className="h-3 w-3 mr-1" />
                          Registrierter Kunde
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <User className="h-3 w-3 mr-1" />
                          Gast
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {order.is_pickup ? (
                        <><Package className="h-4 w-4" /> Abholung</>
                      ) : (
                        <><Truck className="h-4 w-4" /> Lieferung</>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {order.desired_date && (
                      <p className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(parseISO(order.desired_date), "EEEE, dd. MMMM yyyy", { locale: de })}
                      </p>
                    )}
                    {order.desired_time && (
                      <p className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {order.desired_time} Uhr
                      </p>
                    )}
                    {!order.is_pickup && (order.delivery_street || order.delivery_city) && (
                      <div className="pt-2 border-t">
                        <p className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <span>
                            {order.delivery_street && <>{order.delivery_street}<br /></>}
                            {order.delivery_zip} {order.delivery_city}
                            {order.delivery_floor && <><br />Etage: {order.delivery_floor}</>}
                            {order.has_elevator && <><br /><span className="text-muted-foreground">(mit Aufzug)</span></>}
                          </span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Zahlung
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Methode:</span>{" "}
                      {order.payment_method === 'stripe' ? 'Sofortzahlung (Stripe)' : 'Rechnung'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                        {order.payment_status === 'paid' ? 'Bezahlt' : 'Ausstehend'}
                      </Badge>
                    </div>
                    {order.lexoffice_invoice_id && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">LexOffice:</span>{" "}
                        {order.lexoffice_document_type === 'invoice' ? 'Rechnung' : 'Angebot'}
                      </p>
                    )}
                    {order.stripe_payment_intent_id && (
                      <p className="text-xs text-muted-foreground font-mono">
                        PI: {order.stripe_payment_intent_id.slice(0, 20)}...
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Billing Address */}
                {order.billing_name && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Rechnungsadresse
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p className="font-medium">{order.billing_name}</p>
                      {order.billing_street && <p>{order.billing_street}</p>}
                      {(order.billing_zip || order.billing_city) && (
                        <p>{order.billing_zip} {order.billing_city}</p>
                      )}
                      {order.billing_country && order.billing_country !== 'Deutschland' && (
                        <p>{order.billing_country}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Email Status */}
                <EmailStatusCard entityType="catering_order" entityId={id!} />
              </div>
            </div>
          </TabsContent>

          {/* Tab: Aktivitäten */}
          <TabsContent value="aktivitaeten">
            <div className="max-w-3xl">
              <Timeline entityType="catering_order" entityId={id!} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};
