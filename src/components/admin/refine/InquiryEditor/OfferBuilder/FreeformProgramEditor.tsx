import { useState, useEffect, useMemo } from "react";
import { Calendar, Users, RefreshCw, ChevronDown, FileText, Trash2, ShieldAlert, X, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { FreeformProgram, FreeformProgramMeal, FreeformProgramDay, FreeformProgramSection, FreeformProgramSectionItem, FreeformAdditionalService, ValidationFinding } from "./types";
import { LinePriceModeToggle } from "./LinePriceModeToggle";
import { normalizeFreeformItems } from "./FreeformImportPanel";

interface FreeformProgramEditorProps {
  program: FreeformProgram;
  onChange: (program: FreeformProgram) => void;
  onClear: () => void;
  disabled?: boolean;
  validationFindings?: ValidationFinding[];
  onDismissFindings?: () => void;
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * Auto-Kalkulation aus den Zeilen:
 * - Speisen netto = Σ Mahlzeiten (pricePerPersonNet × guestCount + flatPriceNet)
 * - Service netto = Σ Zusatzleistungen mit quantity > 0 (unitPriceNet × quantity)
 *   → Pauschalen ohne Menge werden bewusst NICHT eingerechnet ("bei Bedarf").
 */
function computeTotals(program: FreeformProgram) {
  let foodNet = 0;
  for (const day of program.days ?? []) {
    for (const m of day.meals ?? []) {
      const ppp = Number(m.pricePerPersonNet) || 0;
      const guests = Number(m.guestCount) || 0;
      const flat = Number(m.flatPriceNet) || 0;
      let itemsSum = 0;
      for (const sec of m.sections ?? []) {
        for (const it of sec.items ?? []) {
          const q = Number((it as FreeformProgramSectionItem)?.quantity) || 0;
          const u = Number((it as FreeformProgramSectionItem)?.unitPriceNet) || 0;
          const mode = (it as FreeformProgramSectionItem)?.priceMode ?? "per_person";
          itemsSum += mode === "flat" ? u : q * u;
        }
      }
      foodNet += ppp * guests + flat + itemsSum;
    }
  }
  let servicesNet = 0;
  for (const s of program.additionalServices ?? []) {
    const qty = Number(s.quantity) || 0;
    if (qty <= 0) continue;
    servicesNet += (Number(s.unitPriceNet) || 0) * qty;
  }
  const foodVatRate = Number(program.taxBreakdown?.foodVatRate) || 7;
  const servicesVatRate = Number(program.taxBreakdown?.servicesVatRate) || 19;
  const foodVatAmount = Math.round(foodNet * foodVatRate) / 100;
  const servicesVatAmount = Math.round(servicesNet * servicesVatRate) / 100;
  const net = foodNet + servicesNet;
  const gross = net + foodVatAmount + servicesVatAmount;
  return {
    foodNet: Math.round(foodNet * 100) / 100,
    foodVatAmount,
    servicesNet: Math.round(servicesNet * 100) / 100,
    servicesVatAmount,
    net: Math.round(net * 100) / 100,
    gross: Math.round(gross * 100) / 100,
  };
}

export function FreeformProgramEditor({
  program,
  onChange,
  onClear,
  disabled,
  validationFindings,
  onDismissFindings,
}: FreeformProgramEditorProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmClear, setConfirmClear] = useState(false);

  // Legacy-Hydration: alte `string[]`-Items beim Mount migrieren.
  useEffect(() => {
    const hasLegacy = (program.days ?? []).some((d) =>
      (d.meals ?? []).some((m) =>
        (m.sections ?? []).some((s) => (s.items ?? []).some((it) => typeof it === "string")),
      ),
    );
    if (hasLegacy) onChange(normalizeFreeformItems(program));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-Kalkulation aus Zeilen → Summenfelder reaktiv synchronisieren.
  const computed = useMemo(() => computeTotals(program), [program]);
  useEffect(() => {
    const cur = program.totalsFromText ?? { net: 0, gross: 0 };
    const curTax = program.taxBreakdown ?? {
      foodNet: 0, foodVatRate: 7, foodVatAmount: 0,
      servicesNet: 0, servicesVatRate: 19, servicesVatAmount: 0,
    };
    const close = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) < 0.005;
    if (
      close(cur.net, computed.net) &&
      close(cur.gross, computed.gross) &&
      close(curTax.foodNet, computed.foodNet) &&
      close(curTax.foodVatAmount ?? 0, computed.foodVatAmount) &&
      close(curTax.servicesNet, computed.servicesNet) &&
      close(curTax.servicesVatAmount ?? 0, computed.servicesVatAmount)
    ) {
      return;
    }
    onChange({
      ...program,
      totalsFromText: { net: computed.net, gross: computed.gross },
      taxBreakdown: {
        ...curTax,
        foodNet: computed.foodNet,
        foodVatAmount: computed.foodVatAmount,
        servicesNet: computed.servicesNet,
        servicesVatAmount: computed.servicesVatAmount,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed.net, computed.gross, computed.foodNet, computed.foodVatAmount, computed.servicesNet, computed.servicesVatAmount]);

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const updateMeal = (dayId: string, mealId: string, patch: Partial<FreeformProgramMeal>) => {
    onChange({
      ...program,
      days: program.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              meals: d.meals.map((m) => (m.id !== mealId ? m : { ...m, ...patch })),
            },
      ),
    });
  };

  const updateDay = (dayId: string, patch: Partial<FreeformProgramDay>) => {
    onChange({
      ...program,
      days: program.days.map((d) => (d.id !== dayId ? d : { ...d, ...patch })),
    });
  };

  const addDay = () => {
    const id = `day-${Date.now()}`;
    onChange({
      ...program,
      days: [...program.days, { id, dateLabel: "Neuer Tag", meals: [] }],
    });
    setExpanded((e) => ({ ...e, [id]: true }));
  };
  const removeDay = (dayId: string) => {
    onChange({ ...program, days: program.days.filter((d) => d.id !== dayId) });
  };
  const addMeal = (dayId: string) => {
    const id = `meal-${Date.now()}`;
    onChange({
      ...program,
      days: program.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              meals: [
                ...d.meals,
                { id, label: "Neue Mahlzeit", guestCount: 0, flatPriceNet: 0, vatRate: 7, sections: [] },
              ],
            },
      ),
    });
  };
  const removeMeal = (dayId: string, mealId: string) => {
    onChange({
      ...program,
      days: program.days.map((d) =>
        d.id !== dayId ? d : { ...d, meals: d.meals.filter((m) => m.id !== mealId) },
      ),
    });
  };
  const updateSections = (dayId: string, mealId: string, sections: FreeformProgramSection[]) => {
    updateMeal(dayId, mealId, { sections });
  };
  const setScope = (text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    onChange({ ...program, scopeOfServices: lines.length ? lines : null });
  };
  const setNotes = (text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    onChange({ ...program, notes: lines.length ? lines : null });
  };

  const updateTax = (patch: Partial<FreeformProgram["taxBreakdown"]>) => {
    onChange({ ...program, taxBreakdown: { ...program.taxBreakdown, ...patch } });
  };

  const updateTotals = (patch: Partial<FreeformProgram["totalsFromText"]>) => {
    onChange({ ...program, totalsFromText: { ...program.totalsFromText, ...patch } });
  };

  // Zusatzleistungen
  const services: FreeformAdditionalService[] = program.additionalServices ?? [];
  const setServices = (next: FreeformAdditionalService[]) => {
    onChange({ ...program, additionalServices: next.length ? next : null });
  };
  const addService = () => {
    setServices([
      ...services,
      { id: `svc-${Date.now()}`, label: "", unitPriceNet: 0, unit: "hour", quantity: null, vatRate: 19 },
    ]);
  };
  const updateService = (id: string, patch: Partial<FreeformAdditionalService>) => {
    setServices(services.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };
  const unitLabel = (u: FreeformAdditionalService["unit"]) =>
    u === "hour" ? "€ / Stunde" : u === "piece" ? "€ / Stück" : "€ Pauschal";

  const discount = program.discount ?? { mode: 'percent' as const, value: 0 };
  const updateDiscount = (patch: Partial<NonNullable<FreeformProgram["discount"]>>) => {
    onChange({ ...program, discount: { ...discount, ...patch } });
  };
  const discountAmount =
    discount.mode === 'percent'
      ? (program.totalsFromText.gross * (Number(discount.value) || 0)) / 100
      : (Number(discount.value) || 0);
  const finalGross = Math.max(0, program.totalsFromText.gross - discountAmount);

  const totalMealsNet = program.days.reduce(
    (s, d) => s + d.meals.reduce((sm, m) => sm + (Number(m.flatPriceNet) || 0), 0),
    0,
  );

  // Single-Day-Modus: ein einziger Tag ohne benanntes dateLabel → Tag-Header
  // ausblenden und Mahlzeiten direkt rendern. Bei 2+ Tagen oder benanntem
  // Datum bleibt die bisherige Tages-Ansicht.
  const isSingleUnlabeledDay =
    program.days.length === 1 &&
    !(program.days[0]?.dateLabel ?? "")
      .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, "")
      .trim();

  return (
    <div className="space-y-4">
      {/* Red-Team Findings */}
      {validationFindings && validationFindings.length > 0 && (
        <div className="rounded-xl border border-foreground/30 bg-muted/40 px-4 py-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
              <div>
                <div className="text-sm font-semibold">
                  Red Team: {validationFindings.length} Abweichung
                  {validationFindings.length !== 1 ? "en" : ""} gefunden
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Auto-Retry hat verbleibende Punkte nicht gelöst. Bitte manuell prüfen.
                </div>
              </div>
            </div>
            {onDismissFindings && (
              <button
                type="button"
                onClick={onDismissFindings}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Findings ausblenden"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <ul className="space-y-1 text-xs">
            {validationFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0",
                    f.severity === "critical"
                      ? "bg-foreground text-background"
                      : "bg-foreground/15 text-foreground",
                  )}
                >
                  {f.category}
                </span>
                <div className="min-w-0">
                  <div className="text-foreground">{f.message}</div>
                  {(f.expected || f.actual) && (
                    <div className="text-[10px] text-muted-foreground font-mono break-all">
                      {f.path && <span>{f.path}: </span>}
                      {f.expected && <span>erwartet „{f.expected}"</span>}
                      {f.expected && f.actual && <span> · </span>}
                      {f.actual && <span>erkannt „{f.actual}"</span>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <Input
              value={program.title}
              onChange={(e) => onChange({ ...program, title: e.target.value })}
              disabled={disabled}
              className="h-8 text-sm font-semibold bg-background/60 border-primary/20"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <Input
                value={program.dateRangeLabel ?? ""}
                onChange={(e) => onChange({ ...program, dateRangeLabel: e.target.value })}
                disabled={disabled}
                placeholder="Zeitraum"
                className="h-7 text-xs"
              />
              <Input
                value={program.location ?? ""}
                onChange={(e) => onChange({ ...program, location: e.target.value })}
                disabled={disabled}
                placeholder="Location"
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmClear(true)}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          Neu importieren
        </Button>
      </div>

      {/* Scope of Services */}
      <details className="rounded-xl border border-border/40 bg-muted/10 px-4 py-2 text-sm" open={!!program.scopeOfServices?.length}>
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Leistungsumfang ({program.scopeOfServices?.length ?? 0})
        </summary>
        <Textarea
          value={(program.scopeOfServices ?? []).join("\n")}
          onChange={(e) => setScope(e.target.value)}
          disabled={disabled}
          placeholder="Eine Zeile pro Punkt"
          className="mt-2 text-xs min-h-[80px] font-mono"
        />
      </details>

      {/* Days */}
      <div className="space-y-3">
        {program.days.map((day) => (
          <div key={day.id} className="rounded-xl border border-border/40 bg-background overflow-hidden">
            {!isSingleUnlabeledDay && (
            <div className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/20 transition-colors">
              <button type="button" onClick={() => toggle(day.id)} className="flex items-center gap-2 shrink-0">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded[day.id] && "rotate-180")} />
              </button>
              <Input
                value={day.dateLabel}
                onChange={(e) => updateDay(day.id, { dateLabel: e.target.value })}
                disabled={disabled}
                className="h-7 text-sm font-semibold flex-1 min-w-0"
              />
              <span className="text-xs text-muted-foreground shrink-0">
                {day.meals.length} Mahlzeit{day.meals.length !== 1 ? "en" : ""}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeDay(day.id)} disabled={disabled} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            )}
            {(isSingleUnlabeledDay || expanded[day.id]) && (
              <div className={cn("divide-y divide-border/30", !isSingleUnlabeledDay && "border-t border-border/30")}>
                {day.meals.map((meal) => (
                  <div key={meal.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        value={meal.label}
                        onChange={(e) => updateMeal(day.id, meal.id, { label: e.target.value })}
                        disabled={disabled}
                        className="h-7 text-sm font-medium max-w-xs"
                      />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <Input
                          type="number"
                          min="0"
                          value={meal.guestCount}
                          onChange={(e) =>
                            updateMeal(day.id, meal.id, { guestCount: parseInt(e.target.value) || 0 })
                          }
                          disabled={disabled}
                          className="h-7 w-16 text-xs"
                        />
                        Personen
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={meal.flatPriceNet}
                          onChange={(e) =>
                            updateMeal(day.id, meal.id, { flatPriceNet: parseFloat(e.target.value) || 0 })
                          }
                          disabled={disabled}
                          className="h-7 w-28 text-xs text-right"
                          placeholder="Pauschal"
                        />
                        <span className="text-xs text-muted-foreground">€ pausch.</span>
                        <Input
                          value={meal.pricePerPersonPrefix ?? ""}
                          onChange={(e) =>
                            updateMeal(day.id, meal.id, { pricePerPersonPrefix: e.target.value || null })
                          }
                          disabled={disabled}
                          placeholder="ab"
                          className="h-7 w-10 text-[10px] text-center ml-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={meal.pricePerPersonNet ?? ""}
                          onChange={(e) =>
                            updateMeal(day.id, meal.id, {
                              pricePerPersonNet: e.target.value === "" ? null : parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={disabled}
                          className="h-7 w-20 text-xs text-right"
                          placeholder="0,00"
                        />
                        <span className="text-[10px] text-muted-foreground">€/Pers.</span>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={meal.vatRate}
                          onChange={(e) => updateMeal(day.id, meal.id, { vatRate: parseFloat(e.target.value) || 0 })}
                          disabled={disabled}
                          className="h-7 w-14 text-[10px] text-right ml-1"
                        />
                        <span className="text-[10px] text-muted-foreground">% MwSt</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeMeal(day.id, meal.id)} disabled={disabled} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {meal.sections.map((sec, i) => (
                      <div key={i} className="pl-5 text-xs space-y-1 border-l border-border/30">
                        <div className="flex items-center gap-1">
                          <Input
                            value={sec.heading ?? ""}
                            onChange={(e) => {
                              const sections = meal.sections.map((s, idx) => idx === i ? { ...s, heading: e.target.value || null } : s);
                              updateSections(day.id, meal.id, sections);
                            }}
                            disabled={disabled}
                            placeholder="Überschrift (optional)"
                            className="h-6 text-xs font-semibold"
                          />
                          <Button type="button" variant="ghost" size="sm" disabled={disabled}
                            onClick={() => updateSections(day.id, meal.id, meal.sections.filter((_, idx) => idx !== i))}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {sec.items.map((it, j) => {
                            const item = it as FreeformProgramSectionItem;
                            const patchItem = (patch: Partial<FreeformProgramSectionItem>) => {
                              const items = sec.items.map((x, k) => k === j ? { ...item, ...patch } : x);
                              const sections = meal.sections.map((s, idx) => idx === i ? { ...s, items } : s);
                              updateSections(day.id, meal.id, sections);
                            };
                            const removeItem = () => {
                              const items = sec.items.filter((_, k) => k !== j);
                              const sections = meal.sections.map((s, idx) => idx === i ? { ...s, items } : s);
                              updateSections(day.id, meal.id, sections);
                            };
                            return (
                              <div key={j} className="flex items-center gap-2">
                                <span
                                  className="text-muted-foreground/60 shrink-0 cursor-grab touch-none"
                                  aria-hidden="true"
                                  title="Position"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={item.quantity}
                                    onChange={(e) => patchItem({ quantity: parseInt(e.target.value) || 0 })}
                                    disabled={disabled}
                                    className="h-9 w-14 text-sm text-right"
                                  />
                                  <span className="text-[10px] text-muted-foreground">×</span>
                                </div>
                                <Input
                                  value={item.name}
                                  onChange={(e) => patchItem({ name: e.target.value })}
                                  disabled={disabled}
                                  placeholder="Bezeichnung"
                                  className="h-9 text-sm flex-1 min-w-0"
                                />
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unitPriceNet}
                                  onChange={(e) => patchItem({ unitPriceNet: parseFloat(e.target.value) || 0 })}
                                  disabled={disabled}
                                  className="h-9 w-20 text-sm text-right"
                                  placeholder="0,00"
                                />
                                <span className="text-[10px] text-muted-foreground shrink-0">€</span>
                                <LinePriceModeToggle
                                  value={item.priceMode ?? "per_person"}
                                  onChange={(mode) => patchItem({ priceMode: mode })}
                                  disabled={disabled}
                                />
                                <Button type="button" variant="ghost" size="sm" disabled={disabled}
                                  onClick={removeItem}
                                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                          <Button type="button" variant="ghost" size="sm" disabled={disabled}
                            onClick={() => {
                              const items: FreeformProgramSectionItem[] = [...sec.items, { quantity: 1, name: "", unitPriceNet: 0, priceMode: "per_person" }];
                              const sections = meal.sections.map((s, idx) => idx === i ? { ...s, items } : s);
                              updateSections(day.id, meal.id, sections);
                            }}
                            className="h-6 text-[11px] text-muted-foreground gap-1">
                            <Plus className="h-3 w-3" /> Position hinzufügen
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" disabled={disabled}
                      onClick={() => updateSections(day.id, meal.id, [...meal.sections, { heading: null, items: [] }])}
                      className="h-6 text-[11px] text-muted-foreground gap-1">
                      <Plus className="h-3 w-3" /> Abschnitt hinzufügen
                    </Button>
                  </div>
                ))}
                <div className="px-4 py-2 bg-muted/10">
                  <Button type="button" variant="ghost" size="sm" onClick={() => addMeal(day.id)} disabled={disabled} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Mahlzeit hinzufügen
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addDay} disabled={disabled} className="gap-1.5 w-full">
          <Plus className="h-3.5 w-3.5" /> Tag hinzufügen
        </Button>
      </div>

      {/* Zusätzliche Leistungen (Stunden / Pauschal / Stück) */}
      <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Zusätzliche Leistungen ({services.length})
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={addService} disabled={disabled} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" /> Leistung
          </Button>
        </div>
        {services.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            z.B. Service-Personal 59 €/h, Anfahrt 50 € pauschal, Equipment-Stückpreise.
          </p>
        ) : (
          <div className="space-y-2">
            {services.map((svc) => (
              <div key={svc.id} className="flex items-center gap-2 flex-wrap">
                <Input
                  value={svc.label}
                  onChange={(e) => updateService(svc.id, { label: e.target.value })}
                  disabled={disabled}
                  placeholder="Bezeichnung (z.B. Service-Personal)"
                  className="h-7 text-xs flex-1 min-w-[160px]"
                />
                <select
                  value={svc.unit}
                  onChange={(e) => updateService(svc.id, { unit: e.target.value as FreeformAdditionalService["unit"] })}
                  disabled={disabled}
                  className="h-7 text-xs rounded-md border border-input bg-background px-2"
                >
                  <option value="hour">€ / Stunde</option>
                  <option value="flat">€ Pauschal</option>
                  <option value="piece">€ / Stück</option>
                </select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={svc.unitPriceNet}
                  onChange={(e) => updateService(svc.id, { unitPriceNet: parseFloat(e.target.value) || 0 })}
                  disabled={disabled}
                  className="h-7 w-24 text-xs text-right"
                />
                <span className="text-[10px] text-muted-foreground">{unitLabel(svc.unit)}</span>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={svc.quantity ?? ""}
                  onChange={(e) =>
                    updateService(svc.id, {
                      quantity: e.target.value === "" ? null : parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={disabled}
                  placeholder="Menge"
                  className="h-7 w-16 text-xs text-right"
                  title="Pauschalen ohne Menge werden NICHT eingerechnet ('bei Bedarf')"
                />
                <span className="text-[10px] text-muted-foreground">
                  {svc.unit === "hour" ? "h" : svc.unit === "piece" ? "Stk" : "×"}
                </span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={svc.vatRate}
                  onChange={(e) => updateService(svc.id, { vatRate: parseFloat(e.target.value) || 0 })}
                  disabled={disabled}
                  className="h-7 w-14 text-[10px] text-right"
                />
                <span className="text-[10px] text-muted-foreground">% MwSt</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeService(svc.id)}
                  disabled={disabled}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kalkulation */}
      <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Kalkulation</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-muted-foreground">Speisen netto</label>
            <Input
              type="number"
              step="0.01"
              value={program.taxBreakdown.foodNet}
              onChange={(e) => updateTax({ foodNet: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
              className="h-7 text-xs text-right"
            />
            <div className="text-[10px] text-muted-foreground">
              Σ Mahlzeiten netto = {fmtEur(totalMealsNet)} €
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground">+ {program.taxBreakdown.foodVatRate}% MwSt</label>
            <Input
              type="number"
              step="0.01"
              value={program.taxBreakdown.foodVatAmount ?? 0}
              onChange={(e) => updateTax({ foodVatAmount: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
              className="h-7 text-xs text-right"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground">Personal/Equipment netto</label>
            <Input
              type="number"
              step="0.01"
              value={program.taxBreakdown.servicesNet}
              onChange={(e) => updateTax({ servicesNet: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
              className="h-7 text-xs text-right"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground">+ {program.taxBreakdown.servicesVatRate}% MwSt</label>
            <Input
              type="number"
              step="0.01"
              value={program.taxBreakdown.servicesVatAmount ?? 0}
              onChange={(e) => updateTax({ servicesVatAmount: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
              className="h-7 text-xs text-right"
            />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-muted-foreground font-semibold">Gesamt netto</label>
            <Input
              type="number"
              step="0.01"
              value={program.totalsFromText.net}
              onChange={(e) => updateTotals({ net: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
              className="h-8 text-sm font-semibold text-right"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground font-semibold">Gesamt brutto</label>
            <Input
              type="number"
              step="0.01"
              value={program.totalsFromText.gross}
              onChange={(e) => updateTotals({ gross: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
              className="h-8 text-sm font-semibold text-right text-primary"
            />
          </div>
        </div>

        {/* Rabatt */}
        <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-muted-foreground font-semibold">Rabatt</label>
            <div
              className="inline-flex rounded-md border border-border/50 bg-muted/30 p-0.5 text-[10px] leading-none"
              title="Rabatt als Prozent oder fester Betrag"
            >
              <button
                type="button"
                onClick={() => updateDiscount({ mode: 'percent' })}
                disabled={disabled}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  discount.mode === 'percent'
                    ? "bg-background shadow-sm font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => updateDiscount({ mode: 'amount' })}
                disabled={disabled}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  discount.mode === 'amount'
                    ? "bg-background shadow-sm font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                € brutto
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs items-center">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={discount.value}
              onChange={(e) => updateDiscount({ value: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
              className="h-8 text-sm text-right"
              placeholder={discount.mode === 'percent' ? "0 %" : "0,00 €"}
            />
            <div className="text-right text-xs text-muted-foreground tabular-nums">
              − {fmtEur(discountAmount)} €
              {discount.mode === 'amount' && program.totalsFromText.gross > 0 && Number(discount.value) > 0 && (
                <span className="ml-1">
                  ({((Number(discount.value) / program.totalsFromText.gross) * 100).toFixed(2).replace('.', ',')} %)
                </span>
              )}
              {discount.mode === 'percent' && Number(discount.value) > 0 && (
                <span className="ml-1">({Number(discount.value).toFixed(2).replace('.', ',')} %)</span>
              )}
            </div>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-border/30">
              <span className="text-sm font-semibold">Endbetrag brutto</span>
              <span className="text-base font-bold text-primary tabular-nums">{fmtEur(finalGross)} €</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <details className="rounded-xl border border-border/40 bg-muted/10 px-4 py-2 text-sm" open={!!program.notes?.length}>
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Hinweise ({program.notes?.length ?? 0})
        </summary>
        <Textarea
          value={(program.notes ?? []).join("\n")}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
          placeholder="Eine Zeile pro Hinweis"
          className="mt-2 text-xs min-h-[80px] font-mono"
        />
      </details>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Programm verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das aktuelle Programm wird gelöscht. Du kannst dann einen neuen Text einfügen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClear(false);
                onClear();
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}