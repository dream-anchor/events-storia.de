import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { calculateEventPackagePrice, isLocationPackage, getLocationPricingBreakdown } from "@/lib/eventPricing";
import type { Package } from "../types";
import type { CourseSelection } from "./types";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import type { PricingMode } from "./pricingMode";
import type { EquipmentItem } from "./types";

interface PriceBreakdownProps {
  packageData: Package | undefined;
  guestCount: number;
  /** Menü-Modus: Kurse mit Einzelpreisen */
  courses?: CourseSelection[];
  menuItems?: CombinedMenuItem[];
  /** Getränke/Weinbegleitung pro Person */
  winePairingPrice?: number | null;
  /** Label für die Getränke-Zeile (default: 'Getränke') */
  drinksLabel?: string;
  /** Manueller Gesamtpreis (frei editierbar) */
  totalAmount?: number;
  onTotalChange?: (total: number) => void;
  /** Callback für Kurs-Update (overridePrice) */
  onCourseUpdate?: (index: number, update: Partial<CourseSelection>) => void;
  /** Zusätzlicher Menü-Preis pro Person (legacy, für Paket-Modus) */
  menuPricePerPerson?: number;
  /** Finaler Angebotspreis pro Person (Override) */
  finalPricePerPerson?: number | null;
  onFinalPriceChange?: (price: number | null) => void;
  /** Pricing-Modus: 'per_person' (Standard) oder 'per_event' (Gesamtpreis für Anlass) */
  pricingMode?: PricingMode;
  /** Callback wenn der Modus umgeschaltet wird */
  onPricingModeChange?: (mode: PricingMode) => void;
  /** Rabatt in Prozent (0–100, default 25) */
  discountPercent?: number;
  onDiscountChange?: (percent: number) => void;
  /** Rabatt als fester €-Betrag (Vorrang vor Prozent wenn > 0) */
  discountAmount?: number;
  onDiscountAmountChange?: (amount: number) => void;
  disabled?: boolean;
  /** Equipment-Items (Fixkosten) */
  equipment?: EquipmentItem[];
  /** Personal-Items (Fixkosten) */
  staff?: EquipmentItem[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Kompakter Toggle zwischen 'pro Person' und 'pro Anlass'.
 * Wird nur gerendert wenn onPricingModeChange gesetzt ist.
 */
function PricingModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: PricingMode;
  onChange: (mode: PricingMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/50 bg-muted/30 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange('per_person')}
        disabled={disabled}
        className={`px-2.5 py-1 rounded-md transition-colors ${
          mode === 'per_person'
            ? 'bg-background shadow-sm font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        pro Person
      </button>
      <button
        type="button"
        onClick={() => onChange('per_event')}
        disabled={disabled}
        className={`px-2.5 py-1 rounded-md transition-colors ${
          mode === 'per_event'
            ? 'bg-background shadow-sm font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        pro Anlass
      </button>
    </div>
  );
}

/**
 * Rabatt-Eingabe mit %/€-Toggle (analog Anzahlung).
 * Wert wird in `discountPercent` ODER `discountAmount` gespeichert.
 * Modus = 'amount' wenn discountAmount > 0, sonst 'percent'.
 */
function DiscountInput({
  percent,
  amount,
  onPercentChange,
  onAmountChange,
  disabled,
  tone = 'muted',
}: {
  percent: number;
  amount: number;
  onPercentChange: (v: number) => void;
  onAmountChange: (v: number) => void;
  disabled?: boolean;
  tone?: 'muted' | 'green';
}) {
  const mode: 'percent' | 'amount' = amount > 0 ? 'amount' : 'percent';
  const toneClass = tone === 'green' ? 'text-green-600' : 'text-muted-foreground';
  const setMode = (m: 'percent' | 'amount') => {
    if (m === 'percent') onAmountChange(0);
    else onPercentChange(0);
  };
  return (
    <div className={`flex items-center gap-1 ${toneClass}`}>
      <span>Rabatt</span>
      <div className="relative w-16">
        {mode === 'percent' ? (
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={percent || ''}
            placeholder="0"
            onChange={(e) => {
              const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
              onPercentChange(val);
            }}
            className={`h-5 rounded px-1.5 pr-5 text-right text-xs ${toneClass}`}
            disabled={disabled}
          />
        ) : (
          <Input
            type="number"
            min={0}
            step={1}
            value={amount || ''}
            placeholder="0"
            onChange={(e) => {
              const val = Math.max(0, parseFloat(e.target.value) || 0);
              onAmountChange(val);
            }}
            className={`h-5 rounded px-1.5 pr-5 text-right text-xs ${toneClass}`}
            disabled={disabled}
          />
        )}
      </div>
      <div className="inline-flex rounded border border-border/50 bg-muted/30 p-0.5 text-[10px] leading-none">
        <button
          type="button"
          onClick={() => setMode('percent')}
          disabled={disabled}
          className={`px-1.5 py-0.5 rounded transition-colors ${
            mode === 'percent' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          %
        </button>
        <button
          type="button"
          onClick={() => setMode('amount')}
          disabled={disabled}
          className={`px-1.5 py-0.5 rounded transition-colors ${
            mode === 'amount' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          €
        </button>
      </div>
    </div>
  );
}

/** Findet das beste MenuItem — bevorzugt Items mit Preis > 0 */
function findBestMenuItem(
  items: CombinedMenuItem[] | undefined,
  itemId: string | null,
  itemName: string
): CombinedMenuItem | undefined {
  if (!items?.length) return undefined;

  // Sammle alle Kandidaten
  const candidates: CombinedMenuItem[] = [];

  // 1. Exakte ID
  if (itemId) {
    const exact = items.find(m => m.id === itemId);
    if (exact) candidates.push(exact);
  }

  // 2. Name-basiert (startsWith für lange Namen die Beschreibung enthalten)
  if (itemName) {
    for (const m of items) {
      if (candidates.includes(m)) continue;
      if (
        m.name === itemName ||
        itemName.startsWith(m.name) ||
        m.name.startsWith(itemName)
      ) {
        candidates.push(m);
      }
    }
  }

  if (candidates.length === 0) return undefined;

  // Bevorzuge: Preis > 0, dann Ristorante vor Catering
  return candidates.sort((a, b) => {
    const aHasPrice = (a.price && a.price > 0) ? 1 : 0;
    const bHasPrice = (b.price && b.price > 0) ? 1 : 0;
    if (aHasPrice !== bHasPrice) return bHasPrice - aHasPrice;
    if (a.source === 'ristorante' && b.source !== 'ristorante') return -1;
    if (b.source === 'ristorante' && a.source !== 'ristorante') return 1;
    return 0;
  })[0];
}

export function PriceBreakdown({
  packageData,
  guestCount,
  courses,
  menuItems,
  winePairingPrice,
  totalAmount,
  onTotalChange,
  onCourseUpdate,
  menuPricePerPerson = 0,
  finalPricePerPerson,
  onFinalPriceChange,
  pricingMode = 'per_person',
  onPricingModeChange,
  discountPercent: discountPercentProp,
  onDiscountChange,
  discountAmount: discountAmountProp,
  onDiscountAmountChange,
  drinksLabel,
  disabled = false,
  equipment,
  staff,
}: PriceBreakdownProps) {
  // --- Menü-Modus (kein Paket) ---
  if (!packageData && onTotalChange !== undefined) {
    const discountPctVal = Math.min(100, Math.max(0, discountPercentProp ?? 0));
    const discountEurVal = Math.max(0, discountAmountProp ?? 0);
    const discountMode: 'percent' | 'amount' = discountEurVal > 0 ? 'amount' : 'percent';

    const dishLines = (courses || [])
      .map((c, idx) => {
        if (!c.itemId && !c.itemName) return null;
        const menuItem = findBestMenuItem(menuItems, c.itemId, c.itemName);
        const catalogPrice = menuItem?.price ?? null;
        // Einzelpreis stammt ausschließlich aus overridePrice — kein Katalog-Fallback.
        // Leere Zeile = 0 € Beitrag ("inkl."), damit der Angebotspreis auf Löschungen
        // reagiert (gleiches Verhalten wie im Paket-Modus / Network Aperitivo).
        const unitPrice = c.overridePrice != null && c.overridePrice > 0
          ? c.overridePrice
          : null;
        const quantity = c.quantity ?? 1;
        const lineTotal = unitPrice != null ? unitPrice * quantity : null;
        // Effektiver Modus pro Zeile: explizit > global-Fallback
        const effMode: 'per_person' | 'flat' = (c.priceMode ?? (pricingMode === 'per_event' ? 'flat' : 'per_person')) as 'per_person' | 'flat';
        return {
          index: idx,
          label: c.courseLabel,
          name: c.itemName,
          catalogPrice,
          unitPrice,
          quantity,
          lineTotal,
          lineMode: effMode,
          overridePrice: c.overridePrice,
        };
      })
      .filter(Boolean) as {
        index: number;
        label: string;
        name: string;
        catalogPrice: number | null;
        unitPrice: number | null;
        quantity: number;
        lineTotal: number | null;
        lineMode: 'per_person' | 'flat';
        overridePrice?: number | null;
      }[];

    const guestsForDiv = Math.max(1, guestCount);
    // Absolute Subtotale pro Zeile
    const dishAbs = dishLines.reduce((sum, d) => {
      const mult = d.lineMode === 'flat' ? 1 : guestsForDiv;
      return sum + (d.lineTotal || 0) * mult;
    }, 0);
    const winePerPerson = winePairingPrice || 0;
    const wineAbs = winePerPerson * guestsForDiv;
    const subtotalAbs = dishAbs + wineAbs;
    // Rabatt: €-Betrag hat Vorrang, % auf Subtotal
    const discountAmountTotal = discountMode === 'amount'
      ? Math.min(discountEurVal, subtotalAbs)
      : subtotalAbs * (discountPctVal / 100);
    const netAbs = subtotalAbs - discountAmountTotal;
    // Anzeige-Werte je nach globalem Modus
    const subtotalDisplay = pricingMode === 'per_event' ? subtotalAbs : (subtotalAbs / guestsForDiv);
    const netDisplay = pricingMode === 'per_event' ? netAbs : (netAbs / guestsForDiv);
    const discountDisplay = pricingMode === 'per_event' ? discountAmountTotal : (discountAmountTotal / guestsForDiv);

    // Equipment & Staff Summen
    const equipSum = (equipment || []).filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0).reduce((s, e) => s + e.pricePerUnit * e.quantity, 0);
    const staffSum = (staff || []).filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0).reduce((s, e) => s + e.pricePerUnit * e.quantity, 0);

    // MwSt-Ausweis: Maestro-Preise sind Brutto.
    // Speisen (Kurse) = 7 %, Getränke/Equipment/Personal = 19 %.
    // Aus den Brutto-Buckets ergibt sich proportional die enthaltene USt
    // auf dem finalen Brutto-Angebotspreis.
    const foodGross = dishAbs; // bereits rabattierbar
    const drinkGross = wineAbs; // rabattierbar
    const fixedGross19 = equipSum + staffSum; // nicht rabattierbar
    const rabattRatio = subtotalAbs > 0 ? netAbs / subtotalAbs : 1;
    const finalBruttoBase = netAbs + fixedGross19;
    const finalBruttoOverride =
      pricingMode === 'per_event'
        ? (finalPricePerPerson != null && finalPricePerPerson > 0 ? finalPricePerPerson : null)
        : (finalPricePerPerson != null && finalPricePerPerson > 0 ? finalPricePerPerson * guestsForDiv : null);
    const finalBrutto = finalBruttoOverride ?? finalBruttoBase;
    const refBrutto = (foodGross + drinkGross) * rabattRatio + fixedGross19;
    const scale = refBrutto > 0 ? finalBrutto / refBrutto : 0;
    const finalFoodGross = foodGross * rabattRatio * scale;
    const finalDrinkGross = (drinkGross * rabattRatio + fixedGross19) * scale;
    const ustFood = finalFoodGross > 0 ? finalFoodGross - finalFoodGross / 1.07 : 0;
    const ustDrink = finalDrinkGross > 0 ? finalDrinkGross - finalDrinkGross / 1.19 : 0;

    return (
      <div className="pt-3 border-t border-border/30 space-y-2">
        {/* Pricing-Mode Toggle — nur wenn Handler existiert */}
        {onPricingModeChange && (
          <div className="flex items-center justify-between pb-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
              Preis berechnen als
            </span>
            <PricingModeToggle mode={pricingMode} onChange={onPricingModeChange} disabled={disabled} />
          </div>
        )}
        {dishLines.length > 0 && (
          <div className="space-y-1.5">
            {/* Die Einzelposten werden jetzt direkt im MenuEditor oben gerendert
                (InlineCourseEditor mit integriertem Preis-Input + Zeilen-Total).
                Hier nur noch die Summen-Zeilen. */}

            {/* Getränke */}
            {winePairingPrice != null && winePerPerson > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{drinksLabel ?? 'Getränke'}</span>
                <span className="text-xs text-muted-foreground shrink-0 w-24 text-right pr-6">
                  {formatCurrency(winePerPerson)}
                </span>
              </div>
            )}

            {/* Zwischensumme */}
            {subtotalAbs > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/20">
                <span className="text-muted-foreground">
                  {pricingMode === 'per_event' ? 'Zwischensumme gesamt' : 'Zwischensumme / Pers.'}
                </span>
                <span className="font-medium">{formatCurrency(subtotalDisplay)}</span>
              </div>
            )}

            {/* Rabatt — Toggle immer sichtbar wenn Handler vorhanden */}
            {onDiscountChange && (
              <div className="flex items-center justify-between text-xs">
                <DiscountInput
                  percent={discountPctVal}
                  amount={discountEurVal}
                  onPercentChange={(v) => onDiscountChange?.(v)}
                  onAmountChange={(v) => onDiscountAmountChange?.(v)}
                  disabled={disabled}
                  tone="green"
                />
                {discountAmountTotal > 0 && (
                  <span className="text-green-600">−{formatCurrency(discountDisplay)}</span>
                )}
              </div>
            )}
            {/* Netto — nur wenn Rabatt aktiv */}
            {netAbs > 0 && discountAmountTotal > 0 && (
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  {pricingMode === 'per_event' ? 'Brutto nach Rabatt' : 'Brutto nach Rabatt / Pers.'}
                </span>
                <span>{formatCurrency(netDisplay)}</span>
              </div>
            )}
          </div>
        )}

        {/* Getränke alleinstehend (keine Gerichte) */}
        {dishLines.length === 0 && winePairingPrice != null && winePerPerson > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{drinksLabel ?? 'Getränke'} / Person</span>
              <span>{formatCurrency(winePerPerson)}</span>
            </div>
          </div>
        )}

        <Separator className="my-1" />

        {/* Equipment */}
        {equipSum > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Equipment</span>
            <span className="text-muted-foreground">{formatCurrency(equipSum)}</span>
          </div>
        )}

