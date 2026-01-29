import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import visaIcon from "@/assets/payment-logos/visa.svg";
import mastercardIcon from "@/assets/payment-logos/mastercard.svg";
import applePayIcon from "@/assets/payment-logos/apple-pay.svg";
import klarnaIcon from "@/assets/payment-logos/klarna.svg";

interface StickyMobileCTAProps {
  totalAmount: number;
  isSubmitting: boolean;
  paymentMethod: string;
  onSubmit: () => void;
  className?: string;
}

const StickyMobileCTA = ({
  totalAmount,
  isSubmitting,
  paymentMethod,
  onSubmit,
  className
}: StickyMobileCTAProps) => {
  const { language } = useLanguage();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const buttonText = language === 'de' 
    ? 'Zahlungspflichtig bestellen' 
    : 'Place binding order';

  // Compact payment logos for mobile
  const compactLogos = [
    { name: "Visa", icon: visaIcon },
    { name: "Mastercard", icon: mastercardIcon },
    { name: "Apple Pay", icon: applePayIcon },
    { name: "Klarna", icon: klarnaIcon },
  ];

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
      "bg-background/98 backdrop-blur-lg border-t border-border shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]",
      "p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
      className
    )}>
      {/* Trust Elements Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
          <span>{language === 'de' ? 'Sichere Zahlung' : 'Secure Payment'}</span>
        </div>
        
        {/* Compact Payment Logos */}
        <div className="flex items-center gap-1">
          {compactLogos.map((method) => (
            <div 
              key={method.name}
              className="h-5 px-1 bg-card rounded border border-border/50 flex items-center justify-center"
              title={method.name}
            >
              <img 
                src={method.icon} 
                alt={method.name} 
                className="h-3.5 w-auto object-contain"
              />
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-1">+7</span>
        </div>
      </div>

      {/* CTA Button */}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        variant="checkoutCta"
        className="w-full h-14 text-base shadow-lg"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            <span className="flex-1 text-left">{buttonText}</span>
            <span className="font-bold">{formatPrice(totalAmount)}</span>
          </>
        )}
      </Button>
    </div>
  );
};

export default StickyMobileCTA;
