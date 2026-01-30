import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { InboxItem, InboxFilter, EntityType } from '@/components/admin/inbox/types';

// Transform event_inquiries to InboxItem
const transformInquiry = (inquiry: Record<string, unknown>): InboxItem => ({
  id: inquiry.id as string,
  entityType: 'event_inquiry',
  title: inquiry.company_name 
    ? `${inquiry.company_name}` 
    : (inquiry.contact_name as string),
  subtitle: inquiry.event_type 
    ? `${inquiry.event_type} • ${inquiry.guest_count || '?'} Gäste` 
    : 'Event-Anfrage',
  status: (inquiry.status as string) === 'new' ? 'new' : 
          (inquiry.status as string) === 'in_progress' ? 'in_progress' :
          (inquiry.status as string) === 'offer_sent' ? 'offer_sent' :
          (inquiry.status as string) === 'confirmed' ? 'confirmed' :
          (inquiry.status as string) === 'cancelled' ? 'cancelled' : 'in_progress',
  date: inquiry.preferred_date as string || '',
  customerName: inquiry.contact_name as string,
  customerEmail: inquiry.email as string,
  companyName: inquiry.company_name as string | undefined,
  isNew: (inquiry.status as string) === 'new',
  createdAt: inquiry.created_at as string,
  updatedAt: inquiry.updated_at as string | undefined,
  raw: inquiry,
});

// Transform catering_orders to InboxItem
const transformOrder = (order: Record<string, unknown>): InboxItem => ({
  id: order.id as string,
  entityType: 'catering_order',
  title: order.company_name 
    ? `${order.company_name}` 
    : (order.customer_name as string),
  subtitle: `${order.order_number} • ${formatCurrency(order.total_amount as number)}`,
  status: (order.status as string) === 'pending' ? 'new' :
          (order.status as string) === 'confirmed' ? 'confirmed' :
          (order.status as string) === 'ready' ? 'ready' :
          (order.status as string) === 'completed' ? 'completed' :
          (order.status as string) === 'cancelled' ? 'cancelled' : 'in_progress',
  date: order.desired_date as string || '',
  amount: order.total_amount as number,
  customerName: order.customer_name as string,
  customerEmail: order.customer_email as string,
  companyName: order.company_name as string | undefined,
  isNew: (order.status as string) === 'pending',
  createdAt: order.created_at as string,
  raw: order,
});

// Transform event_bookings to InboxItem
const transformBooking = (booking: Record<string, unknown>): InboxItem => ({
  id: booking.id as string,
  entityType: 'event_booking',
  title: booking.company_name 
    ? `${booking.company_name}` 
    : (booking.customer_name as string),
  subtitle: `${booking.booking_number} • ${booking.guest_count} Gäste`,
  status: (booking.status as string) === 'menu_pending' ? 'in_progress' :
          (booking.status as string) === 'menu_confirmed' ? 'confirmed' :
          (booking.status as string) === 'confirmed' ? 'confirmed' :
          (booking.status as string) === 'completed' ? 'completed' :
          (booking.status as string) === 'cancelled' ? 'cancelled' : 'in_progress',
  date: booking.event_date as string || '',
  amount: booking.total_amount as number,
  customerName: booking.customer_name as string,
  customerEmail: booking.customer_email as string,
  companyName: booking.company_name as string | undefined,
  isNew: (booking.status as string) === 'menu_pending',
  createdAt: booking.created_at as string,
  updatedAt: booking.updated_at as string | undefined,
  raw: booking,
});

const formatCurrency = (amount: number | undefined): string => {
  if (!amount) return '€0';
  return new Intl.NumberFormat('de-DE', { 
    style: 'currency', 
    currency: 'EUR' 
  }).format(amount);
};

// Sort by urgency: new first, then by date
const sortByUrgency = (items: InboxItem[]): InboxItem[] => {
  return items.sort((a, b) => {
    // New items first
    if (a.isNew && !b.isNew) return -1;
    if (!a.isNew && b.isNew) return 1;
    
    // Then by created date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

// Filter items based on filter criteria
const filterItems = (items: InboxItem[], filter: InboxFilter): InboxItem[] => {
  return items.filter(item => {
    // Filter by entity type
    if (filter.entityTypes?.length && !filter.entityTypes.includes(item.entityType)) {
      return false;
    }
    
    // Filter by status
    if (filter.statuses?.length && !filter.statuses.includes(item.status)) {
      return false;
    }
    
    // Filter by search term
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const searchableText = [
        item.title,
        item.subtitle,
        item.customerName,
        item.customerEmail,
        item.companyName,
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  });
};

export const useUnifiedInbox = (filter: InboxFilter = {}) => {
  return useQuery({
    queryKey: ['unified-inbox', filter],
    queryFn: async (): Promise<InboxItem[]> => {
      // Fetch all three entity types in parallel
      const [inquiriesRes, ordersRes, bookingsRes] = await Promise.all([
        supabase
          .from('event_inquiries')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('catering_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('event_bookings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const inquiries = (inquiriesRes.data || []).map(transformInquiry);
      const orders = (ordersRes.data || []).map(transformOrder);
      const bookings = (bookingsRes.data || []).map(transformBooking);

      // Combine, filter, and sort
      const allItems = [...inquiries, ...orders, ...bookings];
      const filteredItems = filterItems(allItems, filter);
      return sortByUrgency(filteredItems);
    },
    staleTime: 30 * 1000, // 30 seconds
  });
};

// Get counts for badges
export const useInboxCounts = () => {
  return useQuery({
    queryKey: ['inbox-counts'],
    queryFn: async () => {
      const [inquiriesRes, ordersRes, bookingsRes] = await Promise.all([
        supabase
          .from('event_inquiries')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new'),
        supabase
          .from('catering_orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('event_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'menu_pending'),
      ]);

      return {
        inquiries: inquiriesRes.count || 0,
        orders: ordersRes.count || 0,
        bookings: bookingsRes.count || 0,
        total: (inquiriesRes.count || 0) + (ordersRes.count || 0) + (bookingsRes.count || 0),
      };
    },
    staleTime: 30 * 1000,
  });
};

// Get single item by type and ID
export const useInboxItem = (entityType: EntityType, entityId: string) => {
  return useQuery({
    queryKey: ['inbox-item', entityType, entityId],
    queryFn: async (): Promise<InboxItem | null> => {
      const table = entityType === 'event_inquiry' ? 'event_inquiries' :
                   entityType === 'catering_order' ? 'catering_orders' :
                   'event_bookings';
      
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', entityId)
        .single();

      if (error || !data) return null;

      if (entityType === 'event_inquiry') return transformInquiry(data);
      if (entityType === 'catering_order') return transformOrder(data);
      return transformBooking(data);
    },
    enabled: !!entityId,
  });
};
