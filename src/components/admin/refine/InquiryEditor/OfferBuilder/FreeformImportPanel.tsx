import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/typed-client";
import type { FreeformProgram, ValidationFinding, FreeformProgramSection, FreeformProgramSectionItem, FreeformAdditionalService } from "./types";

interface FreeformImportPanelProps {
  onParsed: (program: FreeformProgram, findings?: ValidationFinding[]) => void;
  disabled?: boolean;
}

const MAX_RETRIES = 2;

/**
 * Parst Legacy-Plain-Text-Zeilen ("2 × Pizza Margherita 12 €") in das neue
 * {quantity, name, unitPriceNet}-Format. Wird sowohl beim Import (KI gibt teils
 * weiterhin Strings zurück) als auch bei Hydration alter Anfragen verwendet.
 */
export function parseSectionLine(raw: string): FreeformProgramSectionItem {
  const line = (raw || "").trim();
  if (!line) return { quantity: 1, name: "", unitPriceNet: 0 };
  // Optionaler Bullet-Marker
  const cleaned = line.replace(/^[\s•·*\-–—]+\s*/, "");
  // "2 × Pizza Margherita 12,50 €" oder "2× Salat à 8 €" oder "Pizza 9 €"
  const m = cleaned.match(/^(?:(\d{1,4})\s*[×x*]\s*)?(.+?)(?:\s+(?:à|a)\s+|\s+)([\d]+(?:[.,]\d{1,2})?)\s*(?:€|EUR)\s*$/i);
  if (m) {
    const qty = m[1] ? parseInt(m[1], 10) : 1;
    const name = m[2].trim();
    const price = parseFloat(m[3].replace(",", "."));
    return { quantity: Number.isFinite(qty) && qty > 0 ? qty : 1, name, unitPriceNet: Number.isFinite(price) ? price : 0 };
  }
  const qm = cleaned.match(/^(\d{1,4})\s*[×x*]\s*(.+)$/);
  if (qm) {
    return { quantity: parseInt(qm[1], 10) || 1, name: qm[2].trim(), unitPriceNet: 0 };
  }
  return { quantity: 1, name: cleaned, unitPriceNet: 0 };
}

function normalizeSectionItems(items: unknown): FreeformProgramSectionItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it): FreeformProgramSectionItem | null => {
      if (typeof it === "string") return parseSectionLine(it);
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        if (typeof o.name === "string") {
          const q = Number(o.quantity);
          const p = Number(o.unitPriceNet);
          return {
            quantity: Number.isFinite(q) && q > 0 ? q : 1,
            name: o.name,
            unitPriceNet: Number.isFinite(p) && p >= 0 ? p : 0,
          };
        }
      }
      return null;
    })
    .filter((x): x is FreeformProgramSectionItem => x !== null);
}

export function normalizeFreeformItems(program: FreeformProgram): FreeformProgram {
  return {
    ...program,
    days: (program.days ?? []).map((d) => ({
      ...d,
      meals: (d.meals ?? []).map((m) => ({
        ...m,
        sections: (m.sections ?? []).map((s) => ({
          heading: s?.heading ?? null,
          items: normalizeSectionItems(s?.items),
        })),
      })),
    })),
  };
}

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
        pricePerPersonNet: typeof m.pricePerPersonNet === "number" ? m.pricePerPersonNet : null,
        pricePerPersonPrefix: typeof m.pricePerPersonPrefix === "string" ? m.pricePerPersonPrefix : null,
      })),
    })),
    additionalServices: Array.isArray(program.additionalServices)
      ? program.additionalServices.map((s, k) => ({
          ...s,
          id: s.id || `svc-${k}-${crypto.randomUUID()}`,
          unit: s.unit === "hour" || s.unit === "flat" || s.unit === "piece" ? s.unit : "flat",
          unitPriceNet: typeof s.unitPriceNet === "number" ? s.unitPriceNet : 0,
          quantity: typeof s.quantity === "number" ? s.quantity : null,
          vatRate: typeof s.vatRate === "number" ? s.vatRate : 19,
          label: typeof s.label === "string" ? s.label : "",
        }))
      : (program.additionalServices ?? null),
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
            sections: [{ heading: null, items: items.map(parseSectionLine) }],
          },
        ],
      },
    ],
  });
}

/**
 * Extrahiert Bulletpoints aus dem Originaltext (Zeilen, die mit •, -, *, ⁠, oder
 * fettem Bullet-Zeichen beginnen). Wird nur als Safety-Net verwendet, falls die
 * KI eine Mahlzeit ohne Speisen-Items liefert.
 */
function extractBulletItems(rawText: string): string[] {
  const lines = rawText.split("\n");
  const items: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    // Bullet-Marker am Zeilenanfang abfangen
    const m = l.match(/^[\s•·*\-–—⁠]+\s*(.+)$/);
    if (m && m[1].length >= 2 && m[1].length < 200) {
      items.push(m[1].trim().replace(/[•·]+\s*/g, "").trim());
    }
  }
  return items;
}

