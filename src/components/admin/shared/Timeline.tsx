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
  ChevronDown,
  User,
  Clock,
  ExternalLink,
  Package,
  Settings
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useActivityLogs, formatActivityAction } from '@/hooks/useActivityLog';
import type { ActivityLog, EntityType } from './types';

interface TimelineProps {
  entityType: EntityType;
  entityId: string;
  className?: string;
}

// Admin display names mapping
const ADMIN_DISPLAY_NAMES: Record<string, string> = {
  'mimmo2905@yahoo.de': 'Domenico Speranza',
  'madi@events-storia.de': 'Madina Khader',
  'madina.khader@gmail.com': 'Madina Khader',
};

const getDisplayName = (email: string | undefined): string => {
  if (!email) return 'System';
  return ADMIN_DISPLAY_NAMES[email.toLowerCase()] || email.split('@')[0];
};

const getInitials = (email: string | undefined): string => {
  if (!email) return 'S';
  const name = ADMIN_DISPLAY_NAMES[email.toLowerCase()];
  if (name) {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
};

const ICON_MAP: Record<string, React.ReactNode> = {
  'status_changed': <ArrowRightLeft className="h-3 w-3" />,
  'price_updated': <Euro className="h-3 w-3" />,
  'email_sent': <Mail className="h-3 w-3" />,
  'note_added': <StickyNote className="h-3 w-3" />,
  'offer_created': <FileText className="h-3 w-3" />,
  'offer_updated': <Settings className="h-3 w-3" />,
  'payment_received': <CreditCard className="h-3 w-3" />,
  'booking_created': <CalendarCheck className="h-3 w-3" />,
  'menu_confirmed': <UtensilsCrossed className="h-3 w-3" />,
  'created': <Plus className="h-3 w-3" />,
  'updated': <Pencil className="h-3 w-3" />,
  'package_selected': <Package className="h-3 w-3" />,
};

const getIcon = (action: string) => ICON_MAP[action] || <Activity className="h-3 w-3" />;

// Get color theme for action type
const getActionTheme = (action: string): { bg: string; border: string; icon: string } => {
  const themes: Record<string, { bg: string; border: string; icon: string }> = {
    'created': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'text-emerald-600' },
    'status_changed': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-600' },
    'email_sent': { bg: 'bg-violet-500/10', border: 'border-violet-500/30', icon: 'text-violet-600' },
    'offer_created': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-600' },
    'offer_updated': { bg: 'bg-slate-500/10', border: 'border-slate-500/30', icon: 'text-slate-600' },
    'payment_received': { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'text-green-600' },
    'booking_created': { bg: 'bg-teal-500/10', border: 'border-teal-500/30', icon: 'text-teal-600' },
    'menu_confirmed': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'text-orange-600' },
  };
  return themes[action] || { bg: 'bg-muted/50', border: 'border-muted', icon: 'text-muted-foreground' };
};

// Format date group header
const formatDateGroup = (dateString: string): string => {
  const date = parseISO(dateString);
  if (isToday(date)) return 'Heute';
  if (isYesterday(date)) return 'Gestern';
  return format(date, 'EEEE, d. MMMM yyyy', { locale: de });
};

interface TimelineEntryProps {
  log: ActivityLog;
  isFirst: boolean;
  isLast: boolean;
}

const TimelineEntry = ({ log, isFirst, isLast }: TimelineEntryProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasEmailContent = log.action === 'email_sent' && log.metadata?.html_content;
  const actionText = formatActivityAction(log);
  const actorName = getDisplayName(log.actor_email);
  const initials = getInitials(log.actor_email);
  const theme = getActionTheme(log.action);
  const hasSummary = log.metadata?.summary;

  return (
    <div className="relative flex gap-3 group">
      {/* Timeline connector */}
      <div className="relative flex flex-col items-center">
        {/* Top line */}
        {!isFirst && (
          <div className="absolute top-0 w-px h-3 bg-border" />
        )}
        
        {/* Avatar with icon overlay */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className="h-8 w-8 border-2 border-background shadow-sm">
                  <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Action icon badge */}
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full border",
                  theme.bg, theme.border
                )}>
                  <div className={theme.icon}>
                    {getIcon(log.action)}
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              <p className="font-medium">{actorName}</p>
              <p className="text-muted-foreground">{log.actor_email || 'System'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Bottom line */}
        {!isLast && (
          <div className="flex-1 w-px bg-border mt-1" />
        )}
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 pb-4",
        isLast && "pb-0"
      )}>
        <div className={cn(
          "rounded-lg border p-3 transition-all",
          "hover:shadow-sm hover:border-border",
          theme.bg, theme.border
        )}>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{actorName}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-default flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(parseISO(log.created_at), { 
                          locale: de, 
                          addSuffix: true 
                        })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(parseISO(log.created_at), 'PPpp', { locale: de })}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <Badge variant="outline" className="text-xs shrink-0 font-normal">
              {format(parseISO(log.created_at), 'HH:mm', { locale: de })}
            </Badge>
          </div>

          {/* Action description */}
          <p className="text-sm text-foreground">
            {actionText}
          </p>

          {/* Summary metadata if available */}
          {hasSummary && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
              {log.metadata?.summary as string}
            </p>
          )}

          {/* Expandable email preview */}
          {hasEmailContent && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs gap-1.5 -ml-2">
                  <Mail className="h-3 w-3" />
                  E-Mail-Inhalt anzeigen
                  <ChevronDown className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 animate-in fade-in-0 slide-in-from-top-2">
                <div 
                  className="rounded-md border bg-background p-4 prose prose-sm max-w-none text-foreground overflow-auto max-h-[400px] shadow-inner"
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
              className="mt-2 h-7 text-xs gap-1.5 -ml-2"
              asChild
            >
              <a href={log.metadata.pdf_url as string} target="_blank" rel="noopener noreferrer">
                <FileText className="h-3 w-3" />
                PDF öffnen
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Group logs by date
const groupLogsByDate = (logs: ActivityLog[]): Map<string, ActivityLog[]> => {
  const groups = new Map<string, ActivityLog[]>();
  
  logs.forEach(log => {
    const dateKey = format(parseISO(log.created_at), 'yyyy-MM-dd');
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, log]);
  });
  
  return groups;
};

export const Timeline = ({ entityType, entityId, className }: TimelineProps) => {
  const { data: logs = [], isLoading } = useActivityLogs(entityType, entityId);
  
  const groupedLogs = useMemo(() => groupLogsByDate(logs), [logs]);
  const dateKeys = useMemo(() => Array.from(groupedLogs.keys()), [groupedLogs]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-12 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Activity className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Noch keine Aktivitäten</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Änderungen werden hier automatisch protokolliert
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aktivitäten
          </CardTitle>
          <Badge variant="secondary" className="font-normal">
            {logs.length} {logs.length === 1 ? 'Eintrag' : 'Einträge'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {dateKeys.map((dateKey, groupIndex) => {
            const groupLogs = groupedLogs.get(dateKey) || [];
            const isLastGroup = groupIndex === dateKeys.length - 1;
            
            return (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground px-2">
                    {formatDateGroup(groupLogs[0].created_at)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                
                {/* Entries for this date */}
                <div>
                  {groupLogs.map((log, logIndex) => (
                    <TimelineEntry 
                      key={log.id} 
                      log={log}
                      isFirst={logIndex === 0}
                      isLast={isLastGroup && logIndex === groupLogs.length - 1}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
