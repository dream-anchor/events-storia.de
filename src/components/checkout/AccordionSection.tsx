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
}: AccordionSectionProps) => {
  const { language } = useLanguage();
  const displayTitle = language === 'en' && titleEn ? titleEn : title;

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
            isCompleted && "bg-green-100 text-green-600 border-2 border-green-600",
            isOpen && !isCompleted && "bg-amber-50 text-amber-900 border-2 border-amber-800 dark:bg-amber-900 dark:text-amber-50 dark:border-amber-400",
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
          <span className="flex items-center gap-1 text-sm text-amber-800 dark:text-amber-400 hover:underline">
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

      {/* Content */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-2 border-t border-border">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccordionSection;
