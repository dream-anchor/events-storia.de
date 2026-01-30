import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogout, useGetIdentity } from "@refinedev/core";
import { LogOut, ExternalLink, Command, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import storiaLogo from "@/assets/storia-logo.webp";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";
import { usePendingMenuBookingsCount } from "@/hooks/useEventBookings";
import { useInboxCounts } from "@/hooks/useUnifiedInbox";
import { FloatingPillNav, MobilePillNav, MobileBottomNav } from "./FloatingPillNav";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { useTheme } from "next-themes";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab?: string;
}

export const AdminLayout = ({ children, activeTab }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<{ email: string; name?: string }>();
  const { data: newInquiriesCount } = useNewInquiriesCount();
  const { data: pendingOrdersCount } = usePendingOrdersCount();
  const { data: pendingBookingsCount } = usePendingMenuBookingsCount();
  const { data: inboxCounts } = useInboxCounts();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const { theme, setTheme } = useTheme();

  const getBadgeCount = (key?: string) => {
    if (key === 'inbox') return inboxCounts?.total || 0;
    if (key === 'events') return newInquiriesCount || 0;
    if (key === 'bookings') return pendingBookingsCount || 0;
    if (key === 'orders') return pendingOrdersCount || 0;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 admin-layout">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/admin" className="flex items-center gap-3 shrink-0">
              <img 
                src={storiaLogo} 
                alt="STORIA" 
                className="h-7 hover:opacity-80 transition-opacity" 
              />
            </Link>
            
            {/* Floating Pill Navigation (Desktop) */}
            <FloatingPillNav 
              activeKey={activeTab}
              getBadgeCount={getBadgeCount}
            />
            
            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Dark Mode Toggle */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-9 w-9"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {/* Command Palette Trigger */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 text-muted-foreground"
              >
                <Command className="h-3.5 w-3.5" />
                <span className="text-sm">⌘K</span>
              </Button>

              <span className="hidden lg:block text-base text-muted-foreground max-w-[180px] truncate">
                {identity?.name || identity?.email}
              </span>
              <Button variant="outline" size="sm" asChild className="hidden sm:flex">
                <Link to="/">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Webseite
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => logout()}
                className="h-9 w-9"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Mobile Secondary Navigation (Horizontal Scroll) */}
          <div className="mt-3 md:hidden">
            <MobilePillNav 
              activeKey={activeTab}
              getBadgeCount={getBadgeCount}
            />
          </div>
        </div>
      </header>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Main Content - with bottom padding for mobile nav */}
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav getBadgeCount={getBadgeCount} />
    </div>
  );
};
