import { useState, useMemo } from 'react';
import { useCateringOrders, CateringOrder, OrderStatus } from '@/hooks/useCateringOrders';
import CateringOrderDetail from './CateringOrderDetail';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, RefreshCw, Eye, LayoutGrid, LayoutList, StickyNote, AlertCircle, Clock } from 'lucide-react';

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Neu', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  confirmed: { label: 'Bestätigt', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  completed: { label: 'Erledigt', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  cancelled: { label: 'Storniert', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
};

const filterOptions: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'pending', label: 'Neu' },
  { value: 'confirmed', label: 'Bestätigt' },
  { value: 'completed', label: 'Erledigt' },
  { value: 'cancelled', label: 'Storniert' },
];

type SortField = 'desired_date' | 'created_at' | 'total_amount';

const CateringOrdersManager = () => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<CateringOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortField, setSortField] = useState<SortField>('desired_date');

  const { data: orders, isLoading, refetch } = useCateringOrders(statusFilter);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    let result = orders.filter(order => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        order.order_number.toLowerCase().includes(query) ||
        order.customer_name.toLowerCase().includes(query) ||
        order.customer_email.toLowerCase().includes(query) ||
        (order.company_name && order.company_name.toLowerCase().includes(query))
      );
    });

    // Sort by selected field
    result.sort((a, b) => {
      if (sortField === 'desired_date') {
        const dateA = a.desired_date ? new Date(a.desired_date).getTime() : Infinity;
        const dateB = b.desired_date ? new Date(b.desired_date).getTime() : Infinity;
        return dateA - dateB; // Nearest first
      } else if (sortField === 'created_at') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Newest first
      } else if (sortField === 'total_amount') {
        return (b.total_amount || 0) - (a.total_amount || 0); // Highest first
      }
      return 0;
    });

    return result;
  }, [orders, searchQuery, sortField]);

  const formatDesiredDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orderDate = new Date(dateStr);
    orderDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((orderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
    const dateFormatted = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    
    return { weekday, dateFormatted, diffDays };
  };

  const formatCreatedAt = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOrderClick = (order: CateringOrder) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const isUrgent = (order: CateringOrder) => {
    if (!order.desired_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orderDate = new Date(order.desired_date);
    orderDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((orderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 1 && order.status === 'pending';
  };

  const isOverdue = (order: CateringOrder) => {
    if (!order.desired_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orderDate = new Date(order.desired_date);
    orderDate.setHours(0, 0, 0, 0);
    return orderDate < today && order.status !== 'completed' && order.status !== 'cancelled';
  };

  return (
    <div className="space-y-4">
      {/* Filterleiste */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Bestellnr., Name, E-Mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
            title="Tabellenansicht"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('cards')}
            title="Kartenansicht"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status-Filter & Sortierung */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
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
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sortieren:</span>
          <Button
            variant={sortField === 'desired_date' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortField('desired_date')}
          >
            Wunschtermin
          </Button>
          <Button
            variant={sortField === 'created_at' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortField('created_at')}
          >
            Bestelldatum
          </Button>
          <Button
            variant={sortField === 'total_amount' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortField('total_amount')}
          >
            Betrag
          </Button>
        </div>
      </div>

      {/* Bestellungsliste */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Laden...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Keine Bestellungen gefunden
        </div>
      ) : viewMode === 'table' ? (
        // Tabellenansicht
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Bestellnr.</TableHead>
                <TableHead>Wunschtermin</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead className="w-[100px]">Lieferart</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const status = order.status as OrderStatus || 'pending';
                const dateInfo = formatDesiredDate(order.desired_date);
                const urgent = isUrgent(order);
                const overdue = isOverdue(order);

                return (
                  <TableRow 
                    key={order.id}
                    className={`cursor-pointer hover:bg-muted/50 ${overdue ? 'bg-red-50 dark:bg-red-950/20' : urgent ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
                    onClick={() => handleOrderClick(order)}
                  >
                    <TableCell>
                      <Badge className={`${statusConfig[status]?.bgColor} ${statusConfig[status]?.color} border-0`}>
                        {statusConfig[status]?.label || status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{order.order_number.slice(-12)}</span>
                        {order.internal_notes && (
                          <span title="Hat interne Notizen">
                            <StickyNote className="h-3 w-3 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {typeof dateInfo === 'object' ? (
                        <div className="flex items-center gap-2">
                          {overdue && <AlertCircle className="h-4 w-4 text-destructive" />}
                          {urgent && !overdue && <Clock className="h-4 w-4 text-amber-500" />}
                          <div>
                            <span className="font-medium">{dateInfo.weekday}</span>
                            <span className="text-muted-foreground ml-1">{dateInfo.dateFormatted}</span>
                            {order.desired_time && (
                              <span className="text-muted-foreground ml-1">{order.desired_time}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{dateInfo}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium truncate max-w-[200px]">{order.customer_name}</p>
                        {order.company_name && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{order.company_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {(order.total_amount || 0).toFixed(2).replace('.', ',')} €
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {order.is_pickup ? '🚗 Abholung' : '🚚 Lieferung'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        // Kartenansicht (existierende Ansicht)
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
            const status = order.status as OrderStatus || 'pending';
            const dateInfo = formatDesiredDate(order.desired_date);
            const urgent = isUrgent(order);
            const overdue = isOverdue(order);

            return (
              <button
                key={order.id}
                onClick={() => handleOrderClick(order)}
                className={`w-full text-left bg-card border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm transition-all group ${
                  overdue ? 'border-destructive/50 bg-red-50 dark:bg-red-950/20' : 
                  urgent ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' : 
                  'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium text-sm">{order.order_number.slice(-12)}</span>
                      <Badge className={`${statusConfig[status]?.bgColor} ${statusConfig[status]?.color} border-0`}>
                        {statusConfig[status]?.label || status}
                      </Badge>
                      {order.internal_notes && (
                        <span title="Hat interne Notizen">
                          <StickyNote className="h-4 w-4 text-amber-500" />
                        </span>
                      )}
                      {overdue && (
                        <Badge variant="destructive" className="text-xs">Überfällig</Badge>
                      )}
                      {urgent && !overdue && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
                          Dringend
                        </Badge>
                      )}
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
                    <p className="text-xs text-muted-foreground">
                      {itemCount} Artikel
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex-wrap">
                  {typeof dateInfo === 'object' && (
                    <span className="font-medium text-foreground">
                      📅 {dateInfo.weekday} {dateInfo.dateFormatted}
                      {order.desired_time && ` ${order.desired_time}`}
                    </span>
                  )}
                  <span>{order.is_pickup ? '🚗 Abholung' : '🚚 Lieferung'}</span>
                  <span>Bestellt: {formatCreatedAt(order.created_at)}</span>
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