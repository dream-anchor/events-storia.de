import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventBooking {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_email: string;
  company_name: string | null;
  phone: string | null;
  package_id: string | null;
  guest_count: number;
  event_date: string;
  event_time: string | null;
  location_id: string | null;
  menu_selection: {
    courses: Array<{
      courseType: string;
      courseLabel: string;
      itemId: string | null;
      itemName: string;
      itemDescription: string | null;
      itemSource: string;
      isCustom: boolean;
    }>;
    drinks: Array<{
      drinkGroup: string;
      drinkLabel: string;
      selectedChoice: string | null;
      quantityLabel: string | null;
      customDrink?: string | null;
    }>;
  } | null;
  menu_confirmed: boolean | null;
  total_amount: number | null;
  payment_status: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_link_id: string | null;
  status: string | null;
  internal_notes: string | null;
  source_inquiry_id: string | null;
  source_option_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export type BookingStatus = 'menu_pending' | 'ready' | 'completed' | 'cancelled';

export const useEventBookings = (statusFilter?: BookingStatus | 'all') => {
  return useQuery({
    queryKey: ['event-bookings', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('event_bookings')
        .select('*')
        .order('event_date', { ascending: true });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as EventBooking[];
    },
  });
};

export const useEventBooking = (id: string | undefined) => {
  return useQuery({
    queryKey: ['event-booking', id],
    queryFn: async () => {
      if (!id) throw new Error('No ID provided');
      
      const { data, error } = await supabase
        .from('event_bookings')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as EventBooking;
    },
    enabled: !!id,
  });
};

export const useUpdateEventBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      bookingId, 
      updates 
    }: { 
      bookingId: string; 
      updates: Partial<EventBooking>;
    }) => {
      const { error } = await supabase
        .from('event_bookings')
        .update(updates)
        .eq('id', bookingId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event-booking', variables.bookingId] });
    },
  });
};

export const usePendingMenuBookingsCount = () => {
  return useQuery({
    queryKey: ['event-bookings-menu-pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('event_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('menu_confirmed', false);

      if (error) throw error;
      return count || 0;
    },
  });
};

export const useConfirmBookingMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      bookingId, 
      menuSelection,
      sendEmail = false,
    }: { 
      bookingId: string; 
      menuSelection: EventBooking['menu_selection'];
      sendEmail?: boolean;
    }) => {
      // Update booking with menu
      const { error: updateError } = await supabase
        .from('event_bookings')
        .update({ 
          menu_selection: menuSelection,
          menu_confirmed: true,
          status: 'ready',
        })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Optionally send confirmation email
      if (sendEmail) {
        const { error: emailError } = await supabase.functions.invoke('send-menu-confirmation', {
          body: { bookingId, sendEmail: true },
        });
        
        if (emailError) {
          console.error('Failed to send confirmation email:', emailError);
          // Don't throw - menu was saved successfully
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event-booking', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['event-bookings-menu-pending-count'] });
    },
  });
};