        {/* Personal */}
        {staffSum > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Personal</span>
            <span className="text-muted-foreground">{formatCurrency(staffSum)}</span>
          </div>
        )}

        {(equipSum > 0 || staffSum > 0) && <Separator className="my-1" />}

        {/* Errechneter Preis */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {pricingMode === 'per_event' ? 'Errechnet gesamt' : 'Errechnet / Person'}
          </span>
          <span className="text-sm text-muted-foreground">{formatCurrency(netDisplay)}</span>
        </div>

        {/* Finaler Angebotspreis — editierbar */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-sm font-semibold">
            {pricingMode === 'per_event' ? 'Angebotspreis gesamt' : 'Angebotspreis / Person'}
          </span>
          <div className="relative w-28 shrink-0">
            <Input
              type="number"
              value={finalPricePerPerson != null && finalPricePerPerson > 0 ? finalPricePerPerson : ''}
              onChange={(e) => {
                const val = e.target.value;
                onFinalPriceChange?.(val === '' ? null : parseFloat(val) || 0);
              }}
              placeholder={netDisplay > 0 ? netDisplay.toFixed(2) : '0,00'}
              className="h-9 rounded-xl pr-6 text-right text-sm font-bold"
              disabled={disabled}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              €
            </span>
          </div>
        </div>

        {/* MwSt-Ausweis: Brutto-Endpreise → enthaltene USt je Steuersatz */}
        {(ustFood > 0 || ustDrink > 0) && (
          <div className="pt-1 text-[10px] leading-snug text-muted-foreground text-right space-y-0.5">
            <div>Alle Preise inkl. gesetzl. MwSt. Im Brutto enthalten:</div>
            {ustFood > 0 && (
              <div>USt 7 % (Speisen): {formatCurrency(ustFood)}</div>
            )}
            {ustDrink > 0 && (
              <div>USt 19 % (Getränke/Equipment/Personal): {formatCurrency(ustDrink)}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Paket-Modus (mit Paket) ---
  if (!packageData) {
    return (
      <div className="pt-3 border-t border-border/30">
        <p className="text-sm text-muted-foreground text-center py-1">
          Paket wählen für Kalkulation
        </p>
      </div>
    );
  }

  // Override-Hinweis (gesetzt in OptionCard.effectivePackage, sobald budgetPerPerson > 0)
  const isOverridden = (packageData as Package & { __priceOverridden?: boolean }).__priceOverridden === true;

  // Wenn Override aktiv → Katalog-Logik (calculateEventPackagePrice, Tier-Breakdown) komplett umgehen.
  // Override-Wert wird je nach Pakettyp interpretiert:
  //   per_person → Wert × Gäste = Gesamtpreis
  //   flat       → Wert         = Gesamtpreis
  const locationTotal = isOverridden
    ? (packageData.price_per_person ? packageData.price * guestCount : packageData.price)
    : calculateEventPackagePrice(
        packageData.id,
        packageData.price,
        guestCount,
        !!packageData.price_per_person
      );

  const menuTotal = menuPricePerPerson * guestCount;
  const grandTotal = locationTotal + menuTotal;

  // Tier-Breakdown nur ohne Override anzeigen (sonst widerspruechlich zum Override-Wert)
  const isLocation = !isOverridden && isLocationPackage(packageData.id, packageData.price);
  const locationBreakdown = isLocation ? getLocationPricingBreakdown(guestCount) : null;

  // Rabatt-Berechnung (Paket-Modus) — analog zum Menü-Modus rein visuell.
  // Wenn kein finaler Override (finalPricePerPerson) gesetzt ist, fließt der
  // Rabatt ueber den Recalc-Effect in totalAmount; hier zeigen wir die
  // Aufstellung transparent an.
  const pkgDiscountPct = Math.min(100, Math.max(0, discountPercentProp ?? 0));
  const pkgDiscountEur = Math.max(0, discountAmountProp ?? 0);
  const pkgDiscountAmount = pkgDiscountEur > 0
    ? Math.min(pkgDiscountEur, grandTotal)
    : grandTotal * (pkgDiscountPct / 100);
  const pkgNetTotal = grandTotal - pkgDiscountAmount;

  return (
    <div className="pt-3 border-t border-border/30 space-y-2">
      {/* Pricing-Mode Toggle — nur wenn Handler existiert */}
      {onPricingModeChange && (
        <div className="flex items-center justify-between pb-2">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
            Preis berechnen als
          </span>
          <PricingModeToggle mode={pricingMode} onChange={onPricingModeChange} disabled={disabled} />
        </div>
      )}
      {/* Location-Preis */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {packageData.name}
          {packageData.price_per_person && guestCount > 0 && (
            <span className="text-xs ml-1">
              ({guestCount} × {formatCurrency(packageData.price)})
            </span>
          )}
        </span>
        <span className="font-medium">{formatCurrency(locationTotal)}</span>
      </div>

      {/* Location Tiered Breakdown */}
      {locationBreakdown && locationBreakdown.extraGuests > 0 && (
        <div className="text-xs text-muted-foreground pl-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Basis (bis {70} Gäste)</span>
            <span>{formatCurrency(locationBreakdown.basePrice)}</span>
          </div>
          <div className="flex justify-between">
            <span>+{locationBreakdown.extraGuests} Gäste × {formatCurrency(locationBreakdown.pricePerExtraGuest)}</span>
            <span>{formatCurrency(locationBreakdown.extraCost)}</span>
          </div>
        </div>
      )}

      {/* Menü-Preis (wenn vorhanden) */}
      {menuPricePerPerson > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Menü
            <span className="text-xs ml-1">
              ({guestCount} × {formatCurrency(menuPricePerPerson)})
            </span>
          </span>
          <span className="font-medium">{formatCurrency(menuTotal)}</span>
        </div>
      )}

      <Separator className="my-1" />

      {/* Rabatt — % oder € (Toggle) */}
      {onDiscountChange && (
        <div className="flex items-center justify-between text-xs">
          <DiscountInput
            percent={pkgDiscountPct}
            amount={pkgDiscountEur}
            onPercentChange={(v) => onDiscountChange?.(v)}
            onAmountChange={(v) => onDiscountAmountChange?.(v)}
            disabled={disabled}
          />
          {pkgDiscountAmount > 0 && (
            <span className="text-muted-foreground">−{formatCurrency(pkgDiscountAmount)}</span>
          )}
        </div>
      )}

      {/* Netto — nur wenn Rabatt aktiv */}
      {pkgDiscountAmount > 0 && (
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">
            {pricingMode === 'per_event' ? 'Brutto nach Rabatt' : 'Brutto nach Rabatt / Pers.'}
          </span>
          <span>
            {pricingMode === 'per_event'
              ? formatCurrency(pkgNetTotal)
              : (guestCount > 0 ? formatCurrency(pkgNetTotal / guestCount) : '—')}
          </span>
        </div>
      )}

      {/* Errechneter Preis */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {pricingMode === 'per_event' ? 'Errechnet gesamt' : 'Errechnet / Person'}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={guestCount > 0 ? (pkgNetTotal / guestCount).toFixed(2) : '0'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-muted-foreground"
          >
            {pricingMode === 'per_event'
              ? formatCurrency(pkgNetTotal)
              : (guestCount > 0 ? formatCurrency(pkgNetTotal / guestCount) : '—')}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Finaler Angebotspreis — editierbar */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-sm font-semibold">
          {pricingMode === 'per_event' ? 'Angebotspreis gesamt' : 'Angebotspreis / Person'}
        </span>
        <div className="relative w-28 shrink-0">
          <Input
            type="number"
            value={finalPricePerPerson != null && finalPricePerPerson > 0 ? finalPricePerPerson : ''}
            onChange={(e) => {
              const val = e.target.value;
              onFinalPriceChange?.(val === '' ? null : parseFloat(val) || 0);
            }}
            placeholder={
              pricingMode === 'per_event'
                ? (pkgNetTotal > 0 ? pkgNetTotal.toFixed(2) : '0,00')
                : (guestCount > 0 ? (pkgNetTotal / guestCount).toFixed(2) : '0,00')
            }
            className="h-9 rounded-xl pr-6 text-right text-sm font-bold"
            disabled={disabled}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            €
          </span>
        </div>
      </div>

      {/* MwSt-Ausweis (Paket-Modus): Brutto-Endpreis, USt 7 % enthalten */}
      {(() => {
        const finalBrutto = (finalPricePerPerson != null && finalPricePerPerson > 0)
          ? (pricingMode === 'per_event' ? finalPricePerPerson : finalPricePerPerson * guestCount)
          : pkgNetTotal;
        const ust = finalBrutto > 0 ? finalBrutto - finalBrutto / 1.07 : 0;
        if (ust <= 0) return null;
        return (
          <div className="pt-1 text-[10px] leading-snug text-muted-foreground text-right">
            Alle Preise inkl. gesetzl. MwSt. — enthaltene USt 7 %: {formatCurrency(ust)}
          </div>
        );
      })()}
    </div>
  );
}
