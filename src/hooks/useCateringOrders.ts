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
  delivery_street: string | null;
  delivery_zip: string | null;
  delivery_city: string | null;
  delivery_floor: string | null;
  has_elevator: boolean | null;
  is_pickup: boolean | null;
  desired_date: string | null;
  desired_time: string | null;
  notes: string | null;
  internal_notes: string | null;
  items: any[];
  total_amount: number | null;
  status: string | null;
  created_at: string | null;
  // Billing and delivery costs
  billing_name: string | null;
  billing_street: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  billing_country: string | null;
  delivery_cost: number | null;
  minimum_order_surcharge: number | null;
  calculated_distance_km: number | null;
  // Customer and payment info
  user_id: string | null;
  payment_method: string | null;
  payment_status: string | null;
  lexoffice_document_type: string | null;
  lexoffice_invoice_id: string | null;
  // Cancellation fields
  cancellation_reason: string | null;
  cancelled_at: string | null;
  lexoffice_credit_note_id: string | null;
  stripe_payment_intent_id: string | null;
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

export const useUpdateOrderNotes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, internalNotes }: { orderId: string; internalNotes: string }) => {
      const { error } = await supabase
        .from('catering_orders')
        .update({ internal_notes: internalNotes })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catering-orders'] });
    },
  });
};