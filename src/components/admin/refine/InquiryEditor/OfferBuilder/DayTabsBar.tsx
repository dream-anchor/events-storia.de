import { Plus, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DayView } from './menuDaysHelpers';

interface DayTabsBarProps {
  days: DayView[];
  activeDayId: string;
  onSelect: (dayId: string) => void;
  onAdd: () => void;
  onRemove: (dayId: string) => void;
  onRenameActive: (label: string) => void;
  disabled?: boolean;
}

/**
 * Tages-Tab-Leiste über dem Menü-Wizard. Wird NUR gerendert, wenn eine Option
 * mehrere Tages-Menüs enthält (mehrtägiges Angebot). Bei 1 Tag ist das
 * gesamte Wizard-UI visuell identisch zum handgemachten Menü.
 */
export function DayTabsBar({
  days,
  activeDayId,
  onSelect,
  onAdd,
  onRemove,
  onRenameActive,
  disabled,
}: DayTabsBarProps) {
  const activeDay = days.find((d) => d.id === activeDayId) ?? days[0];

  return (
    <div className="mb-3 rounded-xl border border-border/40 bg-muted/20 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {days.map((d) => {
          const isActive = d.id === activeDayId;
          const label = [d.dateLabel, d.mealLabel].filter(Boolean).join(' · ') || `Tag ${days.indexOf(d) + 1}`;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              disabled={disabled}
              className={cn(
                'group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              title={label}
            >
              <Calendar className={cn('h-3 w-3 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/60')} />
              <span className="max-w-[180px] truncate">{label}</span>
              {isActive && days.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(d.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove(d.id);
                    }
                  }}
                  className="ml-1 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                  title="Tag entfernen"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAdd}
          disabled={disabled}
          className="h-7 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Tag hinzufügen
        </Button>
      </div>

      {/* Tages-Metadaten (Label bearbeiten) */}
      {activeDay && (
        <div className="mt-2 flex items-center gap-2 border-t border-border/30 pt-2">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
            Tages-Bezeichnung
          </label>
          <Input
            value={activeDay.dateLabel}
            onChange={(e) => onRenameActive(e.target.value)}
            disabled={disabled}
            placeholder="z.B. Mo 29.06. Lunch"
            className="h-7 text-xs bg-background/60"
          />
        </div>
      )}
    </div>
  );
}