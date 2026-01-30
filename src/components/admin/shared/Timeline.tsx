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
  Settings,
  CheckCircle2,
  XCircle,
  Send,
  Server
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
import { useEmailDeliveryLogs, formatProvider, formatEmailStatus, type EmailDeliveryLog } from '@/hooks/useEmailDeliveryLogs';
import type { ActivityLog, EntityType } from './types';
import { getAdminDisplayName, getAdminInitials } from '@/lib/adminDisplayNames';

// Combined timeline entry type
type TimelineItem = 
  | { type: 'activity'; data: ActivityLog; timestamp: string }
  | { type: 'email'; data: EmailDeliveryLog; timestamp: string };

interface TimelineProps {
  entityType: EntityType;
  entityId: string;
  className?: string;
}

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

interface ActivityEntryProps {
  log: ActivityLog;
  isFirst: boolean;
  isLast: boolean;
}

const ActivityEntry = ({ log, isFirst, isLast }: ActivityEntryProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasEmailContent = log.action === 'email_sent' && log.metadata?.html_content;
  const actionText = formatActivityAction(log);
  const actorName = getAdminDisplayName(log.actor_email);
  const initials = getAdminInitials(log.actor_email);
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

// Email Delivery Log Entry Component
interface EmailDeliveryEntryProps {
  emailLog: EmailDeliveryLog;
  isFirst: boolean;
  isLast: boolean;
}

const EmailDeliveryEntry = ({ emailLog, isFirst, isLast }: EmailDeliveryEntryProps) => {
  const statusInfo = formatEmailStatus(emailLog.status);
  const providerName = formatProvider(emailLog.provider);
  const actorName = getAdminDisplayName(emailLog.sent_by || undefined);
  const initials = emailLog.sent_by ? getAdminInitials(emailLog.sent_by) : 'SY';
  
  const isSuccess = emailLog.status === 'sent';
  const theme = isSuccess 
    ? { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'text-green-600' }
    : { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'text-red-600' };

  return (
    <div className="relative flex gap-3 group">
      {/* Timeline connector */}
      <div className="relative flex flex-col items-center">
        {!isFirst && (
          <div className="absolute top-0 w-px h-3 bg-border" />
        )}
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className="h-8 w-8 border-2 border-background shadow-sm">
                  <AvatarFallback className="text-xs font-medium bg-violet-500/10 text-violet-600">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Status icon badge */}
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full border",
                  theme.bg, theme.border
                )}>
                  <div className={theme.icon}>
                    {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              <p className="font-medium">{actorName}</p>
              <p className="text-muted-foreground">{emailLog.sent_by || 'System'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
                        {formatDistanceToNow(parseISO(emailLog.sent_at), { 
                          locale: de, 
                          addSuffix: true 
                        })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(parseISO(emailLog.sent_at), 'PPpp', { locale: de })}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge 
                variant={statusInfo.variant === 'success' ? 'default' : statusInfo.variant === 'destructive' ? 'destructive' : 'secondary'} 
                className={cn(
                  "text-xs shrink-0 font-normal",
                  statusInfo.variant === 'success' && "bg-green-500 hover:bg-green-600"
                )}
              >
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className="text-xs shrink-0 font-normal">
                {format(parseISO(emailLog.sent_at), 'HH:mm', { locale: de })}
              </Badge>
            </div>
          </div>

          {/* Email subject */}
          <p className="text-sm text-foreground flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-muted-foreground" />
            E-Mail "{emailLog.subject}" an {emailLog.recipient_name || emailLog.recipient_email}
          </p>

          {/* Provider & Message ID details */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-default">
                    <Server className="h-3 w-3" />
                    {providerName}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  E-Mail-Provider
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {emailLog.provider_message_id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono text-[10px] bg-muted/50 px-1.5 py-0.5 rounded cursor-default truncate max-w-[200px]">
                      {emailLog.provider_message_id}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Message-ID vom Provider</p>
                    <p className="font-mono text-xs break-all">{emailLog.provider_message_id}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Error message if failed */}
          {emailLog.error_message && (
            <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive font-medium">Fehler:</p>
              <p className="text-xs text-destructive/80 mt-0.5">{emailLog.error_message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Combined Timeline Entry
interface TimelineEntryProps {
  item: TimelineItem;
  isFirst: boolean;
  isLast: boolean;
}

const TimelineEntry = ({ item, isFirst, isLast }: TimelineEntryProps) => {
  if (item.type === 'email') {
    return <EmailDeliveryEntry emailLog={item.data} isFirst={isFirst} isLast={isLast} />;
  }
  return <ActivityEntry log={item.data} isFirst={isFirst} isLast={isLast} />;
};

// Group items by date
const groupItemsByDate = (items: TimelineItem[]): Map<string, TimelineItem[]> => {
  const groups = new Map<string, TimelineItem[]>();
  
  items.forEach(item => {
    const dateKey = format(parseISO(item.timestamp), 'yyyy-MM-dd');
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, item]);
  });
  
  return groups;
};

export const Timeline = ({ entityType, entityId, className }: TimelineProps) => {
  const { data: activityLogs = [], isLoading: isLoadingActivity } = useActivityLogs(entityType, entityId);
  const { data: emailLogs = [], isLoading: isLoadingEmail } = useEmailDeliveryLogs(entityType, entityId);
  
  const isLoading = isLoadingActivity || isLoadingEmail;
  
  // Combine and sort all timeline items
  const combinedItems = useMemo((): TimelineItem[] => {
    const activityItems: TimelineItem[] = activityLogs.map(log => ({
      type: 'activity' as const,
      data: log,
      timestamp: log.created_at,
    }));
    
    const emailItems: TimelineItem[] = emailLogs.map(log => ({
      type: 'email' as const,
      data: log,
      timestamp: log.sent_at,
    }));
    
    return [...activityItems, ...emailItems].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activityLogs, emailLogs]);
  
  const groupedItems = useMemo(() => groupItemsByDate(combinedItems), [combinedItems]);
  const dateKeys = useMemo(() => Array.from(groupedItems.keys()), [groupedItems]);

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

  if (combinedItems.length === 0) {
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
          <div className="flex items-center gap-2">
            {emailLogs.length > 0 && (
              <Badge variant="outline" className="font-normal text-xs">
                <Mail className="h-3 w-3 mr-1" />
                {emailLogs.length} E-Mail{emailLogs.length !== 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="secondary" className="font-normal">
              {combinedItems.length} {combinedItems.length === 1 ? 'Eintrag' : 'Einträge'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {dateKeys.map((dateKey, groupIndex) => {
            const groupItems = groupedItems.get(dateKey) || [];
            const isLastGroup = groupIndex === dateKeys.length - 1;
            
            return (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground px-2">
                    {formatDateGroup(groupItems[0].timestamp)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                
                {/* Entries for this date */}
                <div>
                  {groupItems.map((item, itemIndex) => {
                    const itemId = item.type === 'activity' ? item.data.id : item.data.id;
                    return (
                      <TimelineEntry 
                        key={`${item.type}-${itemId}`}
                        item={item}
                        isFirst={itemIndex === 0}
                        isLast={isLastGroup && itemIndex === groupItems.length - 1}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
