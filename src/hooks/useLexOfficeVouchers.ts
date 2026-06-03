import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LexOfficeVoucher {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  voucherType: 'invoice' | 'quotation' | 'creditnote';
  voucherStatus: 'draft' | 'open' | 'paid' | 'voided' | 'overdue';
  totalAmount: number;
  currency: string;
  contactName: string;
  contactId?: string;
  localOrderId?: string;
  localOrderNumber?: string;
  localPaymentStatus?: string;
}

export interface VoucherFilters {
  voucherType?: 'invoice' | 'quotation' | 'creditnote' | 'all';
  voucherStatus?: 'draft' | 'open' | 'paid' | 'voided' | 'overdue';
  page?: number;
  size?: number;
  createdDateFrom?: string;
  createdDateTo?: string;
}

export interface VoucherListResponse {
  content: LexOfficeVoucher[];
  totalPages: number;
  totalElements: number;
  currentPage: number;
  error?: string;
}

export interface SyncResult {
  processed: number;
  updated: number;
  errors: string[];
}

export interface ManualInvoiceRequest {
  contactName: string;
  companyName?: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    zip: string;
    city: string;
    country?: string;
  };
  items: {
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }[];
  eventInquiryId?: string;
  documentType: 'invoice' | 'quotation';
  introduction?: string;
  remark?: string;
}

/**
 * Fetch vouchers (invoices, quotations) from LexOffice
 */
export const useLexOfficeVouchers = (filters?: VoucherFilters) => {
  return useQuery({
    queryKey: ['lexoffice-vouchers', filters],
    queryFn: async (): Promise<VoucherListResponse> => {
      const { data, error } = await supabase.functions.invoke('list-lexoffice-vouchers', {
        body: filters || {},
      });

      if (error) throw error;
      return data as VoucherListResponse;
    },
    staleTime: 60000, // 1 minute cache
    refetchOnWindowFocus: false,
  });
};

/**
 * Sync payment status from LexOffice for a single order or all orders
 */
export const useSyncLexOfficePaymentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId?: string): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('sync-lexoffice-payment-status', {
        body: { orderId },
      });

      if (error) throw error;
      return data as SyncResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catering-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lexoffice-vouchers'] });
    },
  });
};

/**
 * Create a manual invoice in LexOffice
 */
export const useCreateManualInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ManualInvoiceRequest) => {
      const { data, error } = await supabase.functions.invoke('create-manual-invoice', {
        body: request,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lexoffice-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['event-inquiries'] });
    },
  });
};

/**
 * Download PDF document from LexOffice
 */
export const useDownloadLexOfficeDocument = () => {
  return useMutation({
    mutationFn: async ({ voucherId, voucherType }: { voucherId: string; voucherType: string }) => {
      // Determine endpoint
      const endpoint = voucherType === 'invoice' ? 'invoices' :
                       voucherType === 'quotation' ? 'quotations' : 'creditnotes';

      // We need to call a function that can access the LexOffice API
      const { data, error } = await supabase.functions.invoke('get-lexoffice-document-by-id', {
        body: { voucherId, voucherType },
      });

      if (error) throw error;
      return data;
    },
  });
};

/**
 * Per-order: list ALL LexOffice documents (quotation, deposit invoices, final invoice).
 */
export interface OrderLexDoc {
  id: string;
  type: 'invoice' | 'quotation';
  kind: 'final' | 'standard' | 'deposit' | 'quotation';
  number: string | null;
  date: string | null;
  gross: number | null;
  status: string | null;
  paymentId?: string | null;
  sends?: Array<{
    to: string;
    sent_at: string;
    message_id?: string | null;
  }>;
}

export const useOrderLexofficeDocuments = (orderId?: string | null) => {
  return useQuery({
    queryKey: ['order-lex-docs', orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<{ docs: OrderLexDoc[]; bookingNumber: string | null }> => {
      const { data, error } = await supabase.functions.invoke('list-lexoffice-documents', {
        body: { orderId },
      });
      if (error) throw error;
      return data as { docs: OrderLexDoc[]; bookingNumber: string | null };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
};

export const useVoidLexofficeInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, voucherId }: { orderId: string; voucherId: string }) => {
      const { data, error } = await supabase.functions.invoke('void-lexoffice-invoice', {
        body: { orderId, voucherId },
      });
      if (error) throw error;
      if (!(data as any)?.success) {
        throw new Error((data as any)?.error || 'Storno fehlgeschlagen');
      }
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['order-lex-docs', vars.orderId] });
    },
  });
};

/**
 * Get count of open invoices for badge display
 */
export const useOpenInvoicesCount = () => {
  return useQuery({
    queryKey: ['lexoffice-open-invoices-count'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-lexoffice-vouchers', {
        body: { voucherType: 'invoice', voucherStatus: 'open', size: 1 },
      });

      if (error) return 0;
      return (data as VoucherListResponse).totalElements || 0;
    },
    staleTime: 300000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
};
