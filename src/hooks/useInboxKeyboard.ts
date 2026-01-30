import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InboxItem } from '@/components/admin/inbox/types';

interface UseInboxKeyboardOptions {
  onEnter?: () => void;
  onEscape?: () => void;
  onDelete?: () => void;
  enabled?: boolean;
}

/**
 * Keyboard navigation for the inbox
 * - j/ArrowDown: Next item
 * - k/ArrowUp: Previous item
 * - Enter: Open/edit selected item
 * - Escape: Close detail pane
 */
export const useInboxKeyboard = (
  items: InboxItem[],
  selectedId: string | null,
  options: UseInboxKeyboardOptions = {}
) => {
  const navigate = useNavigate();
  const { onEnter, onEscape, onDelete, enabled = true } = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle if typing in an input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    const currentIndex = items.findIndex(i => i.id === selectedId);

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          const nextItem = items[currentIndex + 1];
          navigate(`/admin/inbox/${nextItem.entityType}/${nextItem.id}`);
        } else if (currentIndex === -1 && items.length > 0) {
          // If nothing selected, select first
          const firstItem = items[0];
          navigate(`/admin/inbox/${firstItem.entityType}/${firstItem.id}`);
        }
        break;

      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        if (currentIndex > 0) {
          const prevItem = items[currentIndex - 1];
          navigate(`/admin/inbox/${prevItem.entityType}/${prevItem.id}`);
        }
        break;

      case 'Enter':
        e.preventDefault();
        onEnter?.();
        break;

      case 'Escape':
        e.preventDefault();
        onEscape?.();
        break;

      case 'Delete':
      case 'Backspace':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onDelete?.();
        }
        break;

      // Quick actions with modifier keys
      case 'e':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          // Quick edit - could trigger inline editing
          onEnter?.();
        }
        break;
    }
  }, [items, selectedId, navigate, onEnter, onEscape, onDelete]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  return {
    // Expose for manual triggering
    goToNext: () => {
      const currentIndex = items.findIndex(i => i.id === selectedId);
      if (currentIndex < items.length - 1) {
        const nextItem = items[currentIndex + 1];
        navigate(`/admin/inbox/${nextItem.entityType}/${nextItem.id}`);
      }
    },
    goToPrev: () => {
      const currentIndex = items.findIndex(i => i.id === selectedId);
      if (currentIndex > 0) {
        const prevItem = items[currentIndex - 1];
        navigate(`/admin/inbox/${prevItem.entityType}/${prevItem.id}`);
      }
    },
    goToFirst: () => {
      if (items.length > 0) {
        const firstItem = items[0];
        navigate(`/admin/inbox/${firstItem.entityType}/${firstItem.id}`);
      }
    },
  };
};
