import { useState, useMemo } from "react";
import { format, isBefore, addDays, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Search, RefreshCw, ChevronDown, ChevronUp, Truck, MapPin, Phone, Mail, Building2, FileText, CreditCard, StickyNote, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCateringOrders, useUpdateOrderStatus, useUpdateOrderNotes, OrderStatus } from "@/hooks/useCateringOrders";
import { cn } from "@/lib/utils";

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Neu", color: "text-amber-700", bg: "bg-amber-100" },
  confirmed: { label: "Bestätigt", color: "text-blue-700", bg: "bg-blue-100" },
  completed: { label: "Erledigt", color: "text-green-700", bg: "bg-green-100" },
  cancelled: { label: "Storniert", color: "text-red-700", bg: "bg-red-100" },
};

const CateringOrdersManager = () => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  
  const { data: orders, isLoading, refetch } = useCateringOrders(statusFilter);
  const updateStatus = useUpdateOrderStatus();
  const updateNotes = useUpdateOrderNotes();

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    let filtered = orders;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.order_number.toLowerCase().includes(query) ||
        order.customer_name.toLowerCase().includes(query) ||
        order.customer_email.toLowerCase().includes(query) ||
        order.company_name?.toLowerCase().includes(query)
      );
    }
    
    // Sort by desired date (closest first)
    return [...filtered].sort((a, b) => {
      const dateA = a.desired_date ? new Date(a.desired_date).getTime() : Infinity;
      const dateB = b.desired_date ? new Date(b.desired_date).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [orders, searchQuery]);

  const isUrgent = (order: typeof orders[0]) => {
    if (!order.desired_date || order.status !== 'pending') return false;
    const desiredDate = parseISO(order.desired_date);
    return isBefore(desiredDate, addDays(new Date(), 1));
  };

  const isOverdue = (order: typeof orders[0]) => {
    if (!order.desired_date || order.status === 'completed' || order.status === 'cancelled') return false;
    return isBefore(parseISO(order.desired_date), new Date());
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "EEE, dd.MM.yy", { locale: de });
  };

  const handleExpandOrder = (orderId: string, notes: string | null) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
      setEditingNotes(notes || "");
    }
  };

  const handleSaveNotes = (orderId: string) => {
    updateNotes.mutate({ orderId, internalNotes: editingNotes });
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    updateStatus.mutate({ orderId, status: newStatus });
  };

  const statusTabs: { value: OrderStatus | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'Alle', count: orders?.length || 0 },
    { value: 'pending', label: 'Neu', count: orders?.filter(o => o.status === 'pending').length || 0 },
    { value: 'confirmed', label: 'Bestätigt', count: orders?.filter(o => o.status === 'confirmed').length || 0 },
    { value: 'completed', label: 'Erledigt', count: orders?.filter(o => o.status === 'completed').length || 0 },
    { value: 'cancelled', label: 'Storniert', count: orders?.filter(o => o.status === 'cancelled').length || 0 },
  ];

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Lade Bestellungen...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search & Refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, E-Mail, Firma..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap",
              statusFilter === tab.value
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "ml-1.5 text-xs",
                statusFilter === tab.value ? "text-primary" : "text-muted-foreground"
              )}>
                ({tab.count})
              </span>
            )}
            {statusFilter === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-2">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Keine Bestellungen gefunden
          </div>
        ) : (
          filteredOrders.map((order) => {
            const status = statusConfig[order.status as OrderStatus] || statusConfig.pending;
            const urgent = isUrgent(order);
            const overdue = isOverdue(order);
            const isExpanded = expandedOrderId === order.id;
            const items = Array.isArray(order.items) ? order.items : [];
            
            return (
              <div
                key={order.id}
                className={cn(
                  "border rounded-lg overflow-hidden transition-all",
                  overdue && "border-destructive/50 bg-destructive/5",
                  urgent && !overdue && "border-amber-500/50 bg-amber-50/50",
                  !urgent && !overdue && "border-border bg-card"
                )}
              >
                {/* Order Row - Clickable */}
                <button
                  onClick={() => handleExpandOrder(order.id, order.internal_notes)}
                  className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Status Badge */}
                    <Badge className={cn("font-medium", status.bg, status.color)}>
                      {status.label}
                    </Badge>
                    
                    {/* Date & Time */}
                    <div className="min-w-[120px]">
                      <div className="font-medium text-sm">
                        {formatDate(order.desired_date)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.desired_time || "-"}
                      </div>
                    </div>
                    
                    {/* Customer */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {order.customer_name}
                      </div>
                      {order.company_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {order.company_name}
                        </div>
                      )}
                    </div>
                    
                    {/* Delivery Type */}
                    <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
                      {order.is_pickup ? (
                        <>
                          <MapPin className="h-4 w-4" />
                          <span>Abholung</span>
                        </>
                      ) : (
                        <>
                          <Truck className="h-4 w-4" />
                          <span>Lieferung</span>
                        </>
                      )}
                    </div>
                    
                    {/* Amount */}
                    <div className="text-right min-w-[80px]">
                      <div className="font-semibold">
                        {order.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </div>
                    </div>
                    
                    {/* Expand Icon */}
                    <div className="text-muted-foreground">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                  
                  {/* Urgent/Overdue Badges */}
                  {(urgent || overdue || order.internal_notes) && (
                    <div className="mt-2 flex gap-2">
                      {overdue && (
                        <Badge variant="destructive" className="text-xs">
                          Überfällig
                        </Badge>
                      )}
                      {urgent && !overdue && (
                        <Badge className="text-xs bg-amber-500 text-white">
                          Dringend
                        </Badge>
                      )}
                      {order.internal_notes && (
                        <Badge variant="outline" className="text-xs">
                          <StickyNote className="h-3 w-3 mr-1" />
                          Notiz
                        </Badge>
                      )}
                    </div>
                  )}
                </button>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column - Contact & Delivery */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Phone className="h-4 w-4" /> Kontakt
                        </h4>
                        <div className="text-sm space-y-1 pl-6">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <a href={`mailto:${order.customer_email}`} className="hover:underline">
                              {order.customer_email}
                            </a>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <a href={`tel:${order.customer_phone}`} className="hover:underline">
                              {order.customer_phone}
                            </a>
                          </div>
                          {order.company_name && (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {order.company_name}
                            </div>
                          )}
                        </div>
                        
                        {!order.is_pickup && order.delivery_street && (
                          <>
                            <h4 className="font-medium text-sm flex items-center gap-2 mt-4">
                              <Truck className="h-4 w-4" /> Lieferadresse
                            </h4>
                            <div className="text-sm pl-6 text-muted-foreground">
                              {order.delivery_street}<br />
                              {order.delivery_zip} {order.delivery_city}
                              {order.delivery_floor && <><br />Etage: {order.delivery_floor}</>}
                              {order.has_elevator !== null && (
                                <><br />Aufzug: {order.has_elevator ? 'Ja' : 'Nein'}</>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Right Column - Order Details */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Package className="h-4 w-4" /> Bestellung
                        </h4>
                        <div className="text-sm pl-6 space-y-1">
                          <div className="text-xs text-muted-foreground mb-2">
                            {order.order_number}
                          </div>
                          {items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between">
                              <span>{item.quantity}× {item.name}</span>
                              <span className="text-muted-foreground">
                                {(item.price * item.quantity).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                              </span>
                            </div>
                          ))}
                          {order.delivery_cost && order.delivery_cost > 0 && (
                            <div className="flex justify-between pt-1 border-t">
                              <span>Lieferung</span>
                              <span className="text-muted-foreground">
                                {order.delivery_cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Payment Info */}
                        <div className="flex items-center gap-2 pl-6 text-sm">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {order.payment_method === 'stripe' ? 'Stripe' : 'Rechnung'}
                            {order.payment_status === 'paid' && (
                              <Badge className="ml-2 bg-green-100 text-green-700 text-xs">Bezahlt</Badge>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Customer Notes */}
                    {order.notes && (
                      <div className="pt-3 border-t">
                        <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4" /> Kundenanmerkung
                        </h4>
                        <p className="text-sm text-muted-foreground bg-background p-3 rounded">
                          {order.notes}
                        </p>
                      </div>
                    )}
                    
                    {/* Internal Notes */}
                    <div className="pt-3 border-t">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                        <StickyNote className="h-4 w-4" /> Interne Notizen
                      </h4>
                      <Textarea
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        placeholder="Notizen für das Team..."
                        className="min-h-[80px] bg-background"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveNotes(order.id)}
                        disabled={updateNotes.isPending}
                        className="mt-2"
                      >
                        {updateNotes.isPending ? "Speichern..." : "Notiz speichern"}
                      </Button>
                    </div>
                    
                    {/* Status Change */}
                    <div className="pt-3 border-t flex items-center gap-3">
                      <span className="text-sm font-medium">Status ändern:</span>
                      <Select
                        value={order.status || 'pending'}
                        onValueChange={(value) => handleStatusChange(order.id, value as OrderStatus)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Neu</SelectItem>
                          <SelectItem value="confirmed">Bestätigt</SelectItem>
                          <SelectItem value="completed">Erledigt</SelectItem>
                          <SelectItem value="cancelled">Storniert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CateringOrdersManager;
