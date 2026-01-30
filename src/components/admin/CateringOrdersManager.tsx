import { useState, useMemo, useRef } from "react";
import { format, isBefore, addDays, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Search, RefreshCw, ChevronDown, ChevronUp, Truck, MapPin, Phone, Mail, Building2, FileText, CreditCard, StickyNote, Package, Printer, XCircle, Download, Loader2, CheckSquare, Square, Receipt, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCateringOrders, useUpdateOrderStatus, useUpdateOrderNotes, useDeleteOrder, OrderStatus, CateringOrder } from "@/hooks/useCateringOrders";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Neu", color: "text-amber-700", bg: "bg-amber-100" },
  confirmed: { label: "Bestätigt", color: "text-blue-700", bg: "bg-blue-100" },
  completed: { label: "Erledigt", color: "text-green-700", bg: "bg-green-100" },
  cancelled: { label: "Storniert", color: "text-muted-foreground", bg: "bg-muted" },
};

const CateringOrdersManager = () => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const { data: orders, isLoading, refetch } = useCateringOrders(statusFilter);
  const updateStatus = useUpdateOrderStatus();
  const updateNotes = useUpdateOrderNotes();
  const deleteOrder = useDeleteOrder();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  // Bulk actions
  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrderIds);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredOrders) {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    } else {
      setSelectedOrderIds(new Set());
    }
  };

  const handleBulkStatusChange = async (newStatus: OrderStatus) => {
    if (selectedOrderIds.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      for (const orderId of selectedOrderIds) {
        await updateStatus.mutateAsync({ orderId, status: newStatus });
      }
      toast({
        title: "Status aktualisiert",
        description: `${selectedOrderIds.size} Bestellung(en) auf "${statusConfig[newStatus].label}" gesetzt.`
      });
      setSelectedOrderIds(new Set());
      refetch();
    } catch (err) {
      toast({
        title: "Fehler",
        description: "Einige Bestellungen konnten nicht aktualisiert werden.",
        variant: "destructive"
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedOrderIds.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      for (const orderId of selectedOrderIds) {
        await deleteOrder.mutateAsync(orderId);
      }
      toast({
        title: "Bestellungen gelöscht",
        description: `${selectedOrderIds.size} Bestellung(en) wurden gelöscht.`
      });
      setSelectedOrderIds(new Set());
      setBulkDeleteDialogOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: "Fehler",
        description: "Einige Bestellungen konnten nicht gelöscht werden.",
        variant: "destructive"
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Helper to get document type display
  const getDocumentTypeBadge = (order: CateringOrder) => {
    const isPaid = order.payment_method === 'stripe' && order.payment_status === 'paid';
    if (isPaid) {
      return (
        <Badge className="bg-green-100 text-green-700 text-xs font-medium">
          <CreditCard className="h-3 w-3 mr-1" />
          BEZAHLT
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
        <Receipt className="h-3 w-3 mr-1" />
        ANGEBOT
      </Badge>
    );
  };

  const formatOrderDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "dd.MM.yy HH:mm", { locale: de });
  };

  const handleCancelOrder = async (orderId: string) => {
    setIsCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Nicht angemeldet");
      }

      const { data, error } = await supabase.functions.invoke('cancel-catering-order', {
        body: { orderId, reason: cancelReason }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Bestellung storniert",
        description: `${data.stripeRefunded ? "Stripe-Rückerstattung erstellt. " : ""}${data.lexofficeCreditNote ? "LexOffice-Gutschrift erstellt." : ""}`,
      });

      setCancelDialogOpen(false);
      setCancelReason("");
      setCancellingOrderId(null);
      refetch();
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Stornierung fehlgeschlagen",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDownloadDocument = async (order: CateringOrder) => {
    if (!order.lexoffice_invoice_id) {
      toast({ title: "Kein Dokument vorhanden", variant: "destructive" });
      return;
    }
    
    setDownloadingDocId(order.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Nicht angemeldet");

      const { data, error } = await supabase.functions.invoke('get-lexoffice-document', {
        body: { orderId: order.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Download base64 PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.pdfBase64}`;
      link.download = data.filename || `${order.order_number}.pdf`;
      link.click();
    } catch (err) {
      toast({
        title: "Download fehlgeschlagen",
        description: err instanceof Error ? err.message : "Fehler beim Laden des Dokuments",
        variant: "destructive"
      });
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handlePrint = (order: CateringOrder) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const printContent = `
      <html>
        <head>
          <title>Bestellung ${order.order_number}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 16px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            .meta { color: #666; font-size: 14px; margin-bottom: 16px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .section { margin-bottom: 16px; }
            .label { font-weight: 600; font-size: 12px; color: #666; }
            .value { font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; font-size: 14px; }
            th { font-weight: 600; }
            .total { font-weight: 700; font-size: 16px; }
            .notes { background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 14px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Bestellung ${order.order_number}</h1>
          <div class="meta">
            Erstellt: ${order.created_at ? format(parseISO(order.created_at), "dd.MM.yyyy HH:mm", { locale: de }) : "-"}
          </div>
          
          <div class="grid">
            <div class="section">
              <h2>Liefertermin</h2>
              <div class="label">Datum</div>
              <div class="value">${order.desired_date ? format(parseISO(order.desired_date), "EEEE, dd. MMMM yyyy", { locale: de }) : "-"}</div>
              <div class="label" style="margin-top:8px">Uhrzeit</div>
              <div class="value">${order.desired_time || "-"}</div>
              <div class="label" style="margin-top:8px">Art</div>
              <div class="value">${order.is_pickup ? "Abholung im Restaurant" : "Lieferung"}</div>
            </div>
            
            <div class="section">
              <h2>Kunde</h2>
              <div class="value">${order.customer_name}</div>
              ${order.company_name ? `<div class="value">${order.company_name}</div>` : ""}
              <div class="value">${order.customer_email}</div>
              <div class="value">${order.customer_phone}</div>
            </div>
          </div>
          
          ${!order.is_pickup && order.delivery_street ? `
            <h2>Lieferadresse</h2>
            <div class="value">${order.delivery_street}</div>
            <div class="value">${order.delivery_zip} ${order.delivery_city}</div>
            ${order.delivery_floor ? `<div class="value">Etage: ${order.delivery_floor}</div>` : ""}
            ${order.has_elevator !== null ? `<div class="value">Aufzug: ${order.has_elevator ? "Ja" : "Nein"}</div>` : ""}
          ` : ""}
          
          <h2>Bestellpositionen</h2>
          <table>
            <thead>
              <tr><th>Artikel</th><th>Menge</th><th style="text-align:right">Preis</th></tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td style="text-align:right">${(item.price * item.quantity).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                </tr>
              `).join('')}
              ${order.delivery_cost && order.delivery_cost > 0 ? `
                <tr>
                  <td>Lieferung</td>
                  <td></td>
                  <td style="text-align:right">${order.delivery_cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                </tr>
              ` : ""}
              <tr>
                <td colspan="2" class="total">Gesamt</td>
                <td style="text-align:right" class="total">${order.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
              </tr>
            </tbody>
          </table>
          
          ${order.notes ? `
            <h2>Kundenanmerkung</h2>
            <div class="notes">${order.notes}</div>
          ` : ""}
          
          ${order.internal_notes ? `
            <h2>Interne Notizen</h2>
            <div class="notes">${order.internal_notes}</div>
          ` : ""}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

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

      {/* Bulk Action Bar */}
      {selectedOrderIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Checkbox
            checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
          />
          <span className="text-sm font-medium">
            {selectedOrderIds.size} Bestellung(en) ausgewählt
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Select 
              onValueChange={(value) => {
                if (value === 'delete') {
                  setBulkDeleteDialogOpen(true);
                } else {
                  handleBulkStatusChange(value as OrderStatus);
                }
              }} 
              disabled={isBulkUpdating}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Status ändern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Neu</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="completed">Erledigt</SelectItem>
                <SelectItem value="delete" className="text-destructive focus:text-destructive">
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-3 w-3" />
                    Löschen
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusChange('completed')}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Als erledigt markieren"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedOrderIds(new Set())}
            >
              Abwählen
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellungen endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedOrderIds.size} Bestellung(en) werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkUpdating}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              disabled={isBulkUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
                <div className="flex">
                  {/* Checkbox */}
                  <div 
                    className="flex items-center justify-center px-3 border-r border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedOrderIds.has(order.id)}
                      onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                    />
                  </div>
                  
                  <button
                    onClick={() => handleExpandOrder(order.id, order.internal_notes)}
                    className="flex-1 p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Status Badge */}
                      <Badge className={cn("font-medium", status.bg, status.color)}>
                        {status.label}
                      </Badge>
                      
                      {/* Delivery Date & Time */}
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
                    
                    {/* Document Type + Order Date Row */}
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      {getDocumentTypeBadge(order)}
                      <span className="text-xs text-muted-foreground">
                        Bestellt: {formatOrderDate(order.created_at)}
                      </span>
                      
                      {/* Urgent/Overdue Badges */}
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
                  </button>
                </div>
                
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
                    <div className="pt-3 border-t flex flex-wrap items-center gap-3">
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
                    
                    {/* Action Buttons */}
                    <div className="pt-3 border-t flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrint(order)}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Drucken
                      </Button>
                      
                      {order.lexoffice_invoice_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadDocument(order)}
                          disabled={downloadingDocId === order.id}
                        >
                          {downloadingDocId === order.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          {order.lexoffice_document_type === 'invoice' ? 'Rechnung' : 'Angebot'} PDF
                        </Button>
                      )}
                      
                      {order.status !== 'cancelled' && (
                        <AlertDialog open={cancelDialogOpen && cancellingOrderId === order.id} onOpenChange={(open) => {
                          setCancelDialogOpen(open);
                          if (!open) {
                            setCancellingOrderId(null);
                            setCancelReason("");
                          }
                        }}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setCancellingOrderId(order.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Stornieren
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Bestellung stornieren?</AlertDialogTitle>
                              <AlertDialogDescription className="space-y-2">
                                <p>
                                  Bestellung <strong>{order.order_number}</strong> wirklich stornieren?
                                </p>
                                {order.payment_method === 'stripe' && order.payment_status === 'paid' && (
                                  <p className="text-amber-600 font-medium">
                                    ⚠️ Der Stripe-Betrag von {order.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} wird automatisch zurückerstattet.
                                  </p>
                                )}
                                {order.lexoffice_invoice_id && order.lexoffice_document_type === 'invoice' && (
                                  <p className="text-amber-600 font-medium">
                                    ⚠️ Eine LexOffice-Gutschrift wird automatisch erstellt.
                                  </p>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="py-2">
                              <label className="text-sm font-medium">Stornierungsgrund (optional)</label>
                              <Textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="z.B. Kunde hat abgesagt..."
                                className="mt-1"
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelOrder(order.id)}
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
                      
                      {order.status === 'cancelled' && order.cancellation_reason && (
                        <div className="text-sm text-muted-foreground">
                          Stornierungsgrund: {order.cancellation_reason}
                        </div>
                      )}
                      
                      {/* Delete Button - only for admins */}
                      <AlertDialog open={deleteDialogOpen && deletingOrderId === order.id} onOpenChange={(open) => {
                        setDeleteDialogOpen(open);
                        if (!open) setDeletingOrderId(null);
                      }}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                            onClick={() => setDeletingOrderId(order.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Bestellung endgültig löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bestellung <strong>{order.order_number}</strong> wird unwiderruflich gelöscht. 
                              Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteOrder.mutate(order.id, {
                                  onSuccess: () => {
                                    toast({
                                      title: "Bestellung gelöscht",
                                      description: `${order.order_number} wurde entfernt.`
                                    });
                                    setDeleteDialogOpen(false);
                                    setDeletingOrderId(null);
                                    refetch();
                                  },
                                  onError: (err) => {
                                    toast({
                                      title: "Fehler",
                                      description: err instanceof Error ? err.message : "Löschen fehlgeschlagen",
                                      variant: "destructive"
                                    });
                                  }
                                });
                              }}
                              disabled={deleteOrder.isPending}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleteOrder.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Wird gelöscht...
                                </>
                              ) : (
                                "Endgültig löschen"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
