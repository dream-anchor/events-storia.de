import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dateSchema } from "./funnelSchema";
import { cn } from "@/lib/utils";
import type { DateMode } from "./types";
import { FUNNEL_DE } from "./i18n/de";

const TABS: { id: DateMode; label: string; desc: string }[] = (
  ["fixed", "flexible", "open"] as DateMode[]
).map((id) => ({ id, label: FUNNEL_DE.step2.tabs[id].label, desc: FUNNEL_DE.step2.tabs[id].desc }));

type Props = {
  date_mode: DateMode | null;
  date_value: string;
  date_range_start: string;
  date_range_end: string;
  onChange: (patch: { date_mode?: DateMode; date_value?: string; date_range_start?: string; date_range_end?: string }) => void;
  onNext: () => void;
  onBack: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export const Step2_Date = ({ date_mode, date_value, date_range_start, date_range_end, onChange, onNext, onBack }: Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const r = dateSchema.safeParse({
      date_mode: date_mode ?? undefined,
      date_value, date_range_start, date_range_end,
    });
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[i.path[0] as string] = i.message;
      if (!date_mode) e.date_mode = FUNNEL_DE.step2.err_pick;
      setErrors(e); return;
    }
    if (!date_mode) { setErrors({ date_mode: FUNNEL_DE.step2.err_pick }); return; }
    setErrors({}); onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-2">{FUNNEL_DE.step2.heading}</h2>
        <p className="text-muted-foreground mb-5">{FUNNEL_DE.step2.subline}</p>
        <div role="tablist" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={date_mode === t.id}
              onClick={() => onChange({ date_mode: t.id })}
              className={cn(
                "min-h-[64px] rounded-xl border p-3 text-left transition-all",
                date_mode === t.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border hover:border-foreground/40"
              )}
            >
              <div className="font-semibold">{t.label}</div>
              <div className={cn("text-xs mt-0.5", date_mode === t.id ? "opacity-80" : "text-muted-foreground")}>{t.desc}</div>
            </button>
          ))}
        </div>
        {errors.date_mode && <p className="text-sm text-destructive mt-2">{errors.date_mode}</p>}
      </div>

      {date_mode === "fixed" && (
        <div>
          <label className="block text-sm font-medium mb-1">{FUNNEL_DE.step2.date_label}</label>
          <Input
            type="date"
            value={date_value}
            min={today()}
            onChange={(e) => onChange({ date_value: e.target.value })}
            className="h-12 max-w-xs"
            aria-invalid={!!errors.date_value}
          />
          {errors.date_value && <p className="text-sm text-destructive mt-1">{errors.date_value}</p>}
        </div>
      )}

      {date_mode === "flexible" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1">{FUNNEL_DE.step2.from_label}</label>
            <Input type="date" value={date_range_start} min={today()} onChange={(e) => onChange({ date_range_start: e.target.value })} className="h-12" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{FUNNEL_DE.step2.to_label}</label>
            <Input type="date" value={date_range_end} min={date_range_start || today()} onChange={(e) => onChange({ date_range_end: e.target.value })} className="h-12" />
          </div>
          {(errors.date_range_start || errors.date_range_end) && (
            <p className="sm:col-span-2 text-sm text-destructive">{errors.date_range_start || errors.date_range_end}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="min-h-[48px]">{FUNNEL_DE.common.zurueck}</Button>
        <Button onClick={submit} className="min-h-[48px] px-6">{FUNNEL_DE.common.weiter}</Button>
      </div>
    </div>
  );
};