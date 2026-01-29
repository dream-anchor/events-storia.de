import { cn } from "@/lib/utils";

interface PaymentLogosProps {
  className?: string;
}

const PaymentLogos = ({ className }: PaymentLogosProps) => {
  // Using official Stripe payment method icons
  const paymentMethods = [
    { name: "Visa", icon: "https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg" },
    { name: "Mastercard", icon: "https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg" },
    { name: "American Express", icon: "https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg" },
    { name: "Apple Pay", icon: "https://js.stripe.com/v3/fingerprinted/img/apple_pay-ea008df2e8b0ca5ac5a274f66e29ed3c.svg" },
    { name: "Google Pay", icon: "https://js.stripe.com/v3/fingerprinted/img/google_pay-873d5735aa48c09a4f98d7a95f6b8b2b.svg" },
    { name: "Klarna", icon: "https://js.stripe.com/v3/fingerprinted/img/klarna-3dc57b1e9ed48fb9f9f8b0a4bfa08b95.svg" },
    { name: "SEPA", icon: "https://js.stripe.com/v3/fingerprinted/img/sepa_debit-e94b4918b4e88b869a34ab4bd7d48c68.svg" },
    { name: "giropay", icon: "https://js.stripe.com/v3/fingerprinted/img/giropay-3ae73a54dea5e1cd0a9fc0078f8d2cb3.svg" },
    { name: "iDEAL", icon: "https://js.stripe.com/v3/fingerprinted/img/ideal-8b728b0208fce4d9e3858e19f32c6c7f.svg" },
    { name: "EPS", icon: "https://js.stripe.com/v3/fingerprinted/img/eps-6a8d7f9a05c1e7cd377afd3df17e4e41.svg" },
    { name: "Bancontact", icon: "https://js.stripe.com/v3/fingerprinted/img/bancontact-35dc7b31c9c63f044b7e4e7e6b6d5c7e.svg" },
    { name: "Sofort", icon: "https://js.stripe.com/v3/fingerprinted/img/sofort-b8c4c1a1f69fea5d2fea1f2ae4c48e2e.svg" },
  ];

  return (
    <div className={cn("flex items-center justify-center gap-2 flex-wrap", className)}>
      {paymentMethods.map((method) => (
        <div 
          key={method.name}
          className="h-7 px-2 bg-white rounded border flex items-center justify-center"
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
