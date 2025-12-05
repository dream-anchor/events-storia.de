import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

const CartButton = () => {
  const { totalItems, setIsOpen, isOpen } = useCart();

  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "fixed top-24 right-4 z-40 flex items-center justify-center",
        "w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg",
        "hover:bg-primary/90 transition-all duration-300 hover:scale-105",
        "animate-in slide-in-from-right-4"
      )}
      aria-label={`Warenkorb (${totalItems} Artikel)`}
    >
      <ShoppingCart className="h-6 w-6" />
      <span className={cn(
        "absolute -top-1 -right-1 flex items-center justify-center",
        "min-w-[22px] h-[22px] px-1 text-xs font-bold rounded-full",
        "bg-accent text-accent-foreground animate-pulse"
      )}>
        {totalItems}
      </span>
    </button>
  );
};

export default CartButton;
