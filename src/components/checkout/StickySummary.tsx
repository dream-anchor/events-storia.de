import { ReactNode } from "react";
import { Minus, Plus, Trash2, Info, Flame, ShieldCheck, Lock } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { Button } from "@/components/ui/button";
import TrustBadges from "./TrustBadges";
import { cn } from "@/lib/utils";

interface StickySummaryProps {
  deliveryCost?: number;
  minimumOrderSurcharge?: number;
  chafingDishQuantity?: number;
  chafingDishPrice?: number;
  grandTotal: number;
  foodVat7?: number;
  deliveryVat19?: number;
  isDelivery?: boolean;
  isSubmitting?: boolean;
  isProcessingPayment?: boolean;
  distanceKm?: number;
  isRoundTrip?: boolean;
  oneWayDistanceKm?: number;
  className?: string;
  ctaButton?: ReactNode;
}

const StickySummary = ({
  deliveryCost = 0,
  minimumOrderSurcharge = 0,
  chafingDishQuantity = 0,
  chafingDishPrice = 25,
  grandTotal,
  foodVat7 = 0,
  deliveryVat19 = 0,
  isDelivery = true,
  distanceKm,
  isRoundTrip,
  oneWayDistanceKm,
  className,
  ctaButton,
}: StickySummaryProps) => {
  const { items, updateQuantity, removeFromCart, totalPrice } = useCart();
  const { language } = useLanguage();
  const { formatPrice, showGross, setShowGross } = usePriceDisplay();

  const chafingDishGross = chafingDishQuantity * chafingDishPrice;

  return (
    <div className={cn("sticky top-6", className)}>
      <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="font-serif text-lg flex items-center gap-2">
          {language === 'de' ? 'Ihre Bestellung' : 'Your Order'}
          <span className="text-sm font-normal text-muted-foreground">
            ({items.length} {language === 'de' ? 'Artikel' : 'items'})
          </span>
        </h2>

        {/* Items list */}
        <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
          {items.map((item) => {
            const name = language === 'en' && item.name_en ? item.name_en : item.name;
            return (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                {item.image && (
                  <img
                    src={item.image}
                    alt={`${name} – Warenkorb`}
                    className="w-12 h-12 rounded-lg object-cover"
                    width="48"
                    height="48"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity}× {formatPrice(item.price)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-xs">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.id)}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Brutto/Netto Toggle */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <span className="text-sm text-muted-foreground">
            {language === 'de' ? 'Preisanzeige' : 'Price display'}
          </span>
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setShowGross(true)}
              className={cn(
                "px-2.5 py-1.5 rounded-md transition-colors",
                showGross
                  ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 font-medium"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              Brutto
            </button>
            <button
              type="button"
              onClick={() => setShowGross(false)}
              className={cn(
                "px-2.5 py-1.5 rounded-md transition-colors",
                !showGross
                  ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 font-medium"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              Netto
            </button>
          </div>
        </div>

        {/* Pricing breakdown */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              {language === 'de' ? 'Zwischensumme' : 'Subtotal'}
            </span>
            <span>{formatPrice(totalPrice)}</span>
          </div>

          {minimumOrderSurcharge > 0 && (
            <div className="flex justify-between items-center text-sm text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                {language === 'de' ? 'Mindestbest.-Aufschlag' : 'Min. order surcharge'}
              </span>
              <span>+{formatPrice(minimumOrderSurcharge)}</span>
            </div>
          )}

          {chafingDishQuantity > 0 && (
            <div className="flex justify-between items-center text-sm text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {chafingDishQuantity}× Chafing Dish
              </span>
              <span>+{formatPrice(chafingDishGross)}</span>
            </div>
          )}

          {isDelivery && deliveryCost > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {language === 'de' ? 'Lieferung' : 'Delivery'}
                {isRoundTrip && oneWayDistanceKm && oneWayDistanceKm > 25 && (
                  <span className="text-xs block text-muted-foreground/70">
                    ({oneWayDistanceKm} km × 2)
                  </span>
                )}
              </span>
              <span>+{formatPrice(deliveryCost)}</span>
            </div>
          )}

          {isDelivery && deliveryCost === 0 && (
            <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
              <span>{language === 'de' ? 'Lieferung' : 'Delivery'}</span>
              <span>{language === 'de' ? 'Kostenlos' : 'Free'}</span>
            </div>
          )}

          {/* VAT breakdown */}
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/50 space-y-1">
            {foodVat7 > 0 && (
              <div className="flex justify-between">
                <span>{language === 'de' ? 'inkl. 7% MwSt. (Speisen)' : 'incl. 7% VAT (food)'}</span>
                <span>{formatPrice(foodVat7)}</span>
              </div>
            )}
            {deliveryVat19 > 0 && (
              <div className="flex justify-between">
                <span>{language === 'de' ? 'inkl. 19% MwSt. (Lieferung)' : 'incl. 19% VAT (delivery)'}</span>
                <span>{formatPrice(deliveryVat19)}</span>
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="flex justify-between items-center pt-3 border-t border-border">
            <span className="font-serif text-lg font-semibold">
              {language === 'de' ? 'Gesamt' : 'Total'}
            </span>
            <span className="font-serif text-xl font-bold text-gray-900 dark:text-white">
              {formatPrice(grandTotal)}
            </span>
          </div>
        </div>

        {/* CTA Button slot */}
        {ctaButton && <div className="pt-2">{ctaButton}</div>}

        {/* Trust badges */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              SSL
            </span>
            <span className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              {language === 'de' ? 'Sichere Zahlung' : 'Secure Payment'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickySummary;
