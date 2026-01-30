import { useState } from 'react';
import { InboxSearch } from './InboxSearch';
import { InboxFilters } from './InboxFilters';
import { InboxFeed } from './InboxFeed';
import { useUnifiedInbox, useInboxCounts } from '@/hooks/useUnifiedInbox';
import type { InboxFilter, EntityType, InboxItemStatus } from '../types';

interface InboxSidebarProps {
  selectedId?: string;
  onSelect?: (id: string, entityType: EntityType) => void;
}

export const InboxSidebar = ({ selectedId, onSelect }: InboxSidebarProps) => {
  const [filter, setFilter] = useState<InboxFilter>({});
  const { data: items = [], isLoading, error } = useUnifiedInbox(filter);
  const { data: counts } = useInboxCounts();

  const handleSearch = (search: string) => {
    setFilter(prev => ({ ...prev, search: search || undefined }));
  };

  const handleFilterType = (types: EntityType[]) => {
    setFilter(prev => ({ ...prev, entityTypes: types.length > 0 ? types : undefined }));
  };

  const handleFilterStatus = (statuses: InboxItemStatus[]) => {
    setFilter(prev => ({ ...prev, statuses: statuses.length > 0 ? statuses : undefined }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <InboxSearch onSearch={handleSearch} />
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-border/50">
        <InboxFilters
          onFilterType={handleFilterType}
          onFilterStatus={handleFilterStatus}
          counts={counts}
          activeTypes={filter.entityTypes}
          activeStatuses={filter.statuses}
        />
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-auto">
        <InboxFeed
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* Footer with count */}
      <div className="px-3 py-2 border-t border-border/50 text-xs text-muted-foreground">
        {items.length} {items.length === 1 ? 'Eintrag' : 'Einträge'}
        {counts?.total ? ` • ${counts.total} neu` : ''}
      </div>
    </div>
  );
};

export { InboxSearch } from './InboxSearch';
export { InboxFilters } from './InboxFilters';
export { InboxFeed } from './InboxFeed';
export { InboxItem } from './InboxItem';
