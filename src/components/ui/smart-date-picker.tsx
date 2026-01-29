import * as React from "react";
import { format, addDays, isWeekend, isSunday, startOfDay, isSameDay } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { CalendarDays, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

export interface SmartDatePickerProps {
  /** Currently selected date */
  value?: Date;
  /** Callback when date changes */
  onChange: (date: Date | undefined) => void;
  /** Language for localization (default: 'de') */
  language?: 'de' | 'en';
  /** Minimum lead time in days (default: 1 = tomorrow) */
  minLeadDays?: number;
  /** Whether to skip Sundays (default: true for events) */
  skipSundays?: boolean;
  /** Number of quick-select chips to show (default: 3) */
  quickSelectCount?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Error state */
  hasError?: boolean;
  /** Additional class names */
  className?: string;
  /** Show quick chips (default: true) */
  showQuickChips?: boolean;
}

/**
 * Get the next N available dates, optionally skipping Sundays
 */
function getNextAvailableDates(
  count: number,
  minLeadDays: number,
  skipSundays: boolean
): Date[] {
  const dates: Date[] = [];
  let currentDate = startOfDay(addDays(new Date(), minLeadDays));
  
  while (dates.length < count) {
    if (!skipSundays || !isSunday(currentDate)) {
      dates.push(currentDate);
    }
    currentDate = addDays(currentDate, 1);
  }
  
  return dates;
}

/**
 * Format a date as a quick chip label (e.g., "Mo 3. Feb")
 */
function formatQuickChipLabel(date: Date, language: 'de' | 'en'): string {
  const locale = language === 'de' ? de : enUS;
  const dayName = format(date, 'EEE', { locale });
  const dayNum = format(date, 'd', { locale });
  const month = format(date, 'MMM', { locale });
  return `${dayName} ${dayNum}. ${month}`;
}

/**
 * SmartDatePicker - A modern date picker with quick-select chips
 * 
 * Features:
 * - Quick-select chips for the next 3 available weekdays
 * - Full calendar picker (Popover on desktop, Drawer on mobile)
 * - Configurable lead time and Sunday skipping
 * - Fully localized (DE/EN)
 */
export function SmartDatePicker({
  value,
  onChange,
  language = 'de',
  minLeadDays = 1,
  skipSundays = true,
  quickSelectCount = 3,
  placeholder,
  hasError = false,
  className,
  showQuickChips = true,
}: SmartDatePickerProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);
  
  const locale = language === 'de' ? de : enUS;
  const defaultPlaceholder = language === 'de' ? 'Datum wählen...' : 'Select date...';
  
  // Calculate quick-select dates
  const quickDates = React.useMemo(
    () => getNextAvailableDates(quickSelectCount, minLeadDays, skipSundays),
    [quickSelectCount, minLeadDays, skipSundays]
  );
  
  // Minimum date for calendar
  const minDate = React.useMemo(
    () => startOfDay(addDays(new Date(), minLeadDays)),
    [minLeadDays]
  );
  
  // Check if a quick date is selected
  const isQuickDateSelected = (date: Date) => value && isSameDay(value, date);
  
  // Check if selected date is one of the quick dates
  const isValueQuickDate = value && quickDates.some(d => isSameDay(d, value));
  
  // Handle date selection
  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    setIsOpen(false);
  };
  
  // Disabled date function for calendar
  const isDateDisabled = (date: Date) => {
    if (date < minDate) return true;
    if (skipSundays && isSunday(date)) return true;
    return false;
  };
  
  // Trigger button content
  const TriggerButton = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof Button>>(
    (props, ref) => (
      <Button
        ref={ref}
        variant="outline"
        className={cn(
          "justify-start text-left font-normal gap-2",
          !value && "text-muted-foreground",
          hasError && "border-destructive",
          props.className
        )}
        {...props}
      >
        <CalendarDays className="h-4 w-4 shrink-0" />
        {value ? format(value, 'PPP', { locale }) : (placeholder || defaultPlaceholder)}
        <ChevronRight className="h-4 w-4 ml-auto shrink-0 opacity-50" />
      </Button>
    )
  );
  TriggerButton.displayName = "TriggerButton";
  
  // Calendar content (shared between Popover and Drawer)
  const CalendarContent = (
    <Calendar
      mode="single"
      selected={value}
      onSelect={handleSelect}
      disabled={isDateDisabled}
      locale={locale}
      initialFocus
      className="p-3 pointer-events-auto"
    />
  );
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* Quick-select chips */}
      {showQuickChips && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {quickDates.map((date, index) => (
            <Button
              key={index}
              type="button"
              variant={isQuickDateSelected(date) ? "default" : "outline"}
              size="sm"
              className={cn(
                "shrink-0 text-sm px-3 h-9 transition-all",
                isQuickDateSelected(date) && "ring-2 ring-primary/20"
              )}
              onClick={() => onChange(date)}
            >
              {formatQuickChipLabel(date, language)}
            </Button>
          ))}
          
          {/* "More" button to open full calendar */}
          {isMobile ? (
            <Drawer open={isOpen} onOpenChange={setIsOpen}>
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant={value && !isValueQuickDate ? "default" : "ghost"}
                  size="sm"
                  className="shrink-0 text-sm px-3 h-9"
                >
                  {value && !isValueQuickDate 
                    ? format(value, 'd. MMM', { locale })
                    : (language === 'de' ? 'Andere...' : 'Other...')}
                </Button>
              </DrawerTrigger>
              <DrawerContent className="pb-6">
                <div className="mx-auto w-full max-w-sm px-4 pt-4">
                  <h3 className="text-lg font-medium mb-4 text-center">
                    {language === 'de' ? 'Datum wählen' : 'Select Date'}
                  </h3>
                  <div className="flex justify-center">
                    {CalendarContent}
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={value && !isValueQuickDate ? "default" : "ghost"}
                  size="sm"
                  className="shrink-0 text-sm px-3 h-9"
                >
                  {value && !isValueQuickDate 
                    ? format(value, 'd. MMM', { locale })
                    : (language === 'de' ? 'Andere...' : 'Other...')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                {CalendarContent}
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
      
      {/* Fallback full-width trigger (when quick chips are hidden) */}
      {!showQuickChips && (
        isMobile ? (
          <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>
              <TriggerButton className="w-full" />
            </DrawerTrigger>
            <DrawerContent className="pb-6">
              <div className="mx-auto w-full max-w-sm px-4 pt-4">
                <h3 className="text-lg font-medium mb-4 text-center">
                  {language === 'de' ? 'Datum wählen' : 'Select Date'}
                </h3>
                <div className="flex justify-center">
                  {CalendarContent}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <TriggerButton className="w-full" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {CalendarContent}
            </PopoverContent>
          </Popover>
        )
      )}
    </div>
  );
}
