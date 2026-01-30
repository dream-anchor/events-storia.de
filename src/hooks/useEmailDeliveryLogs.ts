import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EntityType } from '@/components/admin/shared/types';

export interface EmailDeliveryLog {
  id: string;
  entity_type: string;
  entity_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  provider: string; // 'ionos_smtp' | 'resend'
  provider_message_id: string | null;
  status: string; // 'sent' | 'failed' | 'bounced'
  error_message: string | null;
  sent_by: string | null;
  sent_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Fetch email delivery logs for an entity
 */
export const useEmailDeliveryLogs = (entityType: EntityType, entityId: string) => {
  return useQuery({
    queryKey: ['email-delivery-logs', entityType, entityId],
    queryFn: async (): Promise<EmailDeliveryLog[]> => {
      const { data, error } = await supabase
        .from('email_delivery_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Error fetching email delivery logs:', error);
        return [];
      }

      return (data || []) as unknown as EmailDeliveryLog[];
    },
    enabled: !!entityId,
  });
};

/**
 * Format provider name for display
 */
export const formatProvider = (provider: string): string => {
  const providers: Record<string, string> = {
    'ionos_smtp': 'IONOS SMTP',
    'resend': 'Resend',
  };
  return providers[provider] || provider;
};

/**
 * Format status for display
 */
export const formatEmailStatus = (status: string): { label: string; variant: 'default' | 'success' | 'destructive' | 'secondary' } => {
  const statuses: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'secondary' }> = {
    'sent': { label: 'Zugestellt', variant: 'success' },
    'failed': { label: 'Fehlgeschlagen', variant: 'destructive' },
    'bounced': { label: 'Abgewiesen', variant: 'destructive' },
  };
  return statuses[status] || { label: status, variant: 'secondary' };
};
