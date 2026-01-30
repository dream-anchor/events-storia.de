import { CalendarDays, FileText, CheckCircle2, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { InboxItem as InboxItemType, EntityType } from '../types';
import { STATUS_LABELS, STATUS_VARIANTS } from '../types';

interface InboxItemProps {
  item: InboxItemType;
  isSelected: boolean;
  onClick: () => void;
}

const EntityIcon = ({ type }: { type: EntityType }) => {
  switch (type) {
    case 'event_inquiry':
      return <CalendarDays className="h-4 w-4 text-blue-500" />;
    case 'catering_order':
      return <FileText className="h-4 w-4 text-amber-500" />;
    case 'event_booking':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  }
};

const formatRelativeDate = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Heute';
    if (isYesterday(date)) return 'Gestern';
    return format(date, 'd. MMM', { locale: de });
  } catch {
    return '';
  }
};

const formatTime = (dateString: string): string => {
  try {
    return format(parseISO(dateString), 'HH:mm', { locale: de });
  } catch {
    return '';
  }
};

export const InboxItem = ({ item, isSelected, onClick }: InboxItemProps) => {
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const statusVariant = STATUS_VARIANTS[item.status] || 'secondary';

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 transition-colors hover:bg-accent/50",
        isSelected && "bg-accent border-l-2 border-l-primary",
        item.isNew && !isSelected && "bg-primary/5"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <EntityIcon type={item.entityType} />
          <span className={cn(
            "font-medium text-sm truncate",
            item.isNew && "font-semibold"
          )}>
            {item.title}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatRelativeDate(item.createdAt)}
        </span>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-muted-foreground truncate mb-2 pl-6">
        {item.subtitle}
      </p>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 pl-6">
        <div className="flex items-center gap-1.5 min-w-0">
          {item.companyName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{item.companyName}</span>
            </div>
          )}
          {item.date && (
            <span className="text-xs text-muted-foreground">
              • {formatRelativeDate(item.date)}
            </span>
          )}
        </div>
        <Badge variant={statusVariant} className="text-[10px] px-1.5 py-0">
          {statusLabel}
        </Badge>
      </div>

      {/* New indicator dot */}
      {item.isNew && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
      )}
    </button>
  );
};
