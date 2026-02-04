import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";
import { usePendingMenuBookingsCount } from "@/hooks/useEventBookings";
import { FloatingPillNav, MobilePillNav, MobileBottomNav } from "./FloatingPillNav";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { UserProfileDropdown } from "../shared/UserProfileDropdown";
import { NotificationCenter } from "../shared/NotificationCenter";

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
      {/* Header with Glassmorphism - Apple 2026 Experience */}
      <motion.header
        className="sticky top-0 z-50 glass-header"
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
      >
        <div className="container mx-auto px-[var(--space-4)] py-[var(--space-2)]">
          <div className="flex items-center justify-between gap-[var(--space-4)]">
            {/* Logo with subtle animation */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Link to="/admin" className="flex items-center gap-2 shrink-0">
                <span className="font-sans text-xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
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
            <div className="flex items-center gap-[var(--space-2)]">
              {/* Search Field Trigger - Apple 2026 Glass Style */}
              <motion.div whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommandOpen(true)}
                  className="hidden sm:flex items-center gap-2 text-muted-foreground rounded-[var(--radius-2xl)] h-10 px-4 min-w-[200px] justify-start glass-subtle hover:glass-card transition-all duration-200"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-sm">Suche...</span>
                  <kbd className="ml-auto text-xs text-muted-foreground/60 hidden lg:inline">
                    ⌘K
                  </kbd>
                </Button>
              </motion.div>

              {/* Notification Center */}
              <NotificationCenter />

              <UserProfileDropdown />
            </div>
          </div>

          {/* Mobile Secondary Navigation (Horizontal Scroll) */}
          <div className="mt-[var(--space-2)] md:hidden">
            <MobilePillNav
              activeKey={activeTab}
              getBadgeCount={getBadgeCount}
            />
          </div>
        </div>
      </motion.header>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Main Content - Apple 2026 Experience: 8pt Grid */}
      <motion.main
        className="container mx-auto px-[var(--space-4)] py-[var(--space-6)] pb-24 md:pb-[var(--space-6)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        {children}
      </motion.main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav getBadgeCount={getBadgeCount} />
    </div>
  );
};
