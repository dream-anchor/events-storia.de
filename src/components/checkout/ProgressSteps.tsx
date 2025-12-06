import { Check, User, CreditCard, Package } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  currentStep: number;
  className?: string;
}

const ProgressSteps = ({ currentStep, className }: ProgressStepsProps) => {
  const { language } = useLanguage();

  const steps = [
    {
      id: 1,
      labelDe: 'Kontakt',
      labelEn: 'Contact',
      icon: User
    },
    {
      id: 2,
      labelDe: 'Zahlung',
      labelEn: 'Payment',
      icon: CreditCard
    },
    {
      id: 3,
      labelDe: 'Fertig',
      labelEn: 'Done',
      icon: Package
    }
  ];

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    isCompleted && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary/20 text-primary border-2 border-primary",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs mt-1 font-medium",
                    isCurrent && "text-primary",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {language === 'de' ? step.labelDe : step.labelEn}
                </span>
              </div>
              
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 transition-all",
                    currentStep > step.id ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressSteps;
