import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CartSheet = () => {
  const { items, isOpen, setIsOpen, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const handleCheckout = () => {
    setIsOpen(false);
    navigate('/checkout');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {language === 'de' ? 'Warenkorb' : 'Shopping Cart'}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-center">
              {language === 'de' 
                ? 'Ihr Warenkorb ist leer'
                : 'Your cart is empty'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {items.map((item) => {
                const name = language === 'en' && item.name_en ? item.name_en : item.name;
                return (
                  <div key={item.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                    {item.image && (
                      <img 
                        src={item.image} 
                        alt={name}
                        className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{name}</h4>
                      <p className="text-primary font-semibold text-sm">
                        {item.price.toFixed(2).replace('.', ',')} €
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                            aria-label="Menge reduzieren"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                            aria-label="Menge erhöhen"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                          aria-label="Artikel entfernen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {language === 'de' ? 'Zwischensumme' : 'Subtotal'}
                </span>
                <span className="text-xl font-bold text-primary">
                  {totalPrice.toFixed(2).replace('.', ',')} €
                </span>
              </div>
              
              <Button onClick={handleCheckout} className="w-full" size="lg">
                {language === 'de' ? 'Zur Bestellung' : 'Proceed to Order'}
              </Button>
              
              <button
                onClick={clearCart}
                className="w-full text-sm text-muted-foreground hover:text-destructive transition-colors text-center"
              >
                {language === 'de' ? 'Warenkorb leeren' : 'Clear cart'}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartSheet;
