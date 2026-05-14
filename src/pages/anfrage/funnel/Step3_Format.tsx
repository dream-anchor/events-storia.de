import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatSchema } from "./funnelSchema";
import { cn } from "@/lib/utils";
import type { Format, Intent } from "./types";
import { FUNNEL_DE } from "./i18n/de";

const INHOUSE_OPTIONS: { id: Format; label: string; desc: string }[] = (
  ["a_la_carte", "3_gaenge", "aperitivo_flying_buffet", "exklusivmiete", "beratung"] as Format[]
).map((id) => ({ id, label: FUNNEL_DE.step3.inhouse[id as keyof typeof FUNNEL_DE.step3.inhouse].label, desc: FUNNEL_DE.step3.inhouse[id as keyof typeof FUNNEL_DE.step3.inhouse].desc }));

const DELIVERY_OPTIONS: { id: Format; label: string; desc: string }[] = (
  ["fingerfood", "pizza_napoletana", "warme_auflaeufe", "komplett_buffet", "beratung"] as Format[]
).map((id) => ({ id, label: FUNNEL_DE.step3.delivery[id as keyof typeof FUNNEL_DE.step3.delivery].label, desc: FUNNEL_DE.step3.delivery[id as keyof typeof FUNNEL_DE.step3.delivery].desc }));

type Props = {
  intent: Intent;
  format: Format | null;
  onChange: (patch: { format: Format }) => void;
  onNext: () => void;
  onBack: () => void;
};

export const Step3_Format = ({ intent, format, onChange, onNext, onBack }: Props) => {
  const [error, setError] = useState<string>("");
  const options = intent === "delivery" ? DELIVERY_OPTIONS : INHOUSE_OPTIONS;

  const submit = () => {
    const r = formatSchema.safeParse({ format: format ?? undefined });
    if (!r.success) { setError(FUNNEL_DE.step3.err_pick); return; }
    setError(""); onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-2">
          {intent === "delivery" ? FUNNEL_DE.step3.heading_delivery : FUNNEL_DE.step3.heading_inhouse}
        </h2>
        <p className="text-muted-foreground mb-5">{FUNNEL_DE.step3.subline}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange({ format: o.id })}
            className={cn(
              "min-h-[72px] text-left rounded-xl border p-4 transition-all",
              format === o.id ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:border-foreground/40"
            )}
            aria-pressed={format === o.id}
          >
            <div className="font-semibold">{o.label}</div>
            <div className={cn("text-sm mt-1", format === o.id ? "opacity-80" : "text-muted-foreground")}>{o.desc}</div>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="min-h-[48px]">{FUNNEL_DE.common.zurueck}</Button>
        <Button onClick={submit} className="min-h-[48px] px-6">{FUNNEL_DE.common.weiter}</Button>
      </div>
    </div>
  );
};