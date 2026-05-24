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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Loader2, Save, Phone, Mail, Building2, MapPin, 
  Calendar, Clock, CreditCard, Receipt, User, BadgeCheck, 
  FileText, Truck, Package, Ban, RefreshCw, AlertCircle, Activity,
  ExternalLink, Download, Plus, Trash2, Minus
} from "lucide-react";
import { Timeline } from "@/components/admin/shared/Timeline";
import { EmailStatusCard } from "@/components/admin/shared/EmailStatusCard";
import { MenuItemPicker } from "./MenuItemPicker";

type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

// ─── Invoice PDF Download Button ───
const InvoicePdfButton = ({ 
  lexofficeInvoiceId, 
  documentType, 
  variant = "outline", 
  size = "sm",
  label = "PDF herunterladen" 
}: { 
  lexofficeInvoiceId: string; 
  documentType: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
  label?: string;
}) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const voucherType = documentType === 'invoice' ? 'invoice' : 'quotation';
      const { data, error } = await supabase.functions.invoke('get-lexoffice-document', {
        body: { voucherId: lexofficeInvoiceId, voucherType },
      });

      if (error || data?.error) throw new Error(data?.error || 'Download failed');

      const blob = new Blob(
        [Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))],
        { type: 'application/pdf' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `STORIA_Rechnung.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error("PDF konnte nicht heruntergeladen werden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleDownload} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1" />
      )}
      {label}
    </Button>
  );
};

// ─── Create Invoice Button ───
const CreateInvoiceButton = ({ 
  order, 
  onSuccess 
}: { 
  order: any; 
  onSuccess: () => void;
}) => {
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const items = Array.isArray(order.items) ? order.items : [];
      const payload = {
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone || '',
        companyName: order.company_name || undefined,
        billingAddress: {
          name: order.billing_name || order.company_name || order.customer_name,
          street: order.billing_street || '',
          zip: order.billing_zip || '',
          city: order.billing_city || '',
          country: order.billing_country || 'DE',
        },
        items: items.map((item: { id: string; name: string; quantity: number; price: number }) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: (order.total_amount || 0) - (order.delivery_cost || 0) - (order.minimum_order_surcharge || 0),
        deliveryCost: order.delivery_cost || 0,
        minimumOrderSurcharge: order.minimum_order_surcharge || 0,
        grandTotal: order.total_amount || 0,
        isPickup: order.is_pickup || false,
        documentType: order.payment_status === 'paid' ? 'invoice' : 'quotation',
        isPaid: order.payment_status === 'paid',
        desiredDate: order.desired_date || undefined,
        desiredTime: order.desired_time || undefined,
        deliveryAddress: !order.is_pickup && order.delivery_street
          ? `${order.delivery_street}, ${order.delivery_zip || ''} ${order.delivery_city || ''}`.trim()
          : undefined,
        notes: order.notes || undefined,
        paymentMethod: order.payment_method || 'stripe',
        isEventBooking: false,
      };

      const { data, error } = await supabase.functions.invoke('create-lexoffice-invoice', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.skipped) {
        toast.info(data.reason || 'LexOffice nicht konfiguriert');
      } else if (data?.success || data?.documentId) {
        const docType = data.documentType === 'invoice' ? 'Rechnung' : 'Angebot';
        toast.success(`${docType} erfolgreich erstellt`);
        onSuccess();
      }
    } catch (err: any) {
      console.error('Invoice creation error:', err);
      toast.error(err.message || 'Fehler beim Erstellen der Rechnung');
    } finally {
      setLoading(false);
    }
  };

  const docLabel = order.payment_status === 'paid' ? 'Rechnung' : 'Angebot';

  return (
    <Button variant="default" size="sm" onClick={handleCreate} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Plus className="h-4 w-4 mr-2" />
      )}
      {docLabel} erstellen
    </Button>
  );
};

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

  // Editable state
  type OrderItem = { id?: string; name: string; quantity: number; price: number };
  const [itemsState, setItemsState] = useState<OrderItem[]>([]);
  const [desiredDate, setDesiredDate] = useState<string>("");
  const [desiredTime, setDesiredTime] = useState<string>("");
  const [isPickup, setIsPickup] = useState<boolean>(true);
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryFloor, setDeliveryFloor] = useState("");
  const [hasElevator, setHasElevator] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [minimumOrderSurcharge, setMinimumOrderSurcharge] = useState<number>(0);
  const [billingName, setBillingName] = useState("");
  const [billingStreet, setBillingStreet] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingCountry, setBillingCountry] = useState("Deutschland");
  const [isRecalcDelivery, setIsRecalcDelivery] = useState(false);
  const [isMarkingRefunded, setIsMarkingRefunded] = useState(false);

  // Initialize state from order
  useEffect(() => {
    if (order && !isInitialized) {
      setInternalNotes(order.internal_notes || "");
      setStatus(order.status || "pending");
      setItemsState(Array.isArray(order.items) ? order.items.map((i: any) => ({
        id: i.id, name: i.name, quantity: Number(i.quantity) || 1, price: Number(i.price) || 0,
      })) : []);
      setDesiredDate(order.desired_date || "");
      setDesiredTime((order.desired_time || "").slice(0, 5));
      setIsPickup(!!order.is_pickup);
      setDeliveryStreet(order.delivery_street || "");
      setDeliveryZip(order.delivery_zip || "");
      setDeliveryCity(order.delivery_city || "");
      setDeliveryFloor(order.delivery_floor || "");
      setHasElevator(!!order.has_elevator);
      setDeliveryCost(Number(order.delivery_cost) || 0);
      setMinimumOrderSurcharge(Number(order.minimum_order_surcharge) || 0);
      setBillingName(order.billing_name || "");
      setBillingStreet(order.billing_street || "");
      setBillingZip(order.billing_zip || "");
      setBillingCity(order.billing_city || "");
      setBillingCountry(order.billing_country || "Deutschland");
      setIsInitialized(true);
    }
  }, [order, isInitialized]);

  // Live-Berechnung
  const itemsSubtotal = itemsState.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
  const grandTotal = itemsSubtotal + (isPickup ? 0 : deliveryCost) + minimumOrderSurcharge;

  const handleSave = useCallback(() => {
    if (!id) return;

    updateMutation.mutate({
      resource: "orders",
      id,
      values: {
        internal_notes: internalNotes,
        status,
        items: itemsState,
        desired_date: desiredDate || null,
        desired_time: desiredTime || null,
        is_pickup: isPickup,
        delivery_street: isPickup ? null : (deliveryStreet || null),
        delivery_zip: isPickup ? null : (deliveryZip || null),
        delivery_city: isPickup ? null : (deliveryCity || null),
        delivery_floor: isPickup ? null : (deliveryFloor || null),
        has_elevator: isPickup ? false : hasElevator,
        delivery_cost: isPickup ? 0 : deliveryCost,
        minimum_order_surcharge: minimumOrderSurcharge,
        total_amount: grandTotal,
        billing_name: billingName || null,
        billing_street: billingStreet || null,
        billing_zip: billingZip || null,
        billing_city: billingCity || null,
        billing_country: billingCountry || null,
      },
    }, {
      onSuccess: () => {
        toast.success("Änderungen gespeichert");
        orderQuery.query.refetch();
      },
      onError: () => toast.error("Fehler beim Speichern"),
    });
  }, [id, updateMutation, internalNotes, status, itemsState, desiredDate, desiredTime, isPickup, deliveryStreet, deliveryZip, deliveryCity, deliveryFloor, hasElevator, deliveryCost, minimumOrderSurcharge, grandTotal, billingName, billingStreet, billingZip, billingCity, billingCountry, orderQuery.query]);

  const recalcDelivery = useCallback(async () => {
    if (isPickup || !deliveryStreet || !deliveryZip || !deliveryCity) {
      toast.error("Bitte Lieferadresse vollständig ausfüllen");
      return;
    }
    setIsRecalcDelivery(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-delivery", {
        body: {
          address: `${deliveryStreet}, ${deliveryZip} ${deliveryCity}`,
          isPizzaOnly: false,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const gross = Number(data?.deliveryCostGross ?? 0);
      const minimumOrder = Number(data?.minimumOrder ?? 0);
      setDeliveryCost(gross);
      // Mindestbestellwert-Aufschlag: nur falls aktuelle Speisensumme unter minimumOrder
      const surcharge = Math.max(0, minimumOrder - itemsSubtotal);
      setMinimumOrderSurcharge(surcharge);
      const dist = data?.distanceKm ? ` · ${data.distanceKm.toFixed(1)} km` : "";
      const surMsg = surcharge > 0
        ? ` · Mindestbestellwert ${minimumOrder} € → Aufschlag ${surcharge.toFixed(2)} €`
        : "";
      toast.success(`Liefergebühr: ${gross.toFixed(2)} €${dist}${surMsg}`);
    } catch (e: any) {
      toast.error(e.message || "Liefergebühr-Berechnung fehlgeschlagen");
    } finally {
      setIsRecalcDelivery(false);
    }
  }, [isPickup, deliveryStreet, deliveryZip, deliveryCity, itemsSubtotal]);

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

  const markRefundedManually = async () => {
    if (!id) return;
    setIsMarkingRefunded(true);
    try {
      const { error } = await supabase
        .from("catering_orders" as any)
        .update({ payment_status: "refunded" } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Als zurückerstattet markiert (manuell via Bank/Bar)");
      orderQuery.query.refetch();
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Markieren");
    } finally {
      setIsMarkingRefunded(false);
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
  const isStripePaid = order.payment_method === 'stripe' && order.payment_status === 'paid';
  const isManuallyPaid = order.payment_method && order.payment_method !== 'stripe' && order.payment_status === 'paid';
  const isPaid = isStripePaid || isManuallyPaid;
  const isRefunded = order.payment_status === 'refunded';

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
                          {isStripePaid ? (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <AlertCircle className="h-4 w-4 text-primary" />
                              Die Zahlung wird automatisch über Stripe zurückerstattet.
                            </span>
                          ) : isManuallyPaid ? (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <AlertCircle className="h-4 w-4 text-primary" />
                              Manuelle Zahlung ({order.payment_method}) — bitte Rückerstattung außerhalb des Systems vornehmen und anschließend als „zurückerstattet" markieren.
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
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Bestellte Artikel</span>
                      <div className="flex items-center gap-2">
                        <MenuItemPicker
                          onPick={(pi) => setItemsState(prev => [...prev, pi])}
                          triggerLabel="Aus Katalog"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setItemsState(prev => [...prev, { name: "Neuer Artikel", quantity: 1, price: 0 }])}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Frei
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {itemsState.length === 0 && (
                        <p className="text-sm text-muted-foreground italic py-4 text-center">Noch keine Artikel</p>
                      )}
                      {itemsState.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_70px_90px_auto] gap-2 items-center">
                          <Input
                            value={item.name}
                            onChange={e => setItemsState(prev => prev.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                            placeholder="Artikelname"
                          />
                          <Input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={e => setItemsState(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) || 0 } : it))}
                            className="text-center"
                          />
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              onChange={e => setItemsState(prev => prev.map((it, i) => i === idx ? { ...it, price: Number(e.target.value) || 0 } : it))}
                              className="pr-6 text-right"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setItemsState(prev => prev.filter((_, i) => i !== idx))} className="h-8 w-8">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Separator />
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Zwischensumme</span><span>{itemsSubtotal.toFixed(2).replace('.', ',')} €</span></div>
                        {minimumOrderSurcharge > 0 && (
                          <div className="flex justify-between text-muted-foreground"><span>Mindestbestellwert-Aufschlag</span><span>+{minimumOrderSurcharge.toFixed(2).replace('.', ',')} €</span></div>
                        )}
                        {!isPickup && deliveryCost > 0 && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Lieferkosten{order.calculated_distance_km ? ` (${order.calculated_distance_km.toFixed(1)} km)` : ''}</span><span>+{deliveryCost.toFixed(2).replace('.', ',')} €</span></div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-semibold text-base pt-1"><span>Gesamtsumme (inkl. MwSt.)</span><span className="text-primary">{grandTotal.toFixed(2).replace('.', ',')} €</span></div>
                      </div>
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
                      {isPickup ? (
                        <><Package className="h-4 w-4" /> Abholung</>
                      ) : (
                        <><Truck className="h-4 w-4" /> Lieferung</>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-2">
                      <Label htmlFor="pickup-switch" className="text-sm font-medium cursor-pointer">
                        {isPickup ? 'Abholung' : 'Lieferung'}
                      </Label>
                      <Switch id="pickup-switch" checked={!isPickup} onCheckedChange={v => setIsPickup(!v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Datum</Label>
                        <Input type="date" value={desiredDate} onChange={e => setDesiredDate(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
                        <Input type="time" value={desiredTime} onChange={e => setDesiredTime(e.target.value)} />
                      </div>
                    </div>
                    {!isPickup && (
                      <div className="pt-2 border-t space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Lieferadresse</Label>
                        <Input value={deliveryStreet} onChange={e => setDeliveryStreet(e.target.value)} placeholder="Straße & Hausnummer" />
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                          <Input value={deliveryZip} onChange={e => setDeliveryZip(e.target.value)} placeholder="PLZ" />
                          <Input value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)} placeholder="Stadt" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <Input value={deliveryFloor} onChange={e => setDeliveryFloor(e.target.value)} placeholder="Etage" />
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={hasElevator} onChange={e => setHasElevator(e.target.checked)} />
                            Aufzug
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-end">
                          <div>
                            <Label className="text-xs text-muted-foreground">Liefergebühr (€)</Label>
                            <Input type="number" step="0.01" min="0" value={deliveryCost} onChange={e => setDeliveryCost(Number(e.target.value) || 0)} />
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={recalcDelivery} disabled={isRecalcDelivery}>
                            {isRecalcDelivery ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                            Neu berechnen
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment & Invoice */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Zahlung & Rechnung
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
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
                      {order.stripe_payment_intent_id && (
                        <p className="text-xs text-muted-foreground font-mono">
                          PI: {order.stripe_payment_intent_id.slice(0, 20)}...
                        </p>
                      )}
                      {isPaid && !isRefunded && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={markRefundedManually}
                          disabled={isMarkingRefunded}
                        >
                          {isMarkingRefunded ? (
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-2" />
                          )}
                          {isStripePaid
                            ? "Manuell als zurückerstattet markieren"
                            : "Als zurückerstattet markieren"}
                        </Button>
                      )}
                    </div>

                    {/* Invoice section */}
                    <div className="border-t pt-4 space-y-3">
                      {order.lexoffice_invoice_id ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">
                              {order.lexoffice_document_type === 'invoice' ? 'Rechnung' : 'Angebot'} erstellt
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <InvoicePdfButton
                              lexofficeInvoiceId={order.lexoffice_invoice_id}
                              documentType={order.lexoffice_document_type || 'invoice'}
                              variant="outline"
                              size="sm"
                              label="PDF herunterladen"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://app.lexoffice.de/permalink/${order.lexoffice_invoice_id}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              LexOffice
                            </Button>
                          </div>
                        </>
                      ) : (
                        <CreateInvoiceButton
                          order={order}
                          onSuccess={() => orderQuery.query.refetch()}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Billing Address — editable */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Rechnungsadresse
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {order.lexoffice_invoice_id && (
                      <p className="text-xs flex items-start gap-1.5 text-muted-foreground bg-muted/50 rounded p-2">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        Bereits Rechnung erstellt — Änderungen gelten nur für zukünftige Belege.
                      </p>
                    )}
                    <Input value={billingName} onChange={e => setBillingName(e.target.value)} placeholder="Name / Firma" />
                    <Input value={billingStreet} onChange={e => setBillingStreet(e.target.value)} placeholder="Straße & Hausnummer" />
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <Input value={billingZip} onChange={e => setBillingZip(e.target.value)} placeholder="PLZ" />
                      <Input value={billingCity} onChange={e => setBillingCity(e.target.value)} placeholder="Stadt" />
                    </div>
                    <Input value={billingCountry} onChange={e => setBillingCountry(e.target.value)} placeholder="Land" />
                  </CardContent>
                </Card>

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
