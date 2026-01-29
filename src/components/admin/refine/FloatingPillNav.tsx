import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  key: string;
  badge?: string;
}

interface FloatingPillNavProps {
  items: NavItem[];
  activeKey?: string;
  getBadgeCount?: (key?: string) => number;
}

export const FloatingPillNav = ({ 
  items, 
  activeKey, 
  getBadgeCount 
}: FloatingPillNavProps) => {
  return (
    <nav className="hidden md:flex items-center gap-1 p-1.5 bg-background/80 backdrop-blur-xl border border-border/50 rounded-full shadow-lg">
      {items.map((item) => {
        const Icon = item.icon;
        const badgeCount = getBadgeCount?.(item.badge) || 0;
        const isActive = activeKey === item.key;
        
        return (
          <Link
            key={item.key}
            to={item.href}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 rounded-full text-base font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
            {badgeCount > 0 && (
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-1 px-1.5 py-0 text-xs min-w-[18px] h-[18px] flex items-center justify-center",
                  isActive 
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-primary text-primary-foreground"
                )}
              >
                {badgeCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

// Mobile version with horizontal scroll
export const MobilePillNav = ({ 
  items, 
  activeKey, 
  getBadgeCount 
}: FloatingPillNavProps) => {
  return (
    <nav className="flex md:hidden items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {items.map((item) => {
        const Icon = item.icon;
        const badgeCount = getBadgeCount?.(item.badge) || 0;
        const isActive = activeKey === item.key;
        
        return (
          <Link
            key={item.key}
            to={item.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.name}</span>
            {badgeCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 text-xs rounded-full min-w-[16px] text-center",
                isActive 
                  ? "bg-primary-foreground/20 text-primary-foreground" 
                  : "bg-primary text-primary-foreground"
              )}>
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};