import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { LucideIcon, ChevronDown, Inbox, CalendarDays, Database, LayoutDashboard, CheckCircle2, FileText, Package, UtensilsCrossed } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  key: string;
  badge?: string;
  children?: {
    name: string;
    href: string;
    key: string;
    badge?: string;
    icon?: LucideIcon;
  }[];
}

// New consolidated navigation structure with 3 main contexts
const navigationContexts: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/admin', 
    icon: LayoutDashboard, 
    key: 'dashboard' 
  },
  { 
    name: 'Inbox', 
    href: '/admin/inbox', 
    icon: Inbox, 
    key: 'inbox',
    badge: 'inbox'
  },
  { 
    name: 'Anfragen', 
    href: '/admin/events', 
    icon: CalendarDays, 
    key: 'workflow',
    badge: 'events',
    children: [
      { name: 'Event-Anfragen', href: '/admin/events', key: 'events', badge: 'events', icon: CalendarDays },
      { name: 'Buchungen', href: '/admin/bookings', key: 'bookings', badge: 'bookings', icon: CheckCircle2 },
      { name: 'Catering', href: '/admin/orders', key: 'orders', badge: 'orders', icon: FileText },
    ]
  },
  { 
    name: 'Stammdaten', 
    href: '/admin/packages', 
    icon: Database, 
    key: 'catalog',
    children: [
      { name: 'Pakete', href: '/admin/packages', key: 'packages', icon: Package },
      { name: 'Speisen & Getränke', href: '/admin/menu', key: 'menu', icon: UtensilsCrossed },
    ]
  },
];

interface FloatingPillNavProps {
  items?: NavItem[];
  activeKey?: string;
  getBadgeCount?: (key?: string) => number;
}

export const FloatingPillNav = ({ 
  activeKey, 
  getBadgeCount 
}: FloatingPillNavProps) => {
  const location = useLocation();
  
  // Determine which context is active based on current path
  const getActiveContext = () => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') return 'dashboard';
    if (path.includes('/admin/inbox')) return 'inbox';
    if (path.includes('/admin/events') || path.includes('/admin/bookings') || path.includes('/admin/orders')) return 'workflow';
    if (path.includes('/admin/packages') || path.includes('/admin/menu') || path.includes('/admin/locations')) return 'catalog';
    return activeKey;
  };

  const activeContext = getActiveContext();

  // Get total badge count for a context with children
  const getContextBadgeCount = (item: NavItem) => {
    if (item.children) {
      return item.children.reduce((sum, child) => sum + (getBadgeCount?.(child.badge) || 0), 0);
    }
    return getBadgeCount?.(item.badge) || 0;
  };

  return (
    <nav className="hidden md:flex items-center gap-1 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-slate-900/40">
      {navigationContexts.map((item) => {
        const Icon = item.icon;
        const isActive = activeContext === item.key || 
          (item.children?.some(child => location.pathname.includes(child.href)));
        const badgeCount = getContextBadgeCount(item);
        
        // Items with children get a dropdown
        if (item.children) {
          return (
            <DropdownMenu key={item.key}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 outline-none",
                    isActive
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
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
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-56 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/60 dark:border-slate-800/60"
              >
                {item.children.map((child) => {
                  const ChildIcon = child.icon;
                  const childBadgeCount = getBadgeCount?.(child.badge) || 0;
                  const isChildActive = location.pathname.includes(child.href);
                  
                  return (
                    <DropdownMenuItem key={child.key} asChild>
                      <Link
                        to={child.href}
                        className={cn(
                          "flex items-center justify-between gap-2 cursor-pointer",
                          isChildActive && "bg-slate-100 dark:bg-slate-800"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {ChildIcon && <ChildIcon className="h-4 w-4 text-muted-foreground" />}
                          <span>{child.name}</span>
                        </div>
                        {childBadgeCount > 0 && (
                          <Badge variant="secondary" className="bg-blue-500 text-white text-xs px-1.5 py-0 h-5">
                            {childBadgeCount}
                          </Badge>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        
        // Simple items without children
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

// Mobile Bottom Navigation - Fixed at bottom
export const MobileBottomNav = ({ 
  getBadgeCount 
}: { getBadgeCount?: (key?: string) => number }) => {
  const location = useLocation();
  
  const mobileItems = [
    { name: 'Inbox', href: '/admin/inbox', icon: Inbox, key: 'inbox', badge: 'inbox' },
    { name: 'Anfragen', href: '/admin/events', icon: CalendarDays, key: 'workflow', badge: 'events' },
    { name: 'Katalog', href: '/admin/packages', icon: Database, key: 'catalog' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin/inbox') return location.pathname.includes('/inbox');
    if (href === '/admin/events') return location.pathname.includes('/events') || location.pathname.includes('/bookings') || location.pathname.includes('/orders');
    if (href === '/admin/packages') return location.pathname.includes('/packages') || location.pathname.includes('/menu');
    return false;
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 pb-safe">
      <div className="grid grid-cols-3 h-16">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const badgeCount = getBadgeCount?.(item.badge) || 0;
          
          return (
            <Link
              key={item.key}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 relative transition-colors",
                active 
                  ? "text-slate-900 dark:text-white" 
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] font-medium min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                    {badgeCount}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[11px] font-medium",
                active && "font-semibold"
              )}>
                {item.name}
              </span>
              {active && (
                <div className="absolute top-0 inset-x-4 h-0.5 bg-slate-900 dark:bg-white rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

// Mobile version with horizontal scroll
export const MobilePillNav = ({ 
  items, 
  activeKey, 
  getBadgeCount 
}: FloatingPillNavProps) => {
  // Show only primary shortcuts on mobile header
  const shortcuts = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, key: 'dashboard' },
    { name: 'Events', href: '/admin/events', icon: CalendarDays, key: 'events', badge: 'events' },
    { name: 'Buchungen', href: '/admin/bookings', icon: CheckCircle2, key: 'bookings', badge: 'bookings' },
    { name: 'Catering', href: '/admin/orders', icon: FileText, key: 'orders', badge: 'orders' },
  ];

  return (
    <nav className="flex md:hidden items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {shortcuts.map((item) => {
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
