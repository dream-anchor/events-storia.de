import { Mail, Server, CheckCircle2, XCircle, Clock, Eye, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEmailDeliveryLogs, formatProvider, formatEmailStatus } from '@/hooks/useEmailDeliveryLogs';
import { getAdminDisplayName } from '@/lib/adminDisplayNames';
import type { EntityType } from './types';

interface EmailStatusCardProps {
  entityType: EntityType;
  entityId: string;
  className?: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  'sent': <Mail className="h-3.5 w-3.5" />,
  'delivered': <CheckCircle2 className="h-3.5 w-3.5" />,
  'opened': <Eye className="h-3.5 w-3.5" />,
  'bounced': <XCircle className="h-3.5 w-3.5" />,
  'complained': <AlertTriangle className="h-3.5 w-3.5" />,
  'delayed': <Clock className="h-3.5 w-3.5" />,
  'failed': <XCircle className="h-3.5 w-3.5" />,
};

const STATUS_COLOR: Record<string, string> = {
  'sent': 'text-muted-foreground',
  'delivered': 'text-green-600',
  'opened': 'text-green-600',
  'bounced': 'text-red-600',
  'complained': 'text-red-600',
  'delayed': 'text-amber-600',
  'failed': 'text-red-600',
};

export const EmailStatusCard = ({ entityType, entityId, className }: EmailStatusCardProps) => {
  const { data: emailLogs = [], isLoading } = useEmailDeliveryLogs(entityType, entityId);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-Mail-Verlauf
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (emailLogs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-Mail-Verlauf
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="mx-auto w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
              <Mail className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Noch keine E-Mails versendet</p>
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
            <Mail className="h-4 w-4" />
            E-Mail-Verlauf
          </CardTitle>
          <Badge variant="secondary" className="font-normal text-xs">
            {emailLogs.length} {emailLogs.length === 1 ? 'E-Mail' : 'E-Mails'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {emailLogs.map((log) => {
            const statusInfo = formatEmailStatus(log.status);
            const icon = STATUS_ICON[log.status] || <Mail className="h-3.5 w-3.5" />;
            const iconColor = STATUS_COLOR[log.status] || 'text-muted-foreground';
            const senderName = getAdminDisplayName(log.sent_by || undefined);

            return (
              <div
                key={log.id}
                className={cn(
                  "rounded-lg border p-3 transition-all hover:shadow-sm",
                  log.status === 'failed' || log.status === 'bounced' || log.status === 'complained'
                    ? 'bg-red-500/5 border-red-500/20'
                    : log.status === 'delayed'
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : log.status === 'delivered' || log.status === 'opened'
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-muted/30 border-border/60'
                )}
              >
                {/* Zeile 1: Status + Betreff */}
                <div className="flex items-start gap-2">
                  <div className={cn("mt-0.5 shrink-0", iconColor)}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={statusInfo.variant === 'success' ? 'default' : statusInfo.variant === 'destructive' ? 'destructive' : 'secondary'}
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-5 font-normal",
                          statusInfo.variant === 'success' && "bg-green-500 hover:bg-green-600",
                          statusInfo.variant === 'warning' && "bg-amber-500 hover:bg-amber-600 text-white"
                        )}
                      >
                        {statusInfo.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {log.subject}
                      </span>
                    </div>

                    {/* Zeile 2: Empfänger + Absender + Provider + Zeit */}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className="truncate max-w-[180px]">
                        → {log.recipient_name || log.recipient_email}
                      </span>
                      <span>•</span>
                      <span>{senderName}</span>
                      <span>•</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-default">
                              <Server className="h-3 w-3" />
                              {formatProvider(log.provider)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {log.provider_message_id ? (
                              <p className="font-mono text-xs break-all">{log.provider_message_id}</p>
                            ) : (
                              <p>Keine Message-ID</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span>•</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">
                              {formatDistanceToNow(parseISO(log.sent_at), { locale: de, addSuffix: true })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(parseISO(log.sent_at), 'PPpp', { locale: de })}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>

                {/* Error-Box */}
                {log.error_message && (
                  <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20 ml-6">
                    <p className="text-xs text-destructive">{log.error_message}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