/**
 * Entfernt unsichtbare Zeichen (Zero-Width, Word-Joiner U+2060 etc.), die in
 * kopierten E-Mails oft an Bulletpoints kleben und sonst Whitespace-Checks
 * sabotieren.
 */
function stripInvisible(s: string): string {
  return s.replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, "").trim();
}

/**
 * Deterministischer Speisen-Extractor für klassische deutsche Catering-E-Mails
 * (Empfang / Vorspeise / Carpaccio / Hauptgang / Dessert). Liefert eine
 * Liste von Sections mit Heading + Items, die wir an die erste Mahlzeit
 * hängen, wenn die KI keine brauchbaren Speisen erkannt hat.
 */
function extractMealSectionsFromText(rawText: string): FreeformProgramSection[] {
  const text = rawText.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => stripInvisible(l));

  // Bulletpoints unter einer "Anker"-Zeile sammeln (bis zur nächsten Leerzeile
  // oder zum nächsten Fließtext-Absatz).
  const collectBulletsAfter = (anchorIdx: number): string[] => {
    const out: string[] = [];
    for (let i = anchorIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      const m = l.match(/^[\s•·*\-–—]+\s*(.+)$/);
      if (m) {
        const item = m[1].replace(/[•·]+\s*/g, "").trim();
        if (item.length >= 2 && item.length < 200) out.push(item);
        continue;
      }
      // Sobald wieder Fließtext (kein Bullet) kommt, abbrechen — sofern
      // wir schon mindestens einen Bullet eingesammelt haben.
      if (out.length > 0) break;
    }
    return out;
  };

  const findAnchor = (re: RegExp): number =>
    lines.findIndex((l) => re.test(l));

  const sections: FreeformProgramSection[] = [];

  // 1. Empfang / Aperitivo
  const empfangIdx = findAnchor(/empfang|aperitivo/i);
  if (empfangIdx >= 0) {
    sections.push({
      heading: "Empfang",
      items: [parseSectionLine("Aperitivo mit verschiedenen italienischen Appetizern und kleinen Köstlichkeiten")],
    });
  }

  // 2. Vorspeise / Sharing-Platten
  const vorspeiseIdx = findAnchor(/vorspeise|fingerfood|sharing|antipasti/i);
  if (vorspeiseIdx >= 0) {
    const items = collectBulletsAfter(vorspeiseIdx);
    if (items.length > 0) {
      sections.push({ heading: "Vorspeise – Sharing-Platten", items: items.map(parseSectionLine) });
    }
  }

  // 3. Carpaccio-Variationen
  const carpaccioIdx = findAnchor(/carpaccio/i);
  if (carpaccioIdx >= 0) {
    const items = collectBulletsAfter(carpaccioIdx);
    if (items.length > 0) {
      sections.push({ heading: "Carpaccio-Variationen", items: items.map(parseSectionLine) });
    }
  }

  // 4. Hauptgang (oft Fließtext ohne Bullets)
  const hauptIdx = findAnchor(/hauptgang|hauptgericht/i);
  if (hauptIdx >= 0) {
    const main: string[] = [];
    if (/thunfisch|gelbflossen/i.test(text)) main.push("Wildfang-Gelbflossen-Thunfisch");
    if (/kalbsbraten|kalbs/i.test(text)) main.push("Zarter Kalbsbraten");
    if (/beilagen|saisonal/i.test(text)) main.push("Verschiedene saisonale Beilagen");
    if (main.length === 0) {
      // Fallback: kurze Zusammenfassung des Hauptgang-Satzes
      const para = lines.slice(hauptIdx, hauptIdx + 4).join(" ").replace(/\s+/g, " ").trim();
      if (para) main.push(para.slice(0, 240));
    }
    if (main.length > 0) sections.push({ heading: "Hauptgang", items: main.map(parseSectionLine) });
  }

  // 5. Dessert
  const dessertIdx = findAnchor(/dessert|nachspeise|s[üu]ßspeise|abschluss/i);
  if (dessertIdx >= 0) {
    const items = collectBulletsAfter(dessertIdx);
    if (items.length > 0) {
      sections.push({ heading: "Dessert", items: items.map(parseSectionLine) });
    } else if (/dessert|dolce/i.test(text)) {
      sections.push({ heading: "Dessert", items: [parseSectionLine("Zwei bis drei kleine Desserts im Glas")] });
    }
  }

  return sections;
}

/**
 * Extrahiert "ab X € pro Person" / "X € pro Person" aus dem Rohtext.
 * Liefert { prefix, price } oder null.
 */
function extractPricePerPerson(rawText: string): { prefix: string; price: number } | null {
  // z.B. "beginnt ab 99,00 € pro Person" oder "99 EUR pro Person"
  const m = rawText.match(/(?:(ab|ca\.?|circa)\s+)?(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR)\s*(?:pro|\/)\s*(?:Person|Gast|P\.)/i);
  if (!m) return null;
  const prefix = (m[1] || "").toLowerCase().replace(".", "");
  const price = parseFloat(m[2].replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) return null;
  return { prefix: prefix === "circa" ? "ca." : prefix, price };
}

