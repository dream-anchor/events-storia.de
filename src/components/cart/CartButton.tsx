import { ShoppingCart } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

const CartButton = () => {
  const { totalItems, totalPrice, setIsOpen, isOpen } = useCart();
  const location = useLocation();

  // Hide on checkout page
  if (location.pathname === '/checkout') return null;
  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "fixed top-24 right-4 z-[60]",
        "flex items-center gap-2 px-4 py-3",
        "rounded-full",
        // Glassmorphism effect
        "bg-background/80 dark:bg-background/70",
        "backdrop-blur-lg",
        "border border-border/50",
        // Shadow
        "shadow-lg shadow-black/5 dark:shadow-black/20",
        // Hover effects
        "hover:shadow-xl hover:scale-[1.02] hover:bg-background/90",
        "transition-all duration-300 ease-out",
        // Animation
        "animate-in slide-in-from-right-4"
      )}
      aria-label={`Warenkorb (${totalItems} Artikel)`}
    >
      <ShoppingCart className="h-5 w-5 text-primary" />
      
      <span className={cn(
        "flex items-center justify-center",
        "min-w-[24px] h-6 px-2 text-sm font-semibold rounded-full",
        "bg-primary text-primary-foreground"
      )}>
        {totalItems}
      </span>
      
      {/* Price - hidden on mobile for cleaner look */}
      <span className="hidden sm:block text-sm font-medium text-foreground border-l border-border/50 pl-2 ml-1">
        {totalPrice.toFixed(2).replace('.', ',')} €
      </span>
    </button>
  );
};

export default CartButton;
