import { Calendar, Users, Info } from "lucide-react";
import { formatCurrency } from "./types";
import type { PublicFreeformProgram, PublicFreeformProgramSectionItem } from "./types";

// Defensive: alte string[]-Items im DB-Datensatz ins neue Objekt-Schema heben.
function normalizeItem(it: unknown): PublicFreeformProgramSectionItem {
  if (typeof it === "string") {
    const cleaned = it.trim().replace(/^[\s•·*\-–—]+\s*/, "");
    if (!cleaned || cleaned.includes("[object Object]")) {
      return { quantity: 1, name: "", unitPriceNet: 0 };
    }
    const m = cleaned.match(/^(?:(\d{1,4})\s*[×x*]\s*)?(.+?)(?:\s+(?:à|a)\s+|\s+)([\d]+(?:[.,]\d{1,2})?)\s*(?:€|EUR)\s*$/i);
    if (m) {
      return {
        quantity: m[1] ? parseInt(m[1], 10) || 1 : 1,
        name: m[2].trim(),
        unitPriceNet: parseFloat(m[3].replace(",", ".")) || 0,
      };
    }
    const qm = cleaned.match(/^(\d{1,4})\s*[×x*]\s*(.+)$/);
    if (qm) return { quantity: parseInt(qm[1], 10) || 1, name: qm[2].trim(), unitPriceNet: 0 };
    return { quantity: 1, name: cleaned, unitPriceNet: 0 };
  }
  const o = (it as Record<string, unknown>) ?? {};
  return {
    quantity: Number(o.quantity) || 1,
    name: typeof o.name === "string" ? o.name : "",
    unitPriceNet: Number(o.unitPriceNet) || 0,
    priceMode: o.priceMode === "flat" ? "flat" : "per_person",
  };
}

/**
 * Strukturierte Darstellung eines mehrtägigen Catering-Programms im Public Offer.
 * Preise werden 1:1 aus Maestro/KI-Import übernommen (niemals neu gerechnet).
 */
