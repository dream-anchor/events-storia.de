import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileBottomBarProps {
  children: ReactNode;
  className?: string;
  /** When true, only render on mobile (< lg). Default true. */
  mobileOnly?: boolean;
}

/**
 * Fixed bottom container for primary mobile actions.
 * Honors iOS safe-area-inset-bottom and stays above FloatingPillNav (z-40).
 * Hidden on lg+ by default — desktop should keep its inline action bar.
 */
export function MobileBottomBar({ children, className, mobileOnly = true }: MobileBottomBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]",
        mobileOnly && "lg:hidden",
        className
      )}
    >
      {children}
    </div>
  );
}