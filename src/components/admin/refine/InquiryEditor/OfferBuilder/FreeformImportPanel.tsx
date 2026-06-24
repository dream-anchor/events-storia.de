import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/typed-client";
import type { FreeformProgram, ValidationFinding } from "./types";

interface FreeformImportPanelProps {
  onParsed: (program: FreeformProgram, findings?: ValidationFinding[]) => void;
  disabled?: boolean;
}

const MAX_RETRIES = 2;

async function invokeFn<T = unknown>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let detail = error.message;
    try {
      const resp = (error as { context?: { response?: Response } }).context?.response;
      if (resp) {
        const t = await resp.clone().text();
        try {
          const j = JSON.parse(t);
          detail = j?.error || t || detail;
        } catch {
          detail = t || detail;
        }
      }
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return data as T;
}

function ensureIds(program: FreeformProgram): FreeformProgram {
  return {
    ...program,
    days: (program.days ?? []).map((d, i) => ({
      ...d,
      id: d.id || `day-${i}-${crypto.randomUUID()}`,
      dateLabel: d.dateLabel ?? "",
      meals: (d.meals || []).map((m, j) => ({
        ...m,
        id: m.id || `meal-${i}-${j}-${crypto.randomUUID()}`,
        guestCount: typeof m.guestCount === "number" ? m.guestCount : 0,
        flatPriceNet: typeof m.flatPriceNet === "number" ? m.flatPriceNet : 0,
        vatRate: typeof m.vatRate === "number" ? m.vatRate : 7,
        sections: Array.isArray(m.sections) ? m.sections : [],
      })),
    })),
  };
}

/**
 * Fallback: KI hat keine Tage erkannt. Wir bauen einen synthetischen 1-Tages-Container
 * mit einer Mahlzeit "Leistungen" und packen den Rohtext als Items hinein, damit der
 * Operator manuell weiterarbeiten kann statt einen harten Fehler zu sehen.
 */
function syntheticSingleDay(program: FreeformProgram, rawText: string): FreeformProgram {
  const items = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 200);
  return ensureIds({
    ...program,
    days: [
      {
        id: "",
        dateLabel: "",
        meals: [
          {
            id: "",
            label: "Leistungen",
            guestCount: 0,
            flatPriceNet: 0,
            vatRate: 7,
            sections: [{ heading: null, items }],
          },
        ],
      },
    ],
  });
}

/**
 * Eingabe-Panel für mehrtägige Catering-Angebote als Freitext.
 * Pipeline: parse-freeform-offer (Gemini) → validate-freeform-offer (GPT-5 Red Team).
 * Bei Findings: bis zu 2 Auto-Retries mit Korrektur-Hinweisen. Restliche Findings
 * werden an den Editor durchgereicht.
 */
export function FreeformImportPanel({ onParsed, disabled }: FreeformImportPanelProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (text.trim().length < 50) {
      setError("Bitte vollständigen Angebotstext einfügen (mind. 50 Zeichen).");
      return;
    }
    setBusy(true);
    setError(null);
    setStage("KI parst Angebot…");
    try {
      let correctionHints: string[] = [];
      let program: FreeformProgram | null = null;
      let findings: ValidationFinding[] = [];
      let attempt = 0;

      while (attempt <= MAX_RETRIES) {
        setStage(
          attempt === 0
            ? "KI parst Angebot…"
            : `Red Team korrigiert (Versuch ${attempt + 1}/${MAX_RETRIES + 1})…`,
        );
        const parseRes = await invokeFn<{ success?: boolean; program?: FreeformProgram; error?: string }>(
          "parse-freeform-offer",
          { text, correctionHints },
        );
        if (!parseRes?.success || !parseRes.program) {
          throw new Error(parseRes?.error || "KI-Antwort ohne Programm-Daten.");
        }
        program = ensureIds(parseRes.program);
        if (!program.days || program.days.length === 0) {
          // Einfaches Angebot ohne Tagesstruktur → synthetischen 1-Tages-Container bauen.
          program = syntheticSingleDay(program, text);
        }

        setStage("Red Team validiert…");
        try {
          const valRes = await invokeFn<{
            success?: boolean;
            ok?: boolean;
            findings?: ValidationFinding[];
            summary?: string;
          }>("validate-freeform-offer", {
            rawText: program.rawText ?? text,
            program,
          });
          findings = Array.isArray(valRes?.findings) ? valRes.findings : [];
          if (valRes?.ok) {
            findings = [];
            break;
          }
          if (attempt >= MAX_RETRIES) break;
          // Retry mit Korrektur-Hinweisen
          correctionHints = findings.slice(0, 12).map((f) => {
            const exp = f.expected ? ` (erwartet: ${f.expected}` : "";
            const act = f.actual ? `, war: ${f.actual})` : exp ? ")" : "";
            return `${f.message}${exp}${act}`;
          });
          attempt++;
        } catch (validatorErr) {
          // Validator-Ausfall ist nicht blockierend
          console.warn("Validator failed, übernehme Programm ohne Validierung:", validatorErr);
          toast.warning("Red Team nicht erreichbar — Programm ohne Validierung übernommen.");
          findings = [];
          break;
        }
      }

      if (!program) throw new Error("Kein Programm erzeugt.");

      onParsed(program, findings);
      const dayCount = program.days.length;
      const successMsg =
        dayCount === 1 ? "Angebot importiert & validiert ✓" : `Programm mit ${dayCount} Tagen importiert & validiert ✓`;
      const warnMsg =
        dayCount === 1
          ? `Angebot importiert — Red Team meldet ${findings.length} Abweichung(en). Bitte prüfen.`
          : `Programm importiert — Red Team meldet ${findings.length} Abweichung(en). Bitte prüfen.`;
      if (findings.length === 0) {
        toast.success(successMsg);
      } else {
        toast.warning(warnMsg);
      }
      setText("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
      toast.error(`Import fehlgeschlagen: ${msg}`);
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Füge ein vollständiges Catering-Angebot als Text ein — die KI erstellt automatisch
          ein strukturiertes mehrtägiges Programm inkl. Preisen und MwSt.
        </p>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="VORLÄUFIGES CATERING-ANGEBOT&#10;&#10;Projekt – Spike Week 2026&#10;29.06.2026 – 02.07.2026&#10;Location, München&#10;&#10;MONTAG, 29.06.2026&#10;&#10;Lunch | 25 Personen&#10;..."
        rows={18}
        className="font-mono text-xs leading-relaxed rounded-xl"
        disabled={disabled || busy}
      />
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {text.length.toLocaleString("de-DE")} Zeichen
        </span>
        <Button
          onClick={handleParse}
          disabled={disabled || busy || text.trim().length < 50}
          className="gap-2 rounded-xl"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {stage || "KI analysiert…"}
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Mit KI umwandeln + Red Team prüfen
            </>
          )}
        </Button>
      </div>
    </div>
  );
}