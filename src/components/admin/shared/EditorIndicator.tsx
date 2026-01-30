import { formatDistanceToNow, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAdminDisplayName, getAdminInitials } from "@/lib/adminDisplayNames";

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

  const initials = getAdminInitials(editedBy);
  const displayName = getAdminDisplayName(editedBy);
  
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
