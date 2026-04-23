import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileCardItemProps {
  /** Optional leading icon or avatar */
  leading?: ReactNode;
  /** Primary line — usually a name or number */
  title: ReactNode;
  /** Secondary line — date, customer, etc. */
  subtitle?: ReactNode;
  /** Status badge, amount, or any meta on the right */
  trailing?: ReactNode;
  /** Optional small helper line below subtitle */
  meta?: ReactNode;
  onClick?: () => void;
  className?: string;
  /** Show a chevron on the right (default true when onClick) */
  showChevron?: boolean;
}

export function MobileCardItem({
  leading,
  title,
  subtitle,
  trailing,
  meta,
  onClick,
  className,
  showChevron,
}: MobileCardItemProps) {
  const interactive = !!onClick;
  const chevron = showChevron ?? interactive;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "w-full text-left rounded-2xl border border-border/60 bg-white dark:bg-gray-900 p-4 shadow-sm",
        "flex items-start gap-3 transition-colors",
        interactive && "hover:bg-muted/40 active:bg-muted/60 cursor-pointer",
        !interactive && "cursor-default",
        className
      )}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-sm truncate">{title}</div>
          {trailing && <div className="shrink-0 text-right">{trailing}</div>}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </div>
      {chevron && (
        <ChevronRight className="h-4 w-4 text-muted-foreground self-center shrink-0" />
      )}
    </button>
  );
}

interface MobileCardListProps {
  children: ReactNode;
  className?: string;
}

export function MobileCardList({ children, className }: MobileCardListProps) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}