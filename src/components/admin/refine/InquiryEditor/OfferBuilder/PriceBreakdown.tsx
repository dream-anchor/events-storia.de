import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { calculateEventPackagePrice, isLocationPackage, getLocationPricingBreakdown } from "@/lib/eventPricing";
import type { Package } from "../types";
import type { CourseSelection } from "./types";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

interface PriceBreakdownProps {
  packageData: Package | undefined;
  guestCount: number;
  /** Menü-Modus: Kurse mit Einzelpreisen */
  courses?: CourseSelection[];
  menuItems?: CombinedMenuItem[];
  /** Weinbegleitung pro Person */
  winePairingPrice?: number | null;
  /** Manueller Gesamtpreis (frei editierbar) */
  totalAmount?: number;
  onTotalChange?: (total: number) => void;
  /** Callback für Kurs-Update (overridePrice) */
  onCourseUpdate?: (index: number, update: Partial<CourseSelection>) => void;
  /** Zusätzlicher Menü-Preis pro Person (legacy, für Paket-Modus) */
  menuPricePerPerson?: number;
  disabled?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
  disabled = false,
}: PriceBreakdownProps) {
  // --- Menü-Modus (kein Paket) ---
  if (!packageData && onTotalChange !== undefined) {
    const DISCOUNT = 0.20; // 20% interner Rabatt

    const dishLines = (courses || [])
      .map((c, idx) => {
        if (!c.itemId && !c.itemName) return null;
        const menuItem = findBestMenuItem(menuItems, c.itemId, c.itemName);
        const catalogPrice = menuItem?.price ?? null;
        // overridePrice hat Vorrang, sonst Katalogpreis (voller Preis, ohne Rabatt)
        const price = c.overridePrice != null && c.overridePrice > 0
          ? c.overridePrice
          : (catalogPrice && catalogPrice > 0 ? catalogPrice : null);
        return {
          index: idx,
          label: c.courseLabel,
          name: c.itemName,
          catalogPrice,
          price,
          overridePrice: c.overridePrice,
        };
      })
      .filter(Boolean) as {
        index: number;
        label: string;
        name: string;
        catalogPrice: number | null;
        price: number | null;
        overridePrice?: number | null;
      }[];

    const dishSubtotal = dishLines.reduce((sum, d) => sum + (d.price || 0), 0);
    const winePerPerson = winePairingPrice || 0;
    const subtotalPerPerson = dishSubtotal + winePerPerson;
    const discountAmount = dishSubtotal * DISCOUNT;
    const netPerPerson = subtotalPerPerson - discountAmount;
    const calculatedTotal = netPerPerson * guestCount;

    return (
      <div className="pt-3 border-t border-border/30 space-y-2">
        {dishLines.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
              Preis pro Person
            </span>

            {/* Einzelgerichte (Originalpreise, editierbar) */}
            {dishLines.map((d) => (
              <div key={d.index} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {d.label}: {d.name}
                </span>
                <div className="relative w-24 shrink-0">
                  <Input
                    type="number"
                    value={d.overridePrice != null && d.overridePrice > 0 ? d.overridePrice : (d.catalogPrice && d.catalogPrice > 0 ? d.catalogPrice : '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      onCourseUpdate?.(d.index, {
                        overridePrice: val === '' ? null : parseFloat(val) || 0,
                      });
                    }}
                    placeholder={d.catalogPrice != null && d.catalogPrice > 0 ? d.catalogPrice.toFixed(2) : '—'}
                    className="h-7 rounded-lg pr-6 text-right text-xs"
                    disabled={disabled}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    €
                  </span>
                </div>
              </div>
            ))}

            {/* Weinbegleitung */}
            {winePairingPrice != null && winePerPerson > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Weinbegleitung</span>
                <span className="text-xs text-muted-foreground shrink-0 w-24 text-right pr-6">
                  {formatCurrency(winePerPerson)}
                </span>
              </div>
            )}

            {/* Zwischensumme pro Person */}
            {subtotalPerPerson > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/20">
                <span className="text-muted-foreground">Zwischensumme / Pers.</span>
                <span className="font-medium">{formatCurrency(subtotalPerPerson)}</span>
              </div>
            )}

            {/* -20% Rabatt */}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-green-600">
                <span>−{Math.round(DISCOUNT * 100)}% Rabatt</span>
                <span>−{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {/* Netto pro Person */}
            {netPerPerson > 0 && discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Netto / Person</span>
                <span>{formatCurrency(netPerPerson)}</span>
              </div>
            )}

            {/* × Gäste */}
            {netPerPerson > 0 && guestCount > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                <span>{formatCurrency(netPerPerson)} × {guestCount} Gäste</span>
                <span>{formatCurrency(calculatedTotal)}</span>
              </div>
            )}
          </div>
        )}

        {/* Weinbegleitung alleinstehend */}
        {dishLines.length === 0 && winePairingPrice != null && winePerPerson > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Weinbegleitung / Person</span>
              <span>{formatCurrency(winePerPerson)}</span>
            </div>
            {guestCount > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                <span>{formatCurrency(winePerPerson)} × {guestCount} Gäste</span>
                <span>{formatCurrency(winePerPerson * guestCount)}</span>
              </div>
            )}
          </div>
        )}

        <Separator className="my-1" />

        {/* Gesamtpreis */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Gesamtpreis</span>
          <span className="text-lg font-bold tracking-tight">{formatCurrency(calculatedTotal)}</span>
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

  const locationTotal = calculateEventPackagePrice(
    packageData.id,
    packageData.price,
    guestCount,
    !!packageData.price_per_person
  );

  const menuTotal = menuPricePerPerson * guestCount;
  const grandTotal = locationTotal + menuTotal;

  const isLocation = isLocationPackage(packageData.id, packageData.price);
  const locationBreakdown = isLocation ? getLocationPricingBreakdown(guestCount) : null;

  return (
    <div className="pt-3 border-t border-border/30 space-y-2">
      {/* Location-Preis */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {packageData.name}
          {packageData.price_per_person && (
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

      {/* Gästeanzahl */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Gäste
        </span>
        <span>{guestCount}</span>
      </div>

      <Separator className="my-1" />

      {/* Gesamt */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Gesamt</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={grandTotal.toFixed(2)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-lg font-bold tracking-tight"
          >
            {formatCurrency(grandTotal)}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
