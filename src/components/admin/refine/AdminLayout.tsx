import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";
import { usePendingMenuBookingsCount } from "@/hooks/useEventBookings";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { NotificationCenter } from "../shared/NotificationCenter";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  CalendarDays,
  UtensilsCrossed,
  FileText,
  Settings,
  Search,
  Menu,
  X,
  Plus,
  Bell,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState as useStateReact } from "react";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab?: string;
  title?: string;
  showSearch?: boolean;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  createButtonText?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  key: string;
}

export const AdminLayout = ({
  children,
  activeTab,
  title = "Dashboard",
  showSearch = true,
  showCreateButton = true,
  onCreateClick,
  createButtonText = "Neue Anfrage",
}: AdminLayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userEmail, setUserEmail] = useStateReact<string | null>(null);
  const [userName, setUserName] = useStateReact<string>("Benutzer");

  const { data: newInquiriesCount } = useNewInquiriesCount();
  const { data: pendingOrdersCount } = usePendingOrdersCount();
  const { data: pendingBookingsCount } = usePendingMenuBookingsCount();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();

  // Admin-Theme auf body setzen, damit Radix-Portale (Dialog, Select, etc.)
  // die Maestro CSS-Variablen statt der Website-Variablen erben
  useEffect(() => {
    document.body.classList.add('admin-active');
    return () => { document.body.classList.remove('admin-active'); };
  }, []);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || null);
        // Extract name from email or metadata
        const name = user.user_metadata?.full_name ||
                     user.email?.split('@')[0] ||
                     "Benutzer";
        setUserName(name);
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  };

  // Navigation items matching mockup
  const navigation: NavItem[] = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, key: 'dashboard' },
    { name: 'Events', href: '/admin/events', icon: CalendarDays, key: 'events' },
    { name: 'Catering', href: '/admin/orders', icon: UtensilsCrossed, key: 'catering' },
    { name: 'Rechnungen', href: '/admin/invoices', icon: FileText, key: 'invoices' },
  ];

  const isActive = (href: string, key: string) => {
    if (href === '/admin' && location.pathname === '/admin') return true;
    if (href !== '/admin' && location.pathname.startsWith(href)) return true;
    if (key === 'events' && (location.pathname.includes('/events') || location.pathname.includes('/bookings'))) return true;
    return activeTab === key;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a2632]">
      {/* Logo Section */}
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary size-10 rounded-lg flex items-center justify-center text-white">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-none">StoriaMaestro</h1>
          <p className="text-xs text-muted-foreground mt-1">Event & Catering</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.key);
          const badgeCount = item.key === 'events'
            ? (newInquiriesCount || 0) + (pendingBookingsCount || 0)
            : item.key === 'catering'
              ? pendingOrdersCount || 0
              : 0;

          return (
            <Link
              key={item.key}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
              {badgeCount > 0 && (
                <Badge variant="secondary" className="ml-auto h-5 min-w-[20px] px-1.5 text-xs font-bold">
                  {badgeCount}
                </Badge>
              )}
            </Link>
          );
        })}

        {/* Settings Section */}
        <div className="pt-6 pb-2">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Einstellungen
          </p>
        </div>
        <Link
          to="/admin/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname.includes('/admin/settings')
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="h-5 w-5" />
          <span>Einstellungen</span>
        </Link>
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101922] admin-layout">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:border-r lg:border-border">
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
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Header Bar */}
        <header className="sticky top-0 z-40 h-16 flex items-center gap-4 border-b border-border bg-white dark:bg-[#1a2632] px-4 lg:px-8">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Title & Search */}
          <div className="flex items-center gap-6 flex-1">
            <h2 className="text-xl font-bold tracking-tight hidden sm:block">{title}</h2>

            {showSearch && (
              <div className="relative w-64 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setCommandOpen(true)}
                  className="pl-10 bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {showCreateButton && (
              <Button
                onClick={onCreateClick || (() => window.location.href = '/admin/events/create')}
                className="hidden sm:flex items-center gap-2 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {createButtonText}
              </Button>
            )}

            <div className="h-8 w-px bg-border hidden sm:block" />

            <NotificationCenter />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
