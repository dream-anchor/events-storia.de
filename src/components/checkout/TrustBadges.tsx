import { ShieldCheck, Clock, Truck, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface TrustBadgesProps {
  className?: string;
  variant?: 'horizontal' | 'compact';
}

const TrustBadges = ({ className, variant = 'horizontal' }: TrustBadgesProps) => {
  const { language } = useLanguage();

  const badges = [
    {
      icon: ShieldCheck,
      labelDe: 'Sichere Zahlung',
      labelEn: 'Secure Payment',
      color: 'text-green-600'
    },
    {
      icon: Clock,
      labelDe: 'Kostenlose Stornierung bis 24h',
      labelEn: 'Free cancellation up to 24h',
      color: 'text-blue-600'
    },
    {
      icon: Award,
      labelDe: '100+ erfolgreiche Caterings',
      labelEn: '100+ successful caterings',
      color: 'text-amber-600'
    }
  ];

  if (variant === 'compact') {
    return (
      <div className={cn("flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground", className)}>
        {badges.map((badge, index) => (
          <div key={index} className="flex items-center gap-1">
            <badge.icon className={cn("h-3.5 w-3.5", badge.color)} />
            <span>{language === 'de' ? badge.labelDe : badge.labelEn}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", className)}>
      {badges.map((badge, index) => (
        <div
          key={index}
          className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border"
        >
          <badge.icon className={cn("h-5 w-5 flex-shrink-0", badge.color)} />
          <span className="text-sm">
            {language === 'de' ? badge.labelDe : badge.labelEn}
          </span>
        </div>
      ))}
    </div>
  );
};

export default TrustBadges;
