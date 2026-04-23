import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ScrollableTabsProps {
  children: ReactNode;
  className?: string;
  /** Index of the currently active tab — when set, that tab will be auto-scrolled into view. */
  activeIndex?: number;
}

/**
 * Horizontal scroll container with snap behaviour for pill/tab rows on mobile.
 * Children should render their own button/pill markup.
 */
export function ScrollableTabs({ children, className, activeIndex }: ScrollableTabsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof activeIndex !== "number" || !ref.current) return;
    const child = ref.current.children[activeIndex] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  return (
    <div
      ref={ref}
      className={cn(
        "flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-3 px-3 pb-1",
        className
      )}
    >
      {children}
    </div>
  );
}