export function FreeformProgramSection({ program }: { program: PublicFreeformProgram }) {
  const isSingleUnlabeledDay =
    program.days.length === 1 &&
    !(program.days[0]?.dateLabel ?? "")
      .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, "")
      .trim();
  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h3 className="font-serif text-2xl md:text-3xl font-bold leading-tight">{program.title}</h3>
        {(program.dateRangeLabel || program.location) && (
          <p className="text-sm md:text-base text-muted-foreground font-sans">
            {program.dateRangeLabel}
            {program.dateRangeLabel && program.location ? " · " : ""}
            {program.location}
          </p>
        )}
      </header>

      {/* Leistungsumfang */}
      {program.scopeOfServices && program.scopeOfServices.length > 0 && (
        <section className="rounded-2xl bg-muted/30 px-5 py-4">
          <h4 className="text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-primary/70 mb-2">
            Leistungsumfang
          </h4>
          <ul className="text-sm text-foreground/85 space-y-1">
            {program.scopeOfServices.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary/40">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tage */}
      <div className="space-y-8">
        {program.days.map((day) => (
          <section key={day.id || day.dateLabel} className="space-y-4">
            {!isSingleUnlabeledDay && (
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <Calendar className="h-4 w-4 text-primary/70" />
                <h4 className="font-serif text-lg md:text-xl font-bold">{day.dateLabel}</h4>
              </div>
            )}

            <div className="space-y-3">
              {day.meals.map((meal) => (
                <article
                  key={meal.id || meal.label}
                  className="rounded-2xl border border-border/40 bg-background px-5 py-4"
                >
                  <header className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <h5 className="font-serif text-base md:text-lg font-semibold truncate">{meal.label}</h5>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {meal.guestCount} Personen
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-semibold text-foreground">
                        {formatCurrency(meal.flatPriceNet)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        pauschal · zzgl. {meal.vatRate}% MwSt
                      </div>
                    </div>
                  </header>

                  {meal.sections.map((sec, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                      {sec.heading && (
                        <div className="text-xs font-semibold text-foreground/85 mb-1">{sec.heading}</div>
                      )}
                      <ul className="text-sm text-muted-foreground space-y-0.5">
                        {sec.items.map((raw, j) => {
                          const it = normalizeItem(raw);
                          return (
                            <li key={j} className="flex items-baseline gap-2">
                              <span className="text-primary/40">·</span>
                              <span className="flex-1">
                                {it.quantity > 1 ? `${it.quantity} × ` : ""}
                                {it.name}
                              </span>
                              {it.unitPriceNet > 0 && (
                                <span className="tabular-nums text-foreground/85">
                                  {formatCurrency(
                                    it.priceMode === "flat"
                                      ? it.unitPriceNet
                                      : it.quantity * it.unitPriceNet,
                                  )}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Kalkulation */}
      <section className="rounded-2xl border border-border/40 bg-muted/20 px-5 py-4">
        <h4 className="text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-primary/70 mb-3">
          Kalkulation
        </h4>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Speisen netto</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(program.taxBreakdown.foodNet)}</dd>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>zzgl. {program.taxBreakdown.foodVatRate}% MwSt</dt>
            <dd className="tabular-nums">
              {formatCurrency(program.taxBreakdown.foodVatAmount ?? 0)}
            </dd>
          </div>
          <div className="flex justify-between pt-1">
            <dt className="text-muted-foreground">Personal, Equipment &amp; Logistik netto</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(program.taxBreakdown.servicesNet)}</dd>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>zzgl. {program.taxBreakdown.servicesVatRate}% MwSt</dt>
            <dd className="tabular-nums">
              {formatCurrency(program.taxBreakdown.servicesVatAmount ?? 0)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 pt-3 border-t border-border/40 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gesamt netto</span>
            <span className="font-semibold tabular-nums">{formatCurrency(program.totalsFromText.net)}</span>
          </div>
          {(() => {
            const d = program.discount;
            const discountAmount = d
              ? d.mode === 'percent'
                ? (program.totalsFromText.gross * (Number(d.value) || 0)) / 100
                : (Number(d.value) || 0)
              : 0;
            const finalGross = Math.max(0, program.totalsFromText.gross - discountAmount);
            const showDiscount = discountAmount > 0;
            return (
              <>
                <div className={`flex justify-between ${showDiscount ? 'text-sm' : 'text-lg md:text-xl'}`}>
                  <span className={showDiscount ? 'text-muted-foreground' : 'font-serif font-semibold'}>
                    {showDiscount ? 'Zwischensumme brutto' : 'Gesamt brutto'}
                  </span>
                  <span className={showDiscount ? 'tabular-nums' : 'font-bold tabular-nums'}>
                    {formatCurrency(program.totalsFromText.gross)}
                  </span>
                </div>
                {showDiscount && (
                  <>
                    <div className="flex justify-between text-sm text-primary">
                      <span>
                        Rabatt{(() => {
                          if (!d) return '';
                          const pct = d.mode === 'percent'
                            ? Number(d.value) || 0
                            : (program.totalsFromText.gross > 0
                                ? ((Number(d.value) || 0) / program.totalsFromText.gross) * 100
                                : 0);
                          return pct > 0 ? ` (${pct.toFixed(2).replace('.', ',')} %)` : '';
                        })()}
                      </span>
                      <span className="tabular-nums">− {formatCurrency(discountAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg md:text-xl pt-2 mt-1 border-t border-border/40">
                      <span className="font-serif font-semibold">Gesamt brutto</span>
                      <span className="font-bold tabular-nums">{formatCurrency(finalGross)}</span>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      </section>

      {/* Hinweise */}
      {program.notes && program.notes.length > 0 && (
        <section className="rounded-2xl bg-muted/20 px-5 py-4">
          <h4 className="text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-primary/70 mb-2 flex items-center gap-1.5">
            <Info className="h-3 w-3" /> Hinweise
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {program.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary/40">·</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}