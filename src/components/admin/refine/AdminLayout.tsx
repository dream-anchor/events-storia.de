import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogout, useGetIdentity } from "@refinedev/core";
import { LogOut, ExternalLink, LayoutDashboard, CalendarDays, UtensilsCrossed, FileText, Package, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import storiaLogo from "@/assets/storia-logo.webp";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";
import { FloatingPillNav, MobilePillNav } from "./FloatingPillNav";
import { CommandPalette, useCommandPalette } from "./CommandPalette";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab?: string;
}

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, key: 'dashboard' },
  { name: 'Events', href: '/admin/events', icon: CalendarDays, key: 'events', badge: 'events' },
  { name: 'Bestellungen', href: '/admin/orders', icon: FileText, key: 'orders', badge: 'orders' },
  { name: 'Pakete', href: '/admin/packages', icon: Package, key: 'packages' },
  { name: 'Speisen', href: '/admin/menu', icon: UtensilsCrossed, key: 'menu' },
];

export const AdminLayout = ({ children, activeTab }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<{ email: string }>();
  const { data: newInquiriesCount } = useNewInquiriesCount();
  const { data: pendingOrdersCount } = usePendingOrdersCount();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();

  const getBadgeCount = (key?: string) => {
    if (key === 'events') return newInquiriesCount || 0;
    if (key === 'orders') return pendingOrdersCount || 0;
    return 0;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <img 
                src={storiaLogo} 
                alt="STORIA" 
                className="h-7 hover:opacity-80 transition-opacity" 
              />
            </Link>
            
            {/* Floating Pill Navigation (Desktop) */}
            <FloatingPillNav 
              items={navigation} 
              activeKey={activeTab}
              getBadgeCount={getBadgeCount}
            />
            
            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Command Palette Trigger */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 text-muted-foreground"
              >
                <Command className="h-3.5 w-3.5" />
                <span className="text-xs">⌘K</span>
              </Button>

              <span className="hidden lg:block text-sm text-muted-foreground max-w-[150px] truncate">
                {identity?.email}
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
          
          {/* Mobile Navigation */}
          <div className="mt-3 md:hidden">
            <MobilePillNav 
              items={navigation} 
              activeKey={activeTab}
              getBadgeCount={getBadgeCount}
            />
          </div>
        </div>
      </header>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};
