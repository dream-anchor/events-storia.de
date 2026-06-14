import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ActivityLog, EntityType } from '@/components/admin/shared/types';

/**
 * Fetch activity logs for an entity
 */
export const useActivityLogs = (entityType: EntityType, entityId: string) => {
  return useQuery({
    queryKey: ['activity-logs', entityType, entityId],
    queryFn: async (): Promise<ActivityLog[]> => {
      // For inquiry pages, also include logs written with entity_type 'v2_event'
      // (edge functions key off the event record but the UUID is identical).
      const entityTypes = entityType === 'event_inquiry'
        ? ['event_inquiry', 'v2_event']
        : [entityType];

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .in('entity_type', entityTypes)
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
    'field_changed': (l) => {
      const m = (l.metadata || {}) as Record<string, unknown>;
      const label = (m.label as string) || (m.field as string) || 'Feld';
      const oldD = (m.old_display as string) || '—';
      const newD = (m.new_display as string) || '—';
      return `${label} geändert: ${oldD} → ${newD}`;
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
    'offer_updated': (l) => {
      const optionCount = l.metadata?.optionCount;
      if (optionCount) {
        return `Angebot mit ${optionCount} Option${optionCount === 1 ? '' : 'en'} aktualisiert`;
      }
      return 'Angebot aktualisiert';
    },
    'payment_received': () => 'Zahlung eingegangen',
    'booking_created': () => 'Buchung erstellt',
    'menu_confirmed': () => 'Menü bestätigt',
    'offline_booking_confirmed': () => 'Verbindlich gebucht (ohne Online-Zahlung)',
    'lexoffice_invoice_created': () => 'Rechnung automatisch erstellt (LexOffice)',
    'lexoffice_invoice_failed': () => 'Rechnungserstellung fehlgeschlagen',
    'created': () => 'Anfrage eingegangen',
    'updated': () => 'Daten aktualisiert',
    'package_selected': (l) => {
      const packageName = l.metadata?.packageName || 'Paket';
      return `Paket "${packageName}" ausgewählt`;
    },
    'menu_updated': () => 'Menüauswahl aktualisiert',
    'email_failure_resolved': (l) => {
      const m = (l.metadata || {}) as Record<string, unknown>;
      const recipient = (m.recipient_email as string) || 'Empfänger';
      return `Zustellfehler an ${recipient} als erledigt markiert`;
    },
    'offer_email_failed': (l) => {
      const m = (l.metadata || {}) as Record<string, unknown>;
      const recipient = (m.recipient as string) || 'Empfänger';
      const reason = (m.reason as string) || 'Zustellfehler';
      return `Zustellfehler an ${recipient} (${reason})`;
    },
    'offer_email_sent': (l) => {
      const m = (l.metadata || {}) as Record<string, unknown>;
      const recipient = (m.recipient as string) || 'Empfänger';
      const provider = (m.provider as string) || '';
      return `Angebot per E-Mail an ${recipient}${provider ? ` (${provider})` : ''}`;
    },
    'email_smtp_fallback_sent': (l) => {
      const m = (l.metadata || {}) as Record<string, unknown>;
      const recipient = (m.recipient as string) || 'Empfänger';
      return `SMTP-Fallback an ${recipient} ausgeführt`;
    },
    'email_smtp_fallback_failed': (l) => {
      const m = (l.metadata || {}) as Record<string, unknown>;
      const recipient = (m.recipient as string) || 'Empfänger';
      return `SMTP-Fallback an ${recipient} fehlgeschlagen`;
    },
    'guest_count_changed': (l) => {
      const oldCount = l.old_value?.guest_count || '?';
      const newCount = l.new_value?.guest_count || '?';
      return `Gästeanzahl geändert: ${oldCount} → ${newCount}`;
    },
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
    'offline_booking_confirmed': 'CalendarCheck',
    'lexoffice_invoice_created': 'FileText',
    'lexoffice_invoice_failed': 'AlertTriangle',
    'created': 'Plus',
    'updated': 'Pencil',
    'email_failure_resolved': 'CheckCircle2',
  };
  return icons[action] || 'Activity';
};
