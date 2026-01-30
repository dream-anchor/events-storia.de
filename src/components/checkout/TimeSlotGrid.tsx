import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Clock } from "lucide-react";

interface TimeSlotGridProps {
  value: string;
  onChange: (time: string) => void;
  isPizzaOnly?: boolean;
  isEventBooking?: boolean;
  className?: string;
}

interface TimeGroup {
  label: string;
  labelEn: string;
  slots: string[];
}

/**
 * Generates time slots based on delivery type:
 * - Event (In-Haus): 17:30 - 21:30 (30 min intervals)
 * - Delivery: 09:00 - 22:00 (30 min intervals)
 * - Pizza: 12:00-14:30 and 18:00-22:30
 */
const TimeSlotGrid = ({ value, onChange, isPizzaOnly = false, isEventBooking = false, className }: TimeSlotGridProps) => {
  const { language } = useLanguage();

  // Event times: 17:30-21:30 (In-Haus Event)
  // Pizza times: 12:00-14:30 and 18:00-22:30
  // Delivery times: 09:00-22:00
  const timeGroups: TimeGroup[] = isEventBooking
    ? [
        {
          label: "Abend",
          labelEn: "Evening",
          slots: ["17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"],
        },
      ]
    : isPizzaOnly
    ? [
        {
          label: "Mittag",
          labelEn: "Lunch",
          slots: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30"],
        },
        {
          label: "Abend",
          labelEn: "Evening",
          slots: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"],
        },
      ]
    : [
        {
          label: "Vormittag",
          labelEn: "Morning",
          slots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
        },
        {
          label: "Mittag",
          labelEn: "Lunch",
          slots: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30"],
        },
        {
          label: "Nachmittag",
          labelEn: "Afternoon",
          slots: ["15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
        },
        {
          label: "Abend",
          labelEn: "Evening",
          slots: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"],
        },
      ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>
          {isEventBooking
            ? (language === "de" ? "Event-Startzeit wählen" : "Select event start time")
            : (language === "de" ? "Gewünschte Uhrzeit wählen" : "Select preferred time")
          }
        </span>
      </div>

      {timeGroups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {language === "de" ? group.label : group.labelEn}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.slots.map((slot) => {
              const isSelected = value === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onChange(slot)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-full border-2 transition-all duration-200",
                    "hover:border-amber-600 hover:bg-amber-50 dark:hover:border-amber-500 dark:hover:bg-amber-900/20",
                    "focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:ring-offset-2",
                    isSelected
                      ? "border-amber-800 bg-amber-800 text-white dark:border-amber-600 dark:bg-amber-700 dark:text-white"
                      : "border-border bg-background text-foreground"
                  )}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimeSlotGrid;
