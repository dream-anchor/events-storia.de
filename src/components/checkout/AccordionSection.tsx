import { ReactNode } from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface AccordionSectionProps {
  stepNumber: number;
  title: string;
  titleEn?: string;
  isOpen: boolean;
  isCompleted: boolean;
  completedSummary?: string;
  onToggle: () => void;
  onEdit?: () => void;
  children: ReactNode;
  className?: string;
  hideHeader?: boolean;
}

const AccordionSection = ({
  stepNumber,
  title,
  titleEn,
  isOpen,
  isCompleted,
  completedSummary,
  onToggle,
  onEdit,
  children,
  className,
  hideHeader = false,
}: AccordionSectionProps) => {
  const { language } = useLanguage();
  const displayTitle = language === 'en' && titleEn ? titleEn : title;

  // If hideHeader is true and section is open, show only content without header/border
  // IMPORTANT: Must include pointer-events-auto for mobile touch compatibility
  if (hideHeader && isOpen) {
    return (
      <div
        className={cn("pt-6 pointer-events-auto", className)}
        style={{ visibility: 'visible' }}
      >
        {children}
      </div>
    );
  }

  // If hideHeader is true and section is not open AND not completed, don't render anything
  // Completed sections should always be visible so users can edit them
  if (hideHeader && !isOpen && !isCompleted) {
    return null;
  }

  return (
    <div
      className={cn(
        "border border-border rounded-xl bg-card overflow-hidden transition-all duration-300",
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={isCompleted && !isOpen ? onEdit : onToggle}
        className={cn(
          "w-full flex items-center gap-4 p-5 text-left transition-colors",
          !isOpen && "hover:bg-muted/50"
        )}
        aria-expanded={isOpen}
      >
        {/* Step indicator */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
            isCompleted && "bg-neutral-200 text-neutral-700 border-2 border-neutral-500 dark:bg-neutral-700 dark:text-neutral-200 dark:border-neutral-500",
            isOpen && !isCompleted && "bg-neutral-100 text-neutral-800 border-2 border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-500",
            !isCompleted && !isOpen && "bg-muted text-muted-foreground"
          )}
        >
          {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
        </div>

        {/* Title and summary */}
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-lg font-medium">{displayTitle}</h2>
          {isCompleted && !isOpen && completedSummary && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {completedSummary}
            </p>
          )}
        </div>

        {/* Chevron / Edit */}
        {isCompleted && !isOpen ? (
          <span className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
            <Pencil className="h-3.5 w-3.5" />
            {language === 'de' ? 'Bearbeiten' : 'Edit'}
          </span>
        ) : (
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-300",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Content - Using max-height instead of CSS Grid for better mobile compatibility */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isOpen
            ? "max-h-[2000px] opacity-100 pointer-events-auto"
            : "max-h-0 opacity-0 pointer-events-none"
        )}
        style={{
          // Ensure content is accessible on mobile
          visibility: isOpen ? 'visible' : 'hidden',
        }}
      >
        <div className="px-5 pb-5 pt-2 border-t border-border">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AccordionSection;
