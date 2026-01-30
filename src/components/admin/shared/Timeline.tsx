import { 
  ArrowRightLeft, 
  Mail, 
  StickyNote, 
  FileText, 
  CreditCard, 
  Plus, 
  Pencil,
  UtensilsCrossed,
  CalendarCheck,
  Activity,
  Euro,
  ChevronDown
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useActivityLogs, formatActivityAction } from '@/hooks/useActivityLog';
import type { ActivityLog, EntityType } from './types';

interface TimelineProps {
  entityType: EntityType;
  entityId: string;
  className?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  'status_changed': <ArrowRightLeft className="h-3.5 w-3.5" />,
  'price_updated': <Euro className="h-3.5 w-3.5" />,
  'email_sent': <Mail className="h-3.5 w-3.5" />,
  'note_added': <StickyNote className="h-3.5 w-3.5" />,
  'offer_created': <FileText className="h-3.5 w-3.5" />,
  'offer_updated': <Pencil className="h-3.5 w-3.5" />,
  'payment_received': <CreditCard className="h-3.5 w-3.5" />,
  'booking_created': <CalendarCheck className="h-3.5 w-3.5" />,
  'menu_confirmed': <UtensilsCrossed className="h-3.5 w-3.5" />,
  'created': <Plus className="h-3.5 w-3.5" />,
  'updated': <Pencil className="h-3.5 w-3.5" />,
};

const getIcon = (action: string) => ICON_MAP[action] || <Activity className="h-3.5 w-3.5" />;

interface TimelineEntryProps {
  log: ActivityLog;
}

const TimelineEntry = ({ log }: TimelineEntryProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasEmailContent = log.action === 'email_sent' && log.metadata?.html_content;
  const actionText = formatActivityAction(log);
  const actorName = log.actor_email?.split('@')[0] || 'System';

  return (
    <div className="relative group">
      {/* Timeline dot */}
      <div className={cn(
        "absolute -left-[21px] top-2 w-3.5 h-3.5 rounded-full flex items-center justify-center",
        "bg-background border-2 border-muted-foreground/30 group-hover:border-primary transition-colors",
        log.action === 'created' && "bg-primary border-primary"
      )}>
        <div className={cn(
          "text-muted-foreground",
          log.action === 'created' && "text-primary-foreground"
        )}>
          {getIcon(log.action)}
        </div>
      </div>

      {/* Content card */}
      <div className="bg-card rounded-lg border border-border/50 p-3 hover:border-border transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-medium text-sm">{actorName}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(parseISO(log.created_at), { 
                  locale: de, 
                  addSuffix: true 
                })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {actionText}
            </p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {format(parseISO(log.created_at), 'HH:mm', { locale: de })}
          </span>
        </div>

        {/* Expandable email preview */}
        {hasEmailContent && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs gap-1">
                <Mail className="h-3 w-3" />
                E-Mail anzeigen
                <ChevronDown className={cn(
                  "h-3 w-3 transition-transform",
                  isExpanded && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div 
                className="rounded-md border bg-white p-3 prose prose-sm max-w-none text-foreground overflow-auto max-h-[300px]"
                dangerouslySetInnerHTML={{ __html: log.metadata?.html_content || '' }}
              />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* PDF link */}
        {log.metadata?.pdf_url && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-2 h-7 text-xs gap-1"
            asChild
          >
            <a href={log.metadata.pdf_url as string} target="_blank" rel="noopener noreferrer">
              <FileText className="h-3 w-3" />
              PDF anzeigen
            </a>
          </Button>
        )}
      </div>
    </div>
  );
};

export const Timeline = ({ entityType, entityId, className }: TimelineProps) => {
  const { data: logs = [], isLoading } = useActivityLogs(entityType, entityId);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-6">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Noch keine Aktivitäten</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Aktivitäten
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Timeline with vertical connector */}
        <div className="relative pl-6 space-y-4">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          
          {logs.map(log => (
            <TimelineEntry key={log.id} log={log} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
