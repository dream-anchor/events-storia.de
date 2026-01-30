import { formatDistanceToNow, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Admin display name mapping
const ADMIN_DISPLAY_NAMES: Record<string, { name: string; initials: string }> = {
  'monot@hey.com': { name: 'Domenico', initials: 'DS' },
  'nicola@storia.de': { name: 'Nicola', initials: 'NS' },
  'info@storia.de': { name: 'Team', initials: 'ST' },
};

interface EditorIndicatorProps {
  editedBy?: string | null;
  editedAt?: string | null;
  compact?: boolean;
}

export function EditorIndicator({ editedBy, editedAt, compact = false }: EditorIndicatorProps) {
  if (!editedBy && !editedAt) {
    return (
      <span className="text-xs text-muted-foreground">
        Noch nicht bearbeitet
      </span>
    );
  }

  // Try to resolve display name from email (editedBy could be UUID or email)
  const displayInfo = editedBy ? ADMIN_DISPLAY_NAMES[editedBy] : null;
  const initials = displayInfo?.initials || (editedBy ? editedBy.substring(0, 2).toUpperCase() : '??');
  const displayName = displayInfo?.name || editedBy || 'Unbekannt';
  
  const relativeTime = editedAt 
    ? formatDistanceToNow(parseISO(editedAt), { addSuffix: true, locale: de })
    : '';

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">{relativeTime}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{displayName}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">{displayName}</span>
        <span className="text-[10px] text-muted-foreground">{relativeTime}</span>
      </div>
    </div>
  );
}
