import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventInquiry {
  id: string;
  company_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  guest_count: string | null;
  event_type: string | null;
  preferred_date: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  internal_notes: string | null;
  notification_sent: boolean | null;
  created_at: string;
  updated_at: string | null;
}

export type InquiryStatus = 'new' | 'contacted' | 'offer_sent' | 'confirmed' | 'declined';

export const useEventInquiries = (statusFilter?: InquiryStatus | 'all') => {
  return useQuery({
    queryKey: ['event-inquiries', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('event_inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as EventInquiry[];
    },
  });
};

export const useUpdateInquiryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inquiryId, status }: { inquiryId: string; status: InquiryStatus }) => {
      const { error } = await supabase
        .from('event_inquiries')
        .update({ status })
        .eq('id', inquiryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-inquiries'] });
    },
  });
};

export const useUpdateInquiryNotes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inquiryId, internalNotes }: { inquiryId: string; internalNotes: string }) => {
      const { error } = await supabase
        .from('event_inquiries')
        .update({ internal_notes: internalNotes })
        .eq('id', inquiryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-inquiries'] });
    },
  });
};

export const useDeleteInquiry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inquiryId: string) => {
      const { error } = await supabase
        .from('event_inquiries')
        .delete()
        .eq('id', inquiryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-inquiries'] });
    },
  });
};

export const useNewInquiriesCount = () => {
  return useQuery({
    queryKey: ['event-inquiries-new-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('event_inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');

      if (error) throw error;
      return count || 0;
    },
  });
};
