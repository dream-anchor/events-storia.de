import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogout, useGetIdentity } from "@refinedev/core";
import { LogOut, ExternalLink, LayoutDashboard, CalendarDays, UtensilsCrossed, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import storiaLogo from "@/assets/storia-logo.webp";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab?: string;
}

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, key: 'dashboard' },
  { name: 'Events', href: '/admin/events', icon: CalendarDays, key: 'events', badge: 'events' },
  { name: 'Bestellungen', href: '/admin/orders', icon: FileText, key: 'orders', badge: 'orders' },
  { name: 'Pakete', href: '/admin/packages', icon: Package, key: 'packages' },
  { name: 'Speisen & Getränke', href: '/admin/menu', icon: UtensilsCrossed, key: 'menu' },
];

export const AdminLayout = ({ children, activeTab }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<{ email: string }>();
  const { data: newInquiriesCount } = useNewInquiriesCount();
  const { data: pendingOrdersCount } = usePendingOrdersCount();

  const getBadgeCount = (key?: string) => {
    if (key === 'events') return newInquiriesCount || 0;
    if (key === 'orders') return pendingOrdersCount || 0;
    return 0;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-3">
                <img 
                  src={storiaLogo} 
                  alt="STORIA" 
                  className="h-8 hover:opacity-80 transition-opacity" 
                />
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const badgeCount = getBadgeCount(item.badge);
                  
                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        activeTab === item.key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                      {badgeCount > 0 && (
                        <Badge variant="secondary" className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0">
                          {badgeCount}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-sm text-muted-foreground">
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
          <nav className="flex md:hidden items-center gap-1 mt-3 -mx-1 overflow-x-auto pb-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const badgeCount = getBadgeCount(item.badge);
              
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                    activeTab === item.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground bg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.name}
                  {badgeCount > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};
