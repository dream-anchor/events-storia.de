import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ActivityLog, EntityType } from '@/components/admin/inbox/types';

/**
 * Fetch activity logs for an entity
 */
export const useActivityLogs = (entityType: EntityType, entityId: string) => {
  return useQuery({
    queryKey: ['activity-logs', entityType, entityId],
    queryFn: async (): Promise<ActivityLog[]> => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching activity logs:', error);
        return [];
      }

      return (data || []) as unknown as ActivityLog[];
    },
    enabled: !!entityId,
  });
};

/**
 * Log an activity (mutation)
 */
export const useLogActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      entityType: EntityType;
      entityId: string;
      action: string;
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('activity_logs').insert([{
        entity_type: params.entityType,
        entity_id: params.entityId,
        action: params.action,
        actor_id: userData.user?.id,
        actor_email: userData.user?.email,
        old_value: params.oldValue as never,
        new_value: params.newValue as never,
        metadata: params.metadata as never,
      }]);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['activity-logs', variables.entityType, variables.entityId] 
      });
    },
  });
};

/**
 * Format an activity action for display
 */
export const formatActivityAction = (log: ActivityLog): string => {
  const actions: Record<string, (log: ActivityLog) => string> = {
    'status_changed': (l) => {
      const oldStatus = l.old_value?.status || '?';
      const newStatus = l.new_value?.status || '?';
      return `Status geändert: ${oldStatus} → ${newStatus}`;
    },
    'price_updated': (l) => {
      const itemName = l.metadata?.itemName || 'Artikel';
      return `Preis von "${itemName}" geändert`;
    },
    'email_sent': (l) => {
      const subject = l.metadata?.subject || 'E-Mail';
      return `E-Mail "${subject}" versendet`;
    },
    'note_added': () => 'Interne Notiz hinzugefügt',
    'offer_created': () => 'Angebot erstellt',
    'offer_updated': () => 'Angebot aktualisiert',
    'payment_received': () => 'Zahlung eingegangen',
    'booking_created': () => 'Buchung erstellt',
    'menu_confirmed': () => 'Menü bestätigt',
    'created': () => 'Anfrage eingegangen',
    'updated': () => 'Daten aktualisiert',
  };

  const formatter = actions[log.action];
  if (formatter) return formatter(log);
  
  // Fallback: use the action as-is
  return log.action.replace(/_/g, ' ');
};

/**
 * Get the icon name for an activity action
 */
export const getActivityIcon = (action: string): string => {
  const icons: Record<string, string> = {
    'status_changed': 'ArrowRightLeft',
    'price_updated': 'Euro',
    'email_sent': 'Mail',
    'note_added': 'StickyNote',
    'offer_created': 'FileText',
    'offer_updated': 'FilePen',
    'payment_received': 'CreditCard',
    'booking_created': 'CalendarCheck',
    'menu_confirmed': 'UtensilsCrossed',
    'created': 'Plus',
    'updated': 'Pencil',
  };
  return icons[action] || 'Activity';
};
