import { ExternalLink, Mail, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExternalRefLinksProps {
  resendId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSessionId?: string | null;
  stripeChargeId?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Renders deep-links into Resend (E-Mail) und Stripe Dashboard für eine Aktivität.
 * Nur Icons mit Tooltip-Text — kompakt für Timelines, Cards, Tabellen.
 */
export const ExternalRefLinks = ({
  resendId,
  stripePaymentIntentId,
  stripeSessionId,
  stripeChargeId,
  className,
  size = 'sm',
}: ExternalRefLinksProps) => {
  const links: { href: string; label: string; icon: React.ReactNode; provider: 'resend' | 'stripe' }[] = [];

  if (resendId) {
    links.push({
      href: `https://resend.com/emails/${resendId}`,
      label: 'In Resend öffnen',
      icon: <Mail className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />,
      provider: 'resend',
    });
  }
  if (stripePaymentIntentId) {
    links.push({
      href: `https://dashboard.stripe.com/payments/${stripePaymentIntentId}`,
      label: 'In Stripe öffnen',
      icon: <CreditCard className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />,
      provider: 'stripe',
    });
  } else if (stripeSessionId) {
    links.push({
      href: `https://dashboard.stripe.com/checkout/sessions/${stripeSessionId}`,
      label: 'In Stripe öffnen',
      icon: <CreditCard className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />,
      provider: 'stripe',
    });
  } else if (stripeChargeId) {
    links.push({
      href: `https://dashboard.stripe.com/payments/${stripeChargeId}`,
      label: 'In Stripe öffnen',
      icon: <CreditCard className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />,
      provider: 'stripe',
    });
  }

  if (links.length === 0) return null;

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {links.map((l) => (
        <a
          key={l.provider + l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          title={l.label}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5',
            'text-muted-foreground hover:text-foreground',
            'border border-border/50 hover:border-border bg-background/50 hover:bg-muted/50',
            'transition-colors'
          )}
        >
          {l.icon}
          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
        </a>
      ))}
    </div>
  );
};