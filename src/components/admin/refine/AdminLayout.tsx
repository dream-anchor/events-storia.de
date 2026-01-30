import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogout, useGetIdentity } from "@refinedev/core";
import { LogOut, Command, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";
import { usePendingMenuBookingsCount } from "@/hooks/useEventBookings";
import { FloatingPillNav, MobilePillNav, MobileBottomNav } from "./FloatingPillNav";
import { CommandPalette, useCommandPalette } from "./CommandPalette";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab?: string;
}

const getInitials = (name?: string) => {
  if (!name) return 'A';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const AdminLayout = ({ children, activeTab }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<{ email: string; name?: string }>();
  const { data: newInquiriesCount } = useNewInquiriesCount();
  const { data: pendingOrdersCount } = usePendingOrdersCount();
  const { data: pendingBookingsCount } = usePendingMenuBookingsCount();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();

  const getBadgeCount = (key?: string) => {
    if (key === 'events') return newInquiriesCount || 0;
    if (key === 'bookings') return pendingBookingsCount || 0;
    if (key === 'orders') return pendingOrdersCount || 0;
    return 0;
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] admin-layout">
      {/* Header with Glassmorphism */}
      <header className="sticky top-0 z-50 glass-header">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo with subtle animation */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link to="/admin" className="flex items-center gap-2 shrink-0">
                <span className="font-serif text-xl font-semibold tracking-tight">
                  StoriaMaestro
                </span>
              </Link>
            </motion.div>
            
            {/* Floating Pill Navigation (Desktop) */}
            <FloatingPillNav 
              activeKey={activeTab}
              getBadgeCount={getBadgeCount}
            />
            
            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Command Palette Trigger */}
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCommandOpen(true)}
                  className="hidden sm:flex items-center gap-2 text-muted-foreground rounded-2xl"
                >
                  <Command className="h-3.5 w-3.5" />
                  <span className="text-sm">⌘K</span>
                </Button>
              </motion.div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 rounded-2xl px-2 h-10"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(identity?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:block text-sm font-medium max-w-[120px] truncate">
                      {identity?.name}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-3 py-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(identity?.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{identity?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {identity?.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => logout()}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
