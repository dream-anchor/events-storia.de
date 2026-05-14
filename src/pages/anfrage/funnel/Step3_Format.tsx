import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatSchema } from "./funnelSchema";
import { cn } from "@/lib/utils";
import type { Format, Intent } from "./types";

const INHOUSE_OPTIONS: { id: Format; label: string; desc: string }[] = [
  { id: "a_la_carte", label: "À la carte", desc: "Klassisch aus der Karte." },
  { id: "3_gaenge", label: "3-Gänge-Menü", desc: "Vorspeise, Hauptgang, Dessert." },
  { id: "aperitivo_flying_buffet", label: "Aperitivo + Flying Buffet", desc: "Stehend, locker, gesellig." },
  { id: "exklusivmiete", label: "Exklusivmiete", desc: "Restaurant nur für Sie." },
  { id: "beratung", label: "Noch unsicher", desc: "Wir beraten Sie." },
];

const DELIVERY_OPTIONS: { id: Format; label: string; desc: string }[] = [
  { id: "fingerfood", label: "Fingerfood", desc: "Häppchen, Antipasti, Snacks." },
  { id: "pizza_napoletana", label: "Pizza Napoletana", desc: "Mit mobilem Holzofen." },
  { id: "warme_auflaeufe", label: "Warme Aufläufe", desc: "Lasagne, Pasta al forno." },
  { id: "komplett_buffet", label: "Komplett-Buffet", desc: "Vorspeisen bis Dessert." },
  { id: "beratung", label: "Noch unsicher", desc: "Wir beraten Sie." },
];

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
    if (!r.success) { setError("Bitte wählen."); return; }
    setError(""); onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-2">
          {intent === "delivery" ? "Welches Format passt?" : "Wie soll der Abend laufen?"}
        </h2>
        <p className="text-muted-foreground mb-5">Eine Richtung reicht — Details klären wir gemeinsam.</p>
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
        <Button variant="ghost" onClick={onBack} className="min-h-[48px]">Zurück</Button>
        <Button onClick={submit} className="min-h-[48px] px-6">Weiter</Button>
      </div>
    </div>
  );
};