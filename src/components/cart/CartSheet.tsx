import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePriceDisplay } from '@/contexts/PriceDisplayContext';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  isLocationPackage, 
  getLocationPricingBreakdown,
  LOCATION_BASE_GUESTS,
  LOCATION_PACKAGE_ID
} from '@/lib/eventPricing';

const CartSheet = () => {
  const { items, isOpen, setIsOpen, updateQuantity, removeFromCart, totalPrice, clearCart, totalItems } = useCart();
  const { language } = useLanguage();
  const { formatPrice } = usePriceDisplay();
  const navigate = useNavigate();

  const handleCheckout = () => {
    setIsOpen(false);
    navigate('/checkout');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col bg-background/95 backdrop-blur-xl border-l border-border/50">
        <SheetHeader className="border-b border-border/50 pb-4">
          <SheetTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span>{language === 'de' ? 'Warenkorb' : 'Shopping Cart'}</span>
              {totalItems > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {totalItems} {language === 'de' ? 'Artikel' : 'items'}
                </span>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-muted-foreground font-medium">
                {language === 'de' 
                  ? 'Ihr Warenkorb ist leer'
                  : 'Your cart is empty'}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {language === 'de' 
                  ? 'Stöbern Sie in unseren Catering-Angeboten'
                  : 'Browse our catering offerings'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-3 -mx-6 px-6">
              {items.map((item) => {
                const name = language === 'en' && item.name_en ? item.name_en : item.name;
                
                // Check if this is the Location package with tiered pricing
                const packageId = item.packageId || (item.id.startsWith('event-') ? item.id.replace('event-', '') : '');
                const isLocationPkg = item.isEventPackage && isLocationPackage(packageId);
                const hasTieredPricing = isLocationPkg && item.quantity > LOCATION_BASE_GUESTS;
                const pricingBreakdown = isLocationPkg ? getLocationPricingBreakdown(item.quantity) : null;
                
                // Calculate item total (price is already effective unit price from ShopCard)
                const itemTotal = item.price * item.quantity;
                
                return (
                  <div 
                    key={item.id} 
                    className="group relative bg-card/80 backdrop-blur-sm rounded-xl overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex gap-3 p-3">
                      {item.image && (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                          <img 
                            src={item.image} 
                            alt={`${name} – Warenkorb`}
                            className="w-full h-full object-cover"
                            width="80"
                            height="80"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h4 className="font-medium text-sm leading-tight line-clamp-2">{name}</h4>
                          {item.serving_info && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.serving_info}</p>
                          )}
                          {/* Show tiered pricing breakdown for Location package */}
                          {hasTieredPricing && pricingBreakdown && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {language === 'de' 
                                ? `8.500 € + ${pricingBreakdown.extraGuests} × 121,43 €`
                                : `€8,500 + ${pricingBreakdown.extraGuests} × €121.43`}
                            </p>
                          )}
                        </div>
                        <p className="text-primary font-semibold">
                          {formatPrice(itemTotal)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Bottom Controls Bar */}
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border/30">
                      <div className="flex items-center gap-1 bg-background rounded-full p-1 shadow-inner">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors touch-manipulation"
                          aria-label="Menge reduzieren"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-10 text-center font-medium text-base tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors touch-manipulation"
                          aria-label="Menge erhöhen"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all duration-200 touch-manipulation"
                        aria-label="Artikel entfernen"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Footer */}
            <div className="border-t border-border/50 pt-4 space-y-4 bg-background/80 backdrop-blur-sm -mx-6 px-6 pb-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {language === 'de' ? 'Zwischensumme' : 'Subtotal'}
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {formatPrice(totalPrice)}
                </span>
              </div>
              
              <Button 
                onClick={handleCheckout} 
                className="w-full rounded-full h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
                size="lg"
              >
                {language === 'de' ? 'Zur Kasse' : 'To Checkout'}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              <button
                onClick={clearCart}
                className="w-full text-sm text-muted-foreground hover:text-destructive transition-colors text-center py-2"
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
