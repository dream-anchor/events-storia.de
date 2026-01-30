import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePresenceMessage } from '@/hooks/usePresence';
import type { Viewer } from './types';

interface PresenceIndicatorProps {
  viewers: Viewer[];
  className?: string;
}

export const PresenceIndicator = ({ viewers, className }: PresenceIndicatorProps) => {
  const message = usePresenceMessage(viewers);
  
  if (viewers.length === 0) return null;

  const hasEditor = viewers.some(v => v.is_editing);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-2 px-2 py-1 rounded-full text-xs",
            hasEditor ? "bg-amber-100" : "bg-muted",
            className
          )}>
            {/* Stacked avatars */}
            <div className="flex -space-x-2">
              {viewers.slice(0, 3).map((viewer) => (
                <Avatar 
                  key={viewer.user_id} 
                  className={cn(
                    "h-6 w-6 border-2 border-background",
                    viewer.is_editing && "ring-2 ring-amber-500"
                  )}
                >
                  <AvatarFallback className={cn(
                    "text-[10px] font-medium",
                    viewer.is_editing 
                      ? "bg-amber-500 text-amber-50" 
                      : "bg-primary text-primary-foreground"
                  )}>
                    {viewer.email.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {viewers.length > 3 && (
                <Avatar className="h-6 w-6 border-2 border-background">
                  <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                    +{viewers.length - 3}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>

            {/* Status text */}
            <span className={cn(
              "text-muted-foreground hidden sm:inline",
              hasEditor && "text-amber-700"
            )}>
              {hasEditor ? 'Wird bearbeitet' : 'Online'}
            </span>

            {/* Live indicator */}
            <span className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              hasEditor ? "bg-amber-500" : "bg-green-500"
            )} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{message}</p>
          <ul className="mt-1 text-xs text-muted-foreground">
            {viewers.map(v => (
              <li key={v.user_id} className="flex items-center gap-1">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  v.is_editing ? "bg-amber-500" : "bg-green-500"
                )} />
                {v.email.split('@')[0]}
                {v.is_editing && ' (bearbeitet)'}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
