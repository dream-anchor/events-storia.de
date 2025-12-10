import { ShoppingCart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { usePriceDisplay } from '@/contexts/PriceDisplayContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const CartButton = () => {
  const { totalItems, totalPrice } = useCart();
  const { formatPrice } = usePriceDisplay();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on checkout page or when cart is empty
  if (location.pathname === '/checkout') return null;
  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => navigate('/checkout')}
      className={cn(
        "fixed top-[120px] right-4 z-40",
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
        <span className="font-medium text-sm">{formatPrice(totalPrice)}</span>
      </div>
    </button>
  );
};

export default CartButton;
