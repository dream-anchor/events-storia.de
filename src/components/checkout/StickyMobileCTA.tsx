import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

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

  const buttonText = paymentMethod === 'stripe'
    ? (language === 'de' ? 'Jetzt bezahlen' : 'Pay Now')
    : (language === 'de' ? 'Bestellung absenden' : 'Submit Order');

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
      "bg-background/95 backdrop-blur-md border-t border-border",
      "p-4 pb-safe",
      className
    )}>
      {/* Trust Elements */}
      <div className="flex items-center justify-center gap-2 mb-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
        <span>{language === 'de' ? 'Sichere Zahlung' : 'Secure Payment'}</span>
        <span className="mx-1">•</span>
        <CreditCard className="h-3.5 w-3.5" />
        <span>Visa / Mastercard</span>
      </div>

      {/* CTA Button */}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full h-12 text-base font-semibold"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
          </>
        ) : (
          <>
            {buttonText} · {formatPrice(totalAmount)}
          </>
        )}
      </Button>
    </div>
  );
};

export default StickyMobileCTA;