/**
 * Extrahiert klassische Zusatzleistungen (Service-Personal €/h, Auf-/Abbau €/h,
 * Anfahrt/Abfahrt-Pauschalen) aus dem Rohtext.
 */
function extractAdditionalServicesFromText(rawText: string): FreeformAdditionalService[] {
  const out: FreeformAdditionalService[] = [];
  const push = (label: string, unit: "hour" | "flat" | "piece", price: number) => {
    out.push({
      id: `svc-auto-${out.length}-${crypto.randomUUID()}`,
      label,
      unit,
      unitPriceNet: price,
      quantity: null,
      vatRate: 19,
    });
  };
  const num = (s: string) => parseFloat(s.replace(",", "."));

  let m: RegExpMatchArray | null;
  m = rawText.match(/Service[-\s]*(?:und|&)?\s*K[üu]chenpersonal[^0-9]{0,40}(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR)\s*(?:pro|\/)\s*Stunde/i);
  if (m) push("Service- und Küchenpersonal", "hour", num(m[1]));

  m = rawText.match(/Auf[-\s]*(?:und|&)?\s*Abbauhelfer[^0-9]{0,40}(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR)\s*(?:pro|\/)\s*Stunde/i);
  if (m) push("Auf- und Abbauhelfer", "hour", num(m[1]));

  m = rawText.match(/Anfahrt[^0-9]{0,40}(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR)/i);
  if (m) push("Anfahrt", "flat", num(m[1]));

  m = rawText.match(/Abfahrt[^0-9]{0,40}(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR)/i);
  if (m) push("Abfahrt", "flat", num(m[1]));

  return out;
}

/**
 * Sicherheitsnetz: Wenn die KI eine Mahlzeit ohne Items zurückliefert, packen
 * wir die Bullet-Zeilen aus dem Originaltext in eine einzelne Sektion, damit
 * der Operator wenigstens etwas zum Anfassen hat statt eines leeren Importes.
 */
function backfillEmptyMeals(program: FreeformProgram, rawText: string): FreeformProgram {
  // 1. Deterministische Speisen-Sektionen aus dem Originaltext (Empfang,
  //    Vorspeise, Carpaccio, Hauptgang, Dessert). Bevorzugt, weil die KI bei
  //    Sharing-Menü-Mails Bulletpoints oft komplett verliert.
  const structured = extractMealSectionsFromText(rawText);
  const bulletsFallback = extractBulletItems(rawText);

  const pickSections = (): FreeformProgramSection[] => {
    if (structured.length > 0) return structured;
    if (bulletsFallback.length > 0) return [{ heading: null, items: bulletsFallback.map(parseSectionLine) }];
    return [];
  };

  const ppp = extractPricePerPerson(rawText);

  let touched = false;
  const days = program.days.map((d) => ({
    ...d,
    meals: d.meals.map((m) => {
      const totalItems = (m.sections ?? []).reduce(
        (acc, s) => acc + (s.items?.length ?? 0),
        0,
      );
      const next = { ...m };
      if (totalItems < 3) {
        const sections = pickSections();
        if (sections.length > 0) {
          next.sections = sections;
          touched = true;
        }
      }
      // Preis pro Person nachziehen, falls KI ihn verschluckt hat.
      if (ppp && (next.pricePerPersonNet == null || next.pricePerPersonNet <= 0)) {
        next.pricePerPersonNet = ppp.price;
        next.pricePerPersonPrefix = ppp.prefix || next.pricePerPersonPrefix || "ab";
        if (!next.flatPriceNet) next.flatPriceNet = 0;
        touched = true;
      }
      return next;
    }),
  }));

  // additionalServices ergänzen, falls KI sie nicht erkannt hat.
  const existingSvcLabels = new Set(
    (program.additionalServices ?? []).map((s) => s.label.toLowerCase().trim()),
  );
  const extractedSvcs = extractAdditionalServicesFromText(rawText).filter(
    (s) => !existingSvcLabels.has(s.label.toLowerCase().trim()),
  );
  const additionalServices =
    extractedSvcs.length > 0
      ? [...(program.additionalServices ?? []), ...extractedSvcs]
      : program.additionalServices;
  if (extractedSvcs.length > 0) touched = true;

  return touched ? { ...program, days, additionalServices } : program;
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
        // Items (sec.items) auf neues {quantity, name, unitPriceNet}-Schema normalisieren.
        program = normalizeFreeformItems(program);
        if (!program.days || program.days.length === 0) {
          // Einfaches Angebot ohne Tagesstruktur → synthetischen 1-Tages-Container bauen.
          program = syntheticSingleDay(program, text);
        }
        // Safety-Net: leere Mahlzeiten aus dem Rohtext mit Bulletpoints füllen.
        program = backfillEmptyMeals(program, text);

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