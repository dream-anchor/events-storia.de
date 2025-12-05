import { CateringOrder, OrderStatus, useUpdateOrderStatus } from '@/hooks/useCateringOrders';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Phone, Mail, Building2, MapPin, Calendar, Clock, FileText, Ruler, Receipt, User, CreditCard, BadgeCheck } from 'lucide-react';

interface CateringOrderDetailProps {
  order: CateringOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Neu', variant: 'default' },
  confirmed: { label: 'Bestätigt', variant: 'secondary' },
  completed: { label: 'Abgeschlossen', variant: 'outline' },
  cancelled: { label: 'Storniert', variant: 'destructive' },
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const CateringOrderDetail = ({ order, open, onOpenChange }: CateringOrderDetailProps) => {
  const updateStatusMutation = useUpdateOrderStatus();

  if (!order) return null;

  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      await updateStatusMutation.mutateAsync({ orderId: order.id, status: newStatus });
      toast.success('Status aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const items = Array.isArray(order.items) ? order.items : [];

  // Payment method display
  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case 'stripe': return 'Sofortzahlung (Stripe)';
      case 'invoice': return 'Rechnung';
      default: return method || 'Rechnung';
    }
  };

  // Payment status display
  const getPaymentStatusConfig = (status: string | null) => {
    switch (status) {
      case 'paid': return { label: 'Bezahlt', variant: 'default' as const, className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
      case 'pending': return { label: 'Ausstehend', variant: 'secondary' as const, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
      case 'failed': return { label: 'Fehlgeschlagen', variant: 'destructive' as const, className: '' };
      default: return { label: status || 'Ausstehend', variant: 'secondary' as const, className: '' };
    }
  };

  const paymentStatusConfig = getPaymentStatusConfig(order.payment_status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center justify-between">
            <span className="font-mono">{order.order_number}</span>
            <Badge variant={statusConfig[order.status as OrderStatus]?.variant || 'default'}>
              {statusConfig[order.status as OrderStatus]?.label || order.status}
            </Badge>
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {order.created_at && formatDateTime(order.created_at)}
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status ändern */}
          <div>
            <label className="text-sm font-medium mb-2 block">Status ändern</label>
            <Select value={order.status || 'pending'} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Neu</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bestellinfo (Customer type & Payment) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Bestellinfo
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              {/* Kundentyp */}
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Kundentyp:</span>
                {order.user_id ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                    <BadgeCheck className="h-3 w-3 mr-1" />
                    Registrierter Kunde
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Gast
                  </Badge>
                )}
              </div>
              
              {/* Zahlungsmethode */}
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Zahlung:</span>
                <span className="font-medium">{getPaymentMethodLabel(order.payment_method)}</span>
              </div>
              
              {/* Zahlungsstatus */}
              <div className="flex items-center gap-2 text-sm">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={paymentStatusConfig.variant} className={paymentStatusConfig.className}>
                  {paymentStatusConfig.label}
                </Badge>
              </div>
              
              {/* LexOffice Dokument */}
              {order.lexoffice_document_type && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">LexOffice:</span>
                  <span className="font-medium">
                    {order.lexoffice_document_type === 'invoice' ? 'Rechnung' : 'Angebot'}
                    {order.lexoffice_invoice_id && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (ID: {order.lexoffice_invoice_id.slice(0, 8)}...)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Kundendaten */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Kundendaten
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
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
            </div>
          </div>

          {/* Lieferdetails */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Lieferdetails
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium">
                {order.is_pickup ? '🚗 Selbstabholung' : '🚚 Lieferung'}
              </p>
              {order.delivery_address && (
                <p className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {order.delivery_address}
                </p>
              )}
              {order.calculated_distance_km != null && order.calculated_distance_km > 0 && (
                <p className="flex items-center gap-2 text-sm">
                  <Ruler className="h-4 w-4" />
                  Entfernung: {order.calculated_distance_km.toFixed(1).replace('.', ',')} km
                </p>
              )}
              {order.desired_date && (
                <p className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {formatDate(order.desired_date)}
                </p>
              )}
              {order.desired_time && (
                <p className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  {order.desired_time} Uhr
                </p>
              )}
            </div>
          </div>

          {/* Rechnungsadresse */}
          {order.billing_name && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Rechnungsadresse
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Receipt className="h-4 w-4" />
                  {order.billing_name}
                </p>
                {order.billing_street && (
                  <p className="text-sm text-muted-foreground pl-6">{order.billing_street}</p>
                )}
                {(order.billing_zip || order.billing_city) && (
                  <p className="text-sm text-muted-foreground pl-6">
                    {order.billing_zip} {order.billing_city}
                  </p>
                )}
                {order.billing_country && order.billing_country !== 'Deutschland' && (
                  <p className="text-sm text-muted-foreground pl-6">{order.billing_country}</p>
                )}
              </div>
            </div>
          )}

          {/* Bestellte Artikel & Preisübersicht */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Bestellte Artikel
            </h3>
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
                  {/* Zwischensumme */}
                  <tr className="border-t">
                    <td className="p-3" colSpan={2}>Zwischensumme</td>
                    <td className="p-3 text-right">
                      {items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0).toFixed(2).replace('.', ',')} €
                    </td>
                  </tr>
                  {/* Mindestbestellwert-Aufschlag */}
                  {order.minimum_order_surcharge != null && order.minimum_order_surcharge > 0 && (
                    <tr className="border-t text-amber-600 dark:text-amber-400">
                      <td className="p-3" colSpan={2}>Mindestbestellwert-Aufschlag</td>
                      <td className="p-3 text-right">
                        +{order.minimum_order_surcharge.toFixed(2).replace('.', ',')} €
                      </td>
                    </tr>
                  )}
                  {/* Lieferkosten */}
                  {order.delivery_cost != null && order.delivery_cost > 0 && (
                    <tr className="border-t">
                      <td className="p-3" colSpan={2}>
                        Lieferkosten
                        {order.calculated_distance_km != null && order.calculated_distance_km > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({order.calculated_distance_km.toFixed(1).replace('.', ',')} km)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        +{order.delivery_cost.toFixed(2).replace('.', ',')} €
                      </td>
                    </tr>
                  )}
                  {/* Gesamtsumme */}
                  <tr className="border-t-2 border-primary/30 font-semibold bg-muted">
                    <td className="p-3" colSpan={2}>Gesamtsumme</td>
                    <td className="p-3 text-right text-primary text-base">
                      {(order.total_amount || 0).toFixed(2).replace('.', ',')} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Anmerkungen */}
          {order.notes && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Anmerkungen
              </h3>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  {order.notes}
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CateringOrderDetail;