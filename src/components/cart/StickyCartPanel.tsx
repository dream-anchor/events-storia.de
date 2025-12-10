import { Minus, Plus, Trash2, ShieldCheck, Award } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { usePriceDisplay } from '@/contexts/PriceDisplayContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const StickyCartPanel = () => {
  const { items, totalItems, totalPrice, updateQuantity, removeFromCart } = useCart();
  const { formatPrice } = usePriceDisplay();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on checkout page or when cart is empty
  if (location.pathname === '/checkout' || totalItems === 0) return null;

  const handleCheckout = () => {
    navigate('/checkout');
  };

  // Calculate VAT breakdown (7% for food items)
  const netAmount = totalPrice / 1.07;
  const vatAmount = totalPrice - netAmount;

  return (
    <div className={cn(
      "fixed top-[120px] right-4 z-40 w-80 md:w-96",
      "bg-background/95 backdrop-blur-lg border border-border rounded-xl",
      "shadow-lg"
    )}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-serif text-lg font-medium">
          {language === 'de' ? 'Ihre Bestellung' : 'Your Order'}
        </h3>
      </div>

      {/* Cart Items - scrollable */}
      <div className="max-h-[30vh] overflow-y-auto px-4 py-2">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="flex items-center justify-between py-2 border-b border-dashed border-border/50 last:border-0"
          >
            <div className="flex-1 min-w-0 pr-2">
              <p className="font-medium text-sm truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity}× {formatPrice(item.price)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                aria-label={language === 'de' ? 'Weniger' : 'Less'}
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                aria-label={language === 'de' ? 'Mehr' : 'More'}
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                onClick={() => removeFromCart(item.id)}
                className="w-8 h-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors ml-1"
                aria-label={language === 'de' ? 'Entfernen' : 'Remove'}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Price Breakdown */}
      <div className="px-4 py-2 border-t border-dashed border-border/50 text-sm">
        <div className="flex justify-between">
          <span>{language === 'de' ? 'Zwischensumme' : 'Subtotal'}</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground text-xs mt-1">
          <span>{language === 'de' ? 'Nettobetrag' : 'Net amount'}</span>
          <span>{formatPrice(netAmount)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>{language === 'de' ? '+ 7% MwSt. (Speisen)' : '+ 7% VAT (Food)'}</span>
          <span>{formatPrice(vatAmount)}</span>
        </div>
      </div>

      {/* Total */}
      <div className="px-4 py-2 border-t border-border flex justify-between items-center">
        <span className="font-medium">
          {language === 'de' ? 'Gesamtbetrag (brutto)' : 'Total (gross)'}
        </span>
        <span className="text-xl font-bold text-primary">{formatPrice(totalPrice)}</span>
      </div>

      {/* CTA Button */}
      <div className="px-4 py-3">
        <Button 
          onClick={handleCheckout} 
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {language === 'de' ? 'Zur Kasse' : 'Checkout'} · {formatPrice(totalPrice)}
        </Button>
      </div>

      {/* Trust Badges */}
      <div className="px-4 py-2 flex items-center justify-center gap-4 text-xs text-muted-foreground border-t border-border">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
          {language === 'de' ? 'Sichere Übertragung' : 'Secure Transfer'}
        </span>
        <span className="flex items-center gap-1">
          <Award className="h-3.5 w-3.5 text-amber-600" />
          100+ {language === 'de' ? 'erfolgreiche Caterings' : 'successful caterings'}
        </span>
      </div>
    </div>
  );
};

export default StickyCartPanel;
