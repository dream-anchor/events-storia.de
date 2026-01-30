import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Command } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";
import { usePendingMenuBookingsCount } from "@/hooks/useEventBookings";
import { FloatingPillNav, MobilePillNav, MobileBottomNav } from "./FloatingPillNav";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { UserProfileDropdown } from "../shared/UserProfileDropdown";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab?: string;
}

export const AdminLayout = ({ children, activeTab }: AdminLayoutProps) => {
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

              <UserProfileDropdown />
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
