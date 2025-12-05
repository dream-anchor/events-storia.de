import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CateringOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  company_name: string | null;
  delivery_address: string | null;
  is_pickup: boolean | null;
  desired_date: string | null;
  desired_time: string | null;
  notes: string | null;
  items: any[];
  total_amount: number | null;
  status: string | null;
  created_at: string | null;
  // New fields for billing and delivery costs
  billing_name: string | null;
  billing_street: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  billing_country: string | null;
  delivery_cost: number | null;
  minimum_order_surcharge: number | null;
  calculated_distance_km: number | null;
}

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export const useCateringOrders = (statusFilter?: OrderStatus | 'all') => {
  return useQuery({
    queryKey: ['catering-orders', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('catering_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as CateringOrder[];
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from('catering_orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catering-orders'] });
    },
  });
};

export const usePendingOrdersCount = () => {
  return useQuery({
    queryKey: ['catering-orders-pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('catering_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    },
  });
};
