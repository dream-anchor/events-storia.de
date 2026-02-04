import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type VoucherStatus = 'draft' | 'open' | 'paid' | 'voided' | 'overdue';

interface InvoiceStatusBadgeProps {
  status: VoucherStatus | string;
  className?: string;
}

const statusConfig: Record<VoucherStatus, { label: string; className: string }> = {
  draft: {
    label: 'Entwurf',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  open: {
    label: 'Offen',
    className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  paid: {
    label: 'Bezahlt',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  voided: {
    label: 'Storniert',
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
  overdue: {
    label: 'Überfällig',
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
};

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status as VoucherStatus] || {
    label: status,
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

type VoucherType = 'invoice' | 'quotation' | 'creditnote';

interface InvoiceTypeBadgeProps {
  type: VoucherType | string;
  className?: string;
}

const typeConfig: Record<VoucherType, { label: string; className: string }> = {
  invoice: {
    label: 'Rechnung',
    className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  },
  quotation: {
    label: 'Angebot',
    className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  },
  creditnote: {
    label: 'Gutschrift',
    className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  },
};

export function InvoiceTypeBadge({ type, className }: InvoiceTypeBadgeProps) {
  const config = typeConfig[type as VoucherType] || {
    label: type,
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
