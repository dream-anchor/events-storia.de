import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";
import { usePendingMenuBookingsCount } from "@/hooks/useEventBookings";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { UserProfileDropdown } from "../shared/UserProfileDropdown";
import { NotificationCenter } from "../shared/NotificationCenter";
import {
  CalendarDays,
  UtensilsCrossed,
  Receipt,
  Settings,
  Search,
  Menu,
  X,
  LayoutDashboard,
  Package,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle2,
  Database,
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  key: string;
  badge?: number;
  children?: Omit<NavItem, 'children'>[];
}

export const AdminLayout = ({ children, activeTab }: AdminLayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['events', 'catalog']);

  const { data: newInquiriesCount } = useNewInquiriesCount();
  const { data: pendingOrdersCount } = usePendingOrdersCount();
  const { data: pendingBookingsCount } = usePendingMenuBookingsCount();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();

  const toggleSection = (key: string) => {
    setExpandedSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Navigation structure based on mockup
  const navigation: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      key: 'dashboard',
    },
    {
      name: 'Events',
      href: '/admin/events',
      icon: CalendarDays,
      key: 'events',
      badge: (newInquiriesCount || 0) + (pendingBookingsCount || 0),
      children: [
        { name: 'Anfragen', href: '/admin/events', icon: CalendarDays, key: 'inquiries', badge: newInquiriesCount || 0 },
        { name: 'Buchungen', href: '/admin/bookings', icon: CheckCircle2, key: 'bookings', badge: pendingBookingsCount || 0 },
      ],
    },
    {
      name: 'Catering',
      href: '/admin/orders',
      icon: UtensilsCrossed,
      key: 'catering',
      badge: pendingOrdersCount || 0,
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
        { name: 'Pakete', href: '/admin/packages', icon: Package, key: 'packages' },
        { name: 'Speisen', href: '/admin/menu', icon: FileText, key: 'menu' },
      ],
    },
  ];

  const isActive = (href: string, key: string) => {
    if (href === '/admin' && location.pathname === '/admin') return true;
    if (href !== '/admin' && location.pathname.startsWith(href)) return true;
    return activeTab === key;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link to="/admin" className="block">
          <h1 className="text-xl font-semibold tracking-tight">
            StoriaMaestro
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Event & Catering
          </p>
        </Link>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCommandOpen(true)}
          className="w-full justify-start text-muted-foreground h-9 rounded-lg"
        >
          <Search className="h-4 w-4 mr-2" />
          <span className="text-sm">Suche...</span>
          <kbd className="ml-auto text-xs text-muted-foreground/60 hidden sm:inline">
            ⌘K
          </kbd>
        </Button>
      </div>

      <Separator className="mb-2" />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.key);
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedSections.includes(item.key);

          return (
            <div key={item.key}>
              {hasChildren ? (
                <>
                  <button
                    onClick={() => toggleSection(item.key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{item.name}</span>
                    {item.badge && item.badge > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs font-mono">
                        {item.badge}
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-4 mt-1 space-y-1 border-l border-border pl-3">
                          {item.children?.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = location.pathname === child.href ||
                              (child.href !== '/admin' && location.pathname.startsWith(child.href));

                            return (
                              <Link
                                key={child.key}
                                to={child.href}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                  childActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                              >
                                <ChildIcon className="h-4 w-4 shrink-0" />
                                <span className="flex-1">{child.name}</span>
                                {child.badge && child.badge > 0 && (
                                  <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs font-mono">
                                    {child.badge}
                                  </Badge>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <Link
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs font-mono">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <Separator className="my-2" />

      {/* Settings at bottom */}
      <div className="p-3">
        <Link
          to="/admin/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname.includes('/admin/settings')
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Einstellungen</span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] admin-layout">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:bg-card lg:border-r lg:border-border">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-4 lg:px-6">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          {/* Mobile logo */}
          <Link to="/admin" className="lg:hidden font-semibold">
            StoriaMaestro
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Desktop search trigger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCommandOpen(true)}
              className="hidden sm:flex lg:hidden"
            >
              <Search className="h-5 w-5" />
            </Button>

            <NotificationCenter />
            <UserProfileDropdown />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
};
