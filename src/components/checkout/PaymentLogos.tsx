import { cn } from "@/lib/utils";

import visaIcon from "@/assets/payment-logos/visa.svg";
import mastercardIcon from "@/assets/payment-logos/mastercard.svg";
import amexIcon from "@/assets/payment-logos/american-express.svg";
import applePayIcon from "@/assets/payment-logos/apple-pay.svg";
import googlePayIcon from "@/assets/payment-logos/google-pay.svg";
import klarnaIcon from "@/assets/payment-logos/klarna.svg";
import sepaIcon from "@/assets/payment-logos/sepa.svg";
import idealIcon from "@/assets/payment-logos/ideal.svg";
import epsIcon from "@/assets/payment-logos/eps.svg";
import bancontactIcon from "@/assets/payment-logos/bancontact.svg";

interface PaymentLogosProps {
  className?: string;
}

const PaymentLogos = ({ className }: PaymentLogosProps) => {
  // Stable, locally hosted payment brand logos (no AI-generated assets, no external hotlinks)
  const paymentMethods = [
    { name: "Visa", icon: visaIcon },
    { name: "Mastercard", icon: mastercardIcon },
    { name: "American Express", icon: amexIcon },
    { name: "Apple Pay", icon: applePayIcon },
    { name: "Google Pay", icon: googlePayIcon },
    { name: "Klarna", icon: klarnaIcon },
    { name: "SEPA", icon: sepaIcon },
    { name: "iDEAL", icon: idealIcon },
    { name: "EPS", icon: epsIcon },
    { name: "Bancontact", icon: bancontactIcon },
  ];

  return (
    <div className={cn("flex items-center justify-center gap-2 flex-wrap", className)}>
      {paymentMethods.map((method) => (
        <div 
          key={method.name}
          className="h-7 px-2 bg-card rounded border border-border flex items-center justify-center"
          title={method.name}
        >
          <img 
            src={method.icon} 
            alt={method.name} 
            className="h-5 w-auto max-w-[40px] object-contain"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};

export default PaymentLogos;
