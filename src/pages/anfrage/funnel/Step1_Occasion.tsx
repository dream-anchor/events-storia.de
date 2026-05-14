import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { occasionSchema } from "./funnelSchema";
import { cn } from "@/lib/utils";
import type { Occasion, PeopleBucket } from "./types";

const OCCASIONS: { id: Occasion; label: string }[] = [
  { id: "firmenfeier", label: "Firmenfeier" },
  { id: "geburtstag", label: "Geburtstag" },
  { id: "hochzeit", label: "Hochzeit" },
  { id: "weihnachtsfeier", label: "Weihnachtsfeier" },
  { id: "privat", label: "Privater Anlass" },
  { id: "sonstiges", label: "Sonstiges" },
];

const BUCKETS: { id: PeopleBucket; label: string }[] = [
  { id: "2-10", label: "2–10" },
  { id: "11-25", label: "11–25" },
  { id: "26-50", label: "26–50" },
  { id: "51-100", label: "51–100" },
  { id: "100+", label: "100+" },
];

type Props = {
  occasion: Occasion | null;
  occasion_other: string;
  people_bucket: PeopleBucket | null;
  onChange: (patch: { occasion?: Occasion; occasion_other?: string; people_bucket?: PeopleBucket }) => void;
  onNext: () => void;
  onBack: () => void;
};

export const Step1_Occasion = ({ occasion, occasion_other, people_bucket, onChange, onNext, onBack }: Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const r = occasionSchema.safeParse({ occasion: occasion ?? undefined, occasion_other, people_bucket: people_bucket ?? undefined });
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[i.path[0] as string] = i.message;
      setErrors(e); return;
    }
    setErrors({});
    onNext();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-2">Worum geht es?</h2>
        <p className="text-muted-foreground mb-5">Wählen Sie den Anlass.</p>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange({ occasion: o.id })}
              className={cn(
                "min-h-[48px] px-4 py-2 rounded-full border text-sm md:text-base transition-all",
                occasion === o.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border hover:border-foreground/40"
              )}
              aria-pressed={occasion === o.id}
            >
              {o.label}
            </button>
          ))}
        </div>
        {errors.occasion && <p className="text-sm text-destructive mt-2">{errors.occasion}</p>}
        {occasion === "sonstiges" && (
          <div className="mt-4">
            <Input
              value={occasion_other}
              onChange={(e) => onChange({ occasion_other: e.target.value })}
              placeholder="Kurz beschreiben"
              maxLength={120}
              className="h-12"
              aria-invalid={!!errors.occasion_other}
            />
            {errors.occasion_other && <p className="text-sm text-destructive mt-1">{errors.occasion_other}</p>}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg md:text-xl font-semibold mb-3">Wie viele Personen?</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onChange({ people_bucket: b.id })}
              className={cn(
                "min-h-[48px] rounded-xl border text-sm md:text-base font-medium transition-all",
                people_bucket === b.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border hover:border-foreground/40"
              )}
              aria-pressed={people_bucket === b.id}
            >
              {b.label}
            </button>
          ))}
        </div>
        {errors.people_bucket && <p className="text-sm text-destructive mt-2">{errors.people_bucket}</p>}
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="min-h-[48px]">Zurück</Button>
        <Button onClick={submit} className="min-h-[48px] px-6">Weiter</Button>
      </div>
    </div>
  );
};