import { totalSteps, type Intent } from "./types";
import { cn } from "@/lib/utils";

/**
 * 5-Dot-Progress (4 wenn intent=consult). Sichtbar ab Step 1.
 */
export const ProgressBar = ({ step, intent }: { step: number; intent: Intent | null }) => {
  if (step < 1) return null;
  const total = totalSteps(intent);
  // visible step index (1..total)
  let visible = step;
  if (intent === "consult" && step >= 4) visible = step - 1; // skipped Format
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={Math.min(visible, total)}
      aria-label={`Schritt ${Math.min(visible, total)} von ${total}`}
      className="flex items-center justify-center gap-2 mb-8"
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 rounded-full transition-all",
            i + 1 <= visible ? "w-8 bg-foreground/80" : "w-2 bg-foreground/15"
          )}
        />
      ))}
    </div>
  );
};