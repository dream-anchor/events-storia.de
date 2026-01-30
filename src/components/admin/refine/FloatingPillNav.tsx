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
    <nav className="hidden md:flex items-center gap-0.5 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
      {items.map((item) => {
        const Icon = item.icon;
        const badgeCount = getBadgeCount?.(item.badge) || 0;
        const isActive = activeKey === item.key;
        
        return (
          <Link
            key={item.key}
            to={item.href}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
            {badgeCount > 0 && (
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-1 px-1.5 py-0 text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-md",
                  isActive 
                    ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" 
                    : "bg-blue-500 text-white"
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
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              isActive
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.name}</span>
            {badgeCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 text-xs rounded-md min-w-[16px] text-center",
                isActive 
                  ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" 
                  : "bg-blue-500 text-white"
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