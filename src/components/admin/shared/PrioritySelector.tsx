import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Flag, AlertTriangle, Flame } from "lucide-react";
import { InquiryPriority } from "@/types/refine";

const PRIORITY_CONFIG: Record<
  InquiryPriority,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: typeof Flag;
  }
> = {
  normal: {
    label: "Normal",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    icon: Flag,
  },
  high: {
    label: "Hoch",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    icon: AlertTriangle,
  },
  urgent: {
    label: "Dringend",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    icon: Flame,
  },
};

interface PrioritySelectorProps {
  value: InquiryPriority;
  onChange: (priority: InquiryPriority) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function PrioritySelector({
  value,
  onChange,
  disabled = false,
  compact = false,
}: PrioritySelectorProps) {
  const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.normal;
  const Icon = config.icon;

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1 px-2", config.color)}
            disabled={disabled}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-xs">{config.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.keys(PRIORITY_CONFIG) as InquiryPriority[]).map((priority) => {
            const pConfig = PRIORITY_CONFIG[priority];
            const PIcon = pConfig.icon;
            return (
              <DropdownMenuItem
                key={priority}
                onClick={() => onChange(priority)}
                className={cn(
                  "gap-2",
                  value === priority && "bg-accent"
                )}
              >
                <PIcon className={cn("h-4 w-4", pConfig.color)} />
                <span>{pConfig.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-between", config.color)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span>{config.label}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[180px]">
        {(Object.keys(PRIORITY_CONFIG) as InquiryPriority[]).map((priority) => {
          const pConfig = PRIORITY_CONFIG[priority];
          const PIcon = pConfig.icon;
          return (
            <DropdownMenuItem
              key={priority}
              onClick={() => onChange(priority)}
              className={cn(
                "gap-2",
                value === priority && "bg-accent"
              )}
            >
              <PIcon className={cn("h-4 w-4", pConfig.color)} />
              <span>{pConfig.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Badge component for displaying priority in lists
export function PriorityBadge({
  priority,
  showLabel = true,
}: {
  priority: InquiryPriority;
  showLabel?: boolean;
}) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  const Icon = config.icon;

  // Don't show badge for normal priority to reduce visual noise
  if (priority === "normal") return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-normal border-0",
        config.bgColor,
        config.color
      )}
    >
      <Icon className="h-3 w-3" />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}
