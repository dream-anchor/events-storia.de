import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeSlotPickerProps {
  value: string;
  onChange: (time: string) => void;
  className?: string;
}

const TimeSlotPicker = ({ value, onChange, className }: TimeSlotPickerProps) => {
  const { language } = useLanguage();
  
  // Generate time slots from 10:00 to 21:30 in 30-minute intervals
  const slots = Array.from({ length: 24 }, (_, i) => {
    const hour = 10 + Math.floor(i / 2);
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  });

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm text-muted-foreground">
        {language === 'de' ? 'Gewünschte Uhrzeit' : 'Preferred Time'}
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {slots.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onChange(slot)}
            className={cn(
              "px-3 py-2 text-sm rounded-md border transition-all",
              "hover:border-primary hover:bg-primary/5",
              "focus:outline-none focus:ring-2 focus:ring-primary/20",
              value === slot
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border"
            )}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeSlotPicker;
