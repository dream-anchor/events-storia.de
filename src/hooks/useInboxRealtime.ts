import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to real-time updates for the unified inbox
 * Automatically invalidates queries when data changes
 */
export const useInboxRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('inbox-realtime')
      // Event inquiries
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_inquiries' },
        (payload) => {
          console.log('[Realtime] event_inquiries change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
          queryClient.invalidateQueries({ queryKey: ['inbox-counts'] });
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            queryClient.invalidateQueries({ 
              queryKey: ['inbox-item', 'event_inquiry', payload.new.id] 
            });
          }
        }
      )
      // Catering orders
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'catering_orders' },
        (payload) => {
          console.log('[Realtime] catering_orders change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
          queryClient.invalidateQueries({ queryKey: ['inbox-counts'] });
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            queryClient.invalidateQueries({ 
              queryKey: ['inbox-item', 'catering_order', payload.new.id] 
            });
          }
        }
      )
      // Event bookings
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_bookings' },
        (payload) => {
          console.log('[Realtime] event_bookings change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
          queryClient.invalidateQueries({ queryKey: ['inbox-counts'] });
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            queryClient.invalidateQueries({ 
              queryKey: ['inbox-item', 'event_booking', payload.new.id] 
            });
          }
        }
      )
      // Activity logs (for timeline updates)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          console.log('[Realtime] activity_logs insert');
          if (payload.new && typeof payload.new === 'object') {
            const log = payload.new as { entity_type?: string; entity_id?: string };
            if (log.entity_type && log.entity_id) {
              queryClient.invalidateQueries({ 
                queryKey: ['activity-logs', log.entity_type, log.entity_id] 
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from inbox-realtime');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Subscribe to real-time updates for a specific entity
 */
export const useEntityRealtime = (
  entityType: string, 
  entityId: string,
  onUpdate?: () => void
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!entityId) return;

    const table = entityType === 'event_inquiry' ? 'event_inquiries' :
                 entityType === 'catering_order' ? 'catering_orders' :
                 'event_bookings';

    const channel = supabase
      .channel(`entity:${entityType}:${entityId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table,
          filter: `id=eq.${entityId}`
        },
        (payload) => {
          console.log(`[Realtime] ${table} ${entityId} updated`);
          queryClient.invalidateQueries({ 
            queryKey: ['inbox-item', entityType, entityId] 
          });
          onUpdate?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId, queryClient, onUpdate]);
};
