import { ReactNode } from 'react';
import { ArrowLeft, ExternalLink, MoreHorizontal, Mail, FileText, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { PresenceIndicator } from './PresenceIndicator';
import type { InboxItem, Viewer } from '../types';
import { STATUS_LABELS, STATUS_VARIANTS, ENTITY_TYPE_LABELS } from '../types';

interface DetailHeaderProps {
  item: InboxItem;
  viewers?: Viewer[];
  onBack?: () => void;
  onEdit?: () => void;
  onEmail?: () => void;
  onViewPdf?: () => void;
  actions?: ReactNode;
  className?: string;
}

export const DetailHeader = ({
  item,
  viewers = [],
  onBack,
  onEdit,
  onEmail,
  onViewPdf,
  actions,
  className,
}: DetailHeaderProps) => {
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const statusVariant = STATUS_VARIANTS[item.status] || 'secondary';
  const entityLabel = ENTITY_TYPE_LABELS[item.entityType];

  return (
    <div className={cn("border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {entityLabel}
              </Badge>
              <Badge variant={statusVariant} className="text-xs">
                {statusLabel}
              </Badge>
            </div>
            <h1 className="text-lg font-semibold mt-1">{item.title}</h1>
            <p className="text-sm text-muted-foreground">{item.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Presence indicator */}
          {viewers.length > 0 && (
            <PresenceIndicator viewers={viewers} />
          )}

          {/* Quick actions */}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Bearbeiten
            </Button>
          )}

          {actions}

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEmail && (
                <DropdownMenuItem onClick={onEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  E-Mail senden
                </DropdownMenuItem>
              )}
              {onViewPdf && (
                <DropdownMenuItem onClick={onViewPdf}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF anzeigen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <ExternalLink className="h-4 w-4 mr-2" />
                In neuem Tab öffnen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Customer info bar */}
      <div className="px-4 py-2 bg-muted/30 border-t border-border/50 flex items-center gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Kunde:</span>{' '}
          <span className="font-medium">{item.customerName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">E-Mail:</span>{' '}
          <a href={`mailto:${item.customerEmail}`} className="text-primary hover:underline">
            {item.customerEmail}
          </a>
        </div>
        {item.companyName && (
          <div>
            <span className="text-muted-foreground">Firma:</span>{' '}
            <span>{item.companyName}</span>
          </div>
        )}
        {item.amount && (
          <div className="ml-auto font-medium">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(item.amount)}
          </div>
        )}
      </div>
    </div>
  );
};
