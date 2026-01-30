import { CalendarDays, FileText, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EntityType, InboxItemStatus } from '../types';

interface InboxFiltersProps {
  onFilterType: (types: EntityType[]) => void;
  onFilterStatus: (statuses: InboxItemStatus[]) => void;
  counts?: {
    inquiries: number;
    orders: number;
    bookings: number;
    total: number;
  };
  activeTypes?: EntityType[];
  activeStatuses?: InboxItemStatus[];
}

const TYPE_FILTERS: { type: EntityType; label: string; icon: React.ReactNode }[] = [
  { type: 'event_inquiry', label: 'Anfragen', icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { type: 'catering_order', label: 'Catering', icon: <FileText className="h-3.5 w-3.5" /> },
  { type: 'event_booking', label: 'Events', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

const STATUS_FILTERS: { status: InboxItemStatus; label: string }[] = [
  { status: 'new', label: 'Neu' },
  { status: 'in_progress', label: 'In Bearbeitung' },
  { status: 'confirmed', label: 'Bestätigt' },
];

export const InboxFilters = ({ 
  onFilterType, 
  onFilterStatus, 
  counts,
  activeTypes = [],
  activeStatuses = [],
}: InboxFiltersProps) => {
  const toggleType = (type: EntityType) => {
    if (activeTypes.includes(type)) {
      onFilterType(activeTypes.filter(t => t !== type));
    } else {
      onFilterType([...activeTypes, type]);
    }
  };

  const toggleStatus = (status: InboxItemStatus) => {
    if (activeStatuses.includes(status)) {
      onFilterStatus(activeStatuses.filter(s => s !== status));
    } else {
      onFilterStatus([...activeStatuses, status]);
    }
  };

  const getCount = (type: EntityType) => {
    if (!counts) return 0;
    switch (type) {
      case 'event_inquiry': return counts.inquiries;
      case 'catering_order': return counts.orders;
      case 'event_booking': return counts.bookings;
      default: return 0;
    }
  };

  return (
    <div className="space-y-2">
      {/* Type filters */}
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map(({ type, label, icon }) => {
          const isActive = activeTypes.includes(type);
          const count = getCount(type);
          
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              )}
            >
              {icon}
              {label}
              {count > 0 && (
                <Badge 
                  variant={isActive ? "secondary" : "default"} 
                  className={cn(
                    "h-4 min-w-4 px-1 text-[10px]",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : ""
                  )}
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map(({ status, label }) => {
          const isActive = activeStatuses.includes(status);
          
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={cn(
                "px-2 py-0.5 rounded text-xs transition-colors",
                isActive 
                  ? "bg-secondary text-secondary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
