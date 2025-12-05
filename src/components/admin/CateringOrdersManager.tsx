import { useState } from 'react';
import { useCateringOrders, CateringOrder, OrderStatus } from '@/hooks/useCateringOrders';
import CateringOrderDetail from './CateringOrderDetail';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Package, Calendar, ChevronRight, RefreshCw } from 'lucide-react';

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Neu', color: 'bg-amber-500' },
  confirmed: { label: 'Bestätigt', color: 'bg-blue-500' },
  completed: { label: 'Abgeschlossen', color: 'bg-green-500' },
  cancelled: { label: 'Storniert', color: 'bg-gray-400' },
};

const filterOptions: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'pending', label: 'Neu' },
  { value: 'confirmed', label: 'Bestätigt' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'cancelled', label: 'Storniert' },
];

const CateringOrdersManager = () => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<CateringOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: orders, isLoading, refetch } = useCateringOrders(statusFilter);

  const filteredOrders = orders?.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.customer_email.toLowerCase().includes(query) ||
      (order.company_name && order.company_name.toLowerCase().includes(query))
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOrderClick = (order: CateringOrder) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filterleiste */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Bestellnummer, Name, E-Mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Status-Filter */}
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((option) => (
          <Button
            key={option.value}
            variant={statusFilter === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Bestellungsliste */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Laden...</div>
      ) : filteredOrders?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Keine Bestellungen gefunden
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders?.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
            const status = order.status as OrderStatus || 'pending';

            return (
              <button
                key={order.id}
                onClick={() => handleOrderClick(order)}
                className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm">{order.order_number}</span>
                      <Badge 
                        className={`${statusConfig[status]?.color} text-white text-xs`}
                      >
                        {statusConfig[status]?.label || status}
                      </Badge>
                    </div>
                    <p className="font-medium truncate">{order.customer_name}</p>
                    {order.company_name && (
                      <p className="text-sm text-muted-foreground truncate">{order.company_name}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1 flex-shrink-0">
                    <p className="font-bold text-primary">
                      {(order.total_amount || 0).toFixed(2).replace('.', ',')} €
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                      <Package className="h-3 w-3" />
                      {itemCount} {itemCount === 1 ? 'Artikel' : 'Artikel'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {order.created_at && formatDate(order.created_at)}
                  </span>
                  {order.desired_date && (
                    <span>
                      Wunschtermin: {new Date(order.desired_date).toLocaleDateString('de-DE')}
                    </span>
                  )}
                  <span>
                    {order.is_pickup ? 'Abholung' : 'Lieferung'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <CateringOrderDetail
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
};

export default CateringOrdersManager;
