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
        // overridePrice hat Vorrang, sonst Katalogpreis (voller Preis, ohne Rabatt)
        const unitPrice = c.overridePrice != null && c.overridePrice > 0
          ? c.overridePrice
          : (catalogPrice && catalogPrice > 0 ? catalogPrice : null);
        const quantity = c.quantity ?? 1;
        const lineTotal = unitPrice != null ? unitPrice * quantity : null;
        return {
          index: idx,
          label: c.courseLabel,
          name: c.itemName,
          catalogPrice,
          unitPrice,
          quantity,
          lineTotal,
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
        overridePrice?: number | null;
      }[];

    const dishSubtotal = dishLines.reduce((sum, d) => sum + (d.lineTotal || 0), 0);
    const winePerPerson = winePairingPrice || 0;
    const subtotalPerPerson = dishSubtotal + winePerPerson;
    const guestsForDiv = Math.max(1, guestCount);
    // Rabatt: €-Betrag hat Vorrang, gilt auf Total → pro Person dividieren.
    // Prozent: gilt auf dishSubtotal pro Person.
    const discountAmountTotal = discountMode === 'amount'
      ? Math.min(discountEurVal, subtotalPerPerson * guestsForDiv)
      : dishSubtotal * (discountPctVal / 100) * guestsForDiv;
    const discountAmount = discountAmountTotal / guestsForDiv;
    const netPerPerson = subtotalPerPerson - discountAmount;
    const calculatedTotal = netPerPerson * guestCount;

    // Equipment & Staff Summen
    const equipSum = (equipment || []).filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0).reduce((s, e) => s + e.pricePerUnit * e.quantity, 0);
    const staffSum = (staff || []).filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0).reduce((s, e) => s + e.pricePerUnit * e.quantity, 0);

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
            {subtotalPerPerson > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/20">
                <span className="text-muted-foreground">
                  {pricingMode === 'per_event' ? 'Zwischensumme gesamt' : 'Zwischensumme / Pers.'}
                </span>
                <span className="font-medium">{formatCurrency(subtotalPerPerson)}</span>
              </div>
            )}

            {/* Rabatt — nur sichtbar wenn > 0 */}
            {(discountPercentProp ?? 0) > 0 && (<>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-green-600">
                <span>Rabatt</span>
                <div className="relative w-14">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={discountPercentProp ?? 0}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                      onDiscountChange?.(val);
                    }}
                    className="h-5 rounded px-1.5 pr-4 text-right text-xs text-green-600"
                    disabled={disabled}
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-green-600">%</span>
                </div>
              </div>
              {discountAmount > 0 && (
                <span className="text-green-600">−{formatCurrency(discountAmount)}</span>
              )}
            </div>

            </>)}
            {/* Netto — nur wenn Rabatt aktiv */}
            {netPerPerson > 0 && discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  {pricingMode === 'per_event' ? 'Netto gesamt' : 'Netto / Person'}
                </span>
                <span>{formatCurrency(netPerPerson)}</span>
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
          <span className="text-sm text-muted-foreground">{formatCurrency(netPerPerson)}</span>
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
              placeholder={netPerPerson > 0 ? netPerPerson.toFixed(2) : '0,00'}
              className="h-9 rounded-xl pr-6 text-right text-sm font-bold"
              disabled={disabled}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              €
            </span>
          </div>
        </div>
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
  const pkgDiscountPct = discountPercentProp ?? 0;
  const pkgDiscountAmount = grandTotal * (pkgDiscountPct / 100);
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

      {/* Rabatt — frei eingebbar, 0–100 % */}
      {onDiscountChange && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>Rabatt</span>
            <div className="relative w-14">
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={pkgDiscountPct || ''}
                placeholder="0"
                onChange={(e) => {
                  const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                  onDiscountChange?.(val);
                }}
                className="h-5 rounded px-1.5 pr-4 text-right text-xs"
                disabled={disabled}
              />
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
            </div>
          </div>
          {pkgDiscountAmount > 0 && (
            <span className="text-muted-foreground">−{formatCurrency(pkgDiscountAmount)}</span>
          )}
        </div>
      )}

      {/* Netto — nur wenn Rabatt aktiv */}
      {pkgDiscountAmount > 0 && (
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">
            {pricingMode === 'per_event' ? 'Netto gesamt' : 'Netto / Person'}
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
    </div>
  );
}
