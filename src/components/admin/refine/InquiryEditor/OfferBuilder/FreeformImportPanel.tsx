import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/typed-client";
import type { FreeformProgram } from "./types";

interface FreeformImportPanelProps {
  onParsed: (program: FreeformProgram) => void;
  disabled?: boolean;
}

/**
 * Eingabe-Panel für mehrtägige Catering-Angebote als Freitext.
 * Sendet den Text an die Edge Function `parse-freeform-offer`,
 * die per KI ein strukturiertes Programm zurückliefert.
 */
export function FreeformImportPanel({ onParsed, disabled }: FreeformImportPanelProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (text.trim().length < 50) {
      setError("Bitte vollständigen Angebotstext einfügen (mind. 50 Zeichen).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "parse-freeform-offer",
        { body: { text } },
      );
      if (fnError) {
        // Versuche Detailfehler aus context.response auszulesen
        let detail = fnError.message;
        try {
          const resp = (fnError as { context?: { response?: Response } }).context?.response;
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
      if (!data?.success || !data?.program) {
        throw new Error(data?.error || "KI-Antwort ohne Programm-Daten.");
      }
      const program = data.program as FreeformProgram;
      // Sanity-Check: mindestens 1 Tag
      if (!Array.isArray(program.days) || program.days.length === 0) {
        throw new Error("KI konnte keine Tage erkennen.");
      }
      // IDs ergänzen
      program.days = program.days.map((d, i) => ({
        ...d,
        id: d.id || `day-${i}-${crypto.randomUUID()}`,
        meals: (d.meals || []).map((m, j) => ({
          ...m,
          id: m.id || `meal-${i}-${j}-${crypto.randomUUID()}`,
        })),
      }));
      onParsed(program);
      toast.success(`Programm mit ${program.days.length} Tag(en) importiert.`);
      setText("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
      toast.error(`Import fehlgeschlagen: ${msg}`);
    } finally {
      setBusy(false);
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
              KI analysiert...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Mit KI in Angebot umwandeln
            </>
          )}
        </Button>
      </div>
    </div>
  );
}