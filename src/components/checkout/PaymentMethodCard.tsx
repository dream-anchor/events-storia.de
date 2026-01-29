import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface PaymentMethodCardProps {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: "default" | "blue" | "green";
  icon: ReactNode;
  logos?: ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
}

const PaymentMethodCard = ({
  id,
  title,
  subtitle,
  badge,
  badgeColor = "default",
  icon,
  logos,
  isSelected,
  onSelect,
  className,
}: PaymentMethodCardProps) => {
  const badgeColors = {
    default: "bg-muted text-muted-foreground",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-xl border-2 text-left transition-all duration-200",
        "hover:border-gray-400 hover:bg-gray-50/50 dark:hover:border-gray-500 dark:hover:bg-gray-800/30",
        "focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:ring-offset-2",
        isSelected
          ? "border-gray-800 bg-gray-50 shadow-sm dark:border-gray-200 dark:bg-gray-800/50"
          : "border-border bg-card",
        className
      )}
    >
      <div className="flex items-start gap-4">
        {/* Radio indicator */}
        <div
          className={cn(
            "mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            isSelected
              ? "border-gray-900 bg-gray-900 dark:border-white dark:bg-white"
              : "border-muted-foreground/40"
          )}
        >
          {isSelected && <Check className="h-3 w-3 text-white dark:text-gray-900" />}
        </div>

        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
            isSelected ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100" : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-base">{title}</span>
            {badge && (
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  badgeColors[badgeColor]
                )}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
          {logos && <div className="mt-3">{logos}</div>}
        </div>
      </div>
    </button>
  );
};

export default PaymentMethodCard;
