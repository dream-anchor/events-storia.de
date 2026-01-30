import { Skeleton } from '@/components/ui/skeleton';
import { InboxItem } from './InboxItem';
import type { InboxItem as InboxItemType, EntityType } from '../types';
import { Inbox } from 'lucide-react';

interface InboxFeedProps {
  items: InboxItemType[];
  selectedId?: string;
  onSelect?: (id: string, entityType: EntityType) => void;
  isLoading: boolean;
  error: Error | null;
}

export const InboxFeed = ({ 
  items, 
  selectedId, 
  onSelect, 
  isLoading, 
  error 
}: InboxFeedProps) => {
  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="text-sm">Fehler beim Laden</p>
        <p className="text-xs mt-1 text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Keine Einträge gefunden</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {items.map(item => (
        <InboxItem
          key={`${item.entityType}-${item.id}`}
          item={item}
          isSelected={item.id === selectedId}
          onClick={() => onSelect?.(item.id, item.entityType)}
        />
      ))}
    </div>
  );
};
