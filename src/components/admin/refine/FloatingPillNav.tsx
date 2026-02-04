import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { LucideIcon, ChevronDown, CalendarDays, Database, LayoutDashboard, CheckCircle2, FileText, Package, UtensilsCrossed, Receipt } from "lucide-react";

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

// Navigation structure: Events + Catering as separate top-level categories
const navigationContexts: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/admin', 
    icon: LayoutDashboard, 
    key: 'dashboard' 
  },
  { 
    name: 'Events', 
    href: '/admin/events', 
    icon: CalendarDays, 
    key: 'events',
    children: [
      { name: 'Anfragen', href: '/admin/events', key: 'events', badge: 'events', icon: CalendarDays },
      { name: 'Buchungen', href: '/admin/bookings', key: 'bookings', badge: 'bookings', icon: CheckCircle2 },
    ]
  },
  {
    name: 'Catering',
    href: '/admin/orders',
    icon: FileText,
    key: 'orders',
    badge: 'orders',
  },
  {
    name: 'Buchhaltung',
    href: '/admin/invoices',
    icon: Receipt,
    key: 'invoices',
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
    if (path.includes('/admin/events') || path.includes('/admin/bookings')) return 'events';
    if (path.includes('/admin/orders')) return 'orders';
    if (path.includes('/admin/invoices')) return 'invoices';
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
    <nav className={cn(
      "hidden md:flex items-center gap-1.5 p-2",
      "bg-[var(--glass-level-4)] backdrop-blur-[var(--blur-strong)]",
      "rounded-[var(--radius-3xl)] border border-white/40",
      "shadow-[var(--shadow-floating),_var(--ambient-glow)]",
      "transition-shadow duration-300"
    )}>
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
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "relative flex items-center gap-2 px-5 py-3 rounded-[var(--radius-2xl)] text-sm font-medium transition-all duration-200 outline-none",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-[var(--glow-primary)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
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
                          ? "bg-primary-foreground/20 text-primary-foreground" 
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {badgeCount}
                    </Badge>
                  )}
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-56 mt-2 glass-card border-0 font-sans"
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
                          isChildActive && "bg-secondary"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {ChildIcon && <ChildIcon className="h-4 w-4 text-muted-foreground" />}
                          <span>{child.name}</span>
                        </div>
                        {childBadgeCount > 0 && (
                          <Badge variant="secondary" className="bg-primary text-primary-foreground text-xs px-1.5 py-0 h-5">
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
          <motion.div key={item.key} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Link
              to={item.href}
              className={cn(
                "relative flex items-center gap-2 px-5 py-3 rounded-[var(--radius-2xl)] text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[var(--glow-primary)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
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
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-primary text-primary-foreground"
                )}
              >
                {badgeCount}
              </Badge>
            )}
            </Link>
          </motion.div>
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
    { name: 'Events', href: '/admin/events', icon: CalendarDays, key: 'events', badge: 'events' },
    { name: 'Catering', href: '/admin/orders', icon: FileText, key: 'orders', badge: 'orders' },
    { name: 'Stammdaten', href: '/admin/packages', icon: Database, key: 'catalog' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin/events') return location.pathname.includes('/events') || location.pathname.includes('/bookings');
    if (href === '/admin/orders') return location.pathname.includes('/orders');
    if (href === '/admin/packages') return location.pathname.includes('/packages') || location.pathname.includes('/menu');
    return false;
  };

  return (
    <motion.nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 md:hidden",
        "glass-floating border-t-0",
        "shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.1)]"
      )}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 28,
        mass: 0.8
      }}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid grid-cols-3 h-16">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const badgeCount = getBadgeCount?.(item.badge) || 0;

          return (
            <motion.div key={item.key} whileTap={{ scale: 0.9 }}>
              <Link
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 relative transition-colors h-full",
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-medium min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
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
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute top-0 inset-x-4 h-0.5 bg-primary rounded-full shadow-[var(--glow-primary)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.nav>
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
          <motion.div key={item.key} whileTap={{ scale: 0.95 }}>
            <Link
              to={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground bg-secondary hover:bg-secondary/80"
              )}
            >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.name}</span>
            {badgeCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 text-xs rounded-md min-w-[16px] text-center",
                isActive 
                  ? "bg-primary-foreground/20 text-primary-foreground" 
                  : "bg-primary text-primary-foreground"
              )}>
                {badgeCount}
              </span>
            )}
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
};
