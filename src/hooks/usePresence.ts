import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Viewer, PresenceState } from '@/components/admin/inbox/types';

interface UsePresenceOptions {
  onViewersChange?: (viewers: Viewer[]) => void;
}

/**
 * Track user presence for an entity using Supabase Realtime Presence
 * Shows who is viewing/editing the same entity
 */
export const usePresence = (
  entityType: string,
  entityId: string,
  options: UsePresenceOptions = {}
): PresenceState & { 
  setEditing: (isEditing: boolean) => Promise<void>;
  currentViewers: Viewer[];
} => {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUser({ 
          id: data.user.id, 
          email: data.user.email || 'Unknown' 
        });
      }
    });
  }, []);

  // Subscribe to presence channel
  useEffect(() => {
    if (!entityId || !currentUser) return;

    const channelName = `presence:${entityType}:${entityId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const allViewers: Viewer[] = [];
        
        Object.values(state).forEach((presences) => {
          (presences as unknown as Viewer[]).forEach((presence) => {
            // Don't include current user in viewers list
            if (presence.user_id && presence.user_id !== currentUser.id) {
              allViewers.push(presence);
            }
          });
        });
        
        setViewers(allViewers);
        options.onViewersChange?.(allViewers);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('[Presence] User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('[Presence] User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            email: currentUser.email,
            joined_at: new Date().toISOString(),
            is_editing: false,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId, currentUser, options.onViewersChange]);

  // Update editing status
  const setEditing = useCallback(async (isEditing: boolean) => {
    if (!entityId || !currentUser) return;

    const channelName = `presence:${entityType}:${entityId}`;
    const channel = supabase.channel(channelName);
    
    await channel.track({
      user_id: currentUser.id,
      email: currentUser.email,
      joined_at: new Date().toISOString(),
      is_editing: isEditing,
    });
  }, [entityType, entityId, currentUser]);

  // Compute presence state
  const isBeingEdited = viewers.some(v => v.is_editing);
  const editingBy = viewers.find(v => v.is_editing);

  return {
    viewers,
    currentViewers: viewers,
    isBeingEdited,
    editingBy,
    setEditing,
  };
};

/**
 * Hook to get a formatted presence message
 */
export const usePresenceMessage = (viewers: Viewer[]): string | null => {
  if (viewers.length === 0) return null;
  
  if (viewers.length === 1) {
    const name = viewers[0].email.split('@')[0];
    return viewers[0].is_editing 
      ? `${name} bearbeitet gerade...`
      : `${name} sieht sich das an`;
  }
  
  if (viewers.length === 2) {
    const names = viewers.map(v => v.email.split('@')[0]);
    return `${names[0]} und ${names[1]} sehen sich das an`;
  }
  
  const firstName = viewers[0].email.split('@')[0];
  return `${firstName} und ${viewers.length - 1} weitere sehen sich das an`;
};
