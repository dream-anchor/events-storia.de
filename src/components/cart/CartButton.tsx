import { ShoppingCart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLocalizedPath } from '@/hooks/useLocalizedPath';
import { useCart } from '@/contexts/CartContext';
import { usePriceDisplay, cateringLineParts } from '@/contexts/PriceDisplayContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatEuro } from '@/lib/gift/pricing';

const CartButton = () => {
  const { items, totalItems, totalPrice, giftItemCount } = useCart();
  const { formatPrice, formatPriceMixed, showGross } = usePriceDisplay();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { getPath } = useLocalizedPath();

  // Hide on checkout page, admin pages, or when cart is empty
  // Live-URLs enden auf "/" (z. B. /checkout/), daher Schrägstrich am Ende ignorieren
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/checkout' || path === '/en/checkout') return null;
  if (path.startsWith('/admin')) return null;
  if (path === '/anfrage' || path === '/en/anfrage') return null;
  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => navigate(getPath('checkout'))}
      className={cn(
        "fixed top-[120px] right-4 z-[60]",
        "flex flex-col items-center gap-1",
        "bg-background/80 backdrop-blur-lg",
        "border border-border/50 rounded-xl",
        "px-4 py-3",
        "shadow-lg hover:shadow-xl",
        "hover:scale-[1.02]",
        "transition-all duration-300"
      )}
      aria-label={language === 'de' ? 'Zur Kasse' : 'Checkout'}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {language === 'de' ? 'Zur Kasse' : 'Checkout'}
      </span>
      
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-sm font-semibold">
          {totalItems}
        </span>
        <span className="font-medium text-sm">
          {/* Geschenkkörbe haben gemischte Steuersätze: sobald welche im Warenkorb sind, immer Bruttopreis */}
          {giftItemCount > 0 ? formatEuro(Math.round(totalPrice * 100), language) : showGross ? formatPrice(totalPrice) : formatPriceMixed(cateringLineParts(items))}
        </span>
      </div>
    </button>
  );
};

export default CartButton;
