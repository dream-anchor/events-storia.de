import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Plus, Copy, Check, Mail, AlertTriangle,
  Clock, Ban, RefreshCw, ChevronDown, ChevronUp, FileText, Receipt
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddPaymentDrawer } from "./AddPaymentDrawer";

export interface EventPayment {
  id: string;
  inquiry_id: string;
  payment_type: 'deposit' | 'prepayment' | 'final';
  amount_cents: number;
  due_date: string | null;
  due_days_before_event: number | null;
  effective_due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  computed_status: string;
  stripe_payment_link_url: string | null;
  paid_at: string | null;
  paid_via: string | null;
  email_sent_at: string | null;
  reminder_sent_at: string | null;
  notes: string | null;
  created_at: string;
  preferred_date: string | null;
  customer_email: string | null;
  guest_count: string | null;
  event_type: string | null;
  lexoffice_invoice_id?: string | null;
  lexoffice_invoice_number?: string | null;
}

interface Props {
  inquiryId: string;
  preferredDate?: string | null;
  offerTotal?: number | null;
  isTest?: boolean;
}

const typeLabels: Record<string, string> = {
  deposit: 'Anzahlung',
  prepayment: 'Vorauszahlung',
  final: 'Endabrechnung',
};

const paidViaLabels: Record<string, string> = {
  card: 'Karte',
  sepa_debit: 'SEPA-Lastschrift',
  billie: 'Billie (Rechnung)',
  paypal: 'PayPal',
  klarna: 'Klarna',
  unknown: 'unbekannt',
};

function formatEUR(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE');
}

function StatusBadge({ payment }: { payment: EventPayment }) {
  const status = payment.computed_status || payment.status;
  const configs: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
    draft: {
      label: 'Entwurf',
      icon: <Clock className="h-3 w-3" />,
      class: 'border-slate-300 text-slate-600 bg-slate-50',
    },
    sent: {
      label: 'Gesendet',
      icon: <Mail className="h-3 w-3" />,
      class: 'border-amber-400 text-amber-700 bg-amber-50',
    },
    paid: {
      label: 'Bezahlt',
      icon: <Check className="h-3 w-3" />,
      class: 'border-green-400 text-green-700 bg-green-50',
    },
    overdue: {
      label: 'Überfällig',
      icon: <AlertTriangle className="h-3 w-3" />,
      class: 'border-red-400 text-red-700 bg-red-50',
    },
    cancelled: {
      label: 'Storniert',
      icon: <Ban className="h-3 w-3" />,
      class: 'border-slate-300 text-slate-500 bg-slate-50',
    },
    refunded: {
      label: 'Erstattet',
      icon: <RefreshCw className="h-3 w-3" />,
      class: 'border-purple-300 text-purple-600 bg-purple-50',
    },
  };

  const cfg = configs[status] || configs.draft;
  return (
    <Badge variant="outline" className={`flex items-center gap-1 font-medium ${cfg.class}`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function PaymentRow({
  payment,
  onRefresh,
  totalCents,
  paidDepositCents,
}: {
  payment: EventPayment;
  onRefresh: () => void;
  totalCents: number;
  paidDepositCents: number;
}) {
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const status = payment.computed_status || payment.status;

  const handleCopyLink = useCallback(async () => {
    if (!payment.stripe_payment_link_url) return;
    await navigator.clipboard.writeText(payment.stripe_payment_link_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [payment.stripe_payment_link_url]);

  const handleSendLink = useCallback(async () => {
    setActionLoading('send');
    try {
      // Stripe Session erstellen (falls noch nicht vorhanden) + Status auf 'sent' setzen
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
        'create-event-payment-session',
        { body: { payment_id: payment.id } }
      );
      if (sessionError || !sessionData?.url) {
        throw new Error(sessionData?.error || 'Stripe Session konnte nicht erstellt werden');
      }
      // E-Mail senden
      const { data: emailData, error: emailError } = await supabase.functions.invoke(
        'send-payment-email',
        { body: { payment_id: payment.id, is_reminder: false } }
      );
      if (emailError || !emailData?.success) {
        throw new Error(emailData?.error || 'E-Mail konnte nicht gesendet werden');
      }
      toast.success('Zahlungslink versendet');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Senden');
    } finally {
      setActionLoading(null);
    }
  }, [payment.id, onRefresh]);

  const handleSendReminder = useCallback(async () => {
    setActionLoading('reminder');
    try {
      const { data, error } = await supabase.functions.invoke('send-payment-email', {
        body: { payment_id: payment.id, is_reminder: true },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Fehler');
      toast.success('Erinnerung versendet');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Senden');
    } finally {
      setActionLoading(null);
    }
  }, [payment.id, onRefresh]);

  const handleCancel = useCallback(async () => {
    if (!confirm('Zahlung wirklich stornieren?')) return;
    setActionLoading('cancel');
    try {
      const { error } = await (supabase as any)
        .from('event_payments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', payment.id);
      if (error) throw error;
      toast.success('Zahlung storniert');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setActionLoading(null);
    }
  }, [payment.id, onRefresh]);

  const handleCreateDownpaymentInvoice = useCallback(async () => {
    setActionLoading('lexoffice');
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-lexoffice-downpayment-invoice',
        { body: { payment_id: payment.id } }
      );
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'LexOffice-Aufruf fehlgeschlagen');
      }
      toast.success(
        data?.invoice_number
          ? `Anzahlungsrechnung ${data.invoice_number} erstellt`
          : 'Anzahlungsrechnung erstellt'
      );
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler bei LexOffice');
    } finally {
      setActionLoading(null);
    }
  }, [payment.id, onRefresh]);

  const isActive = !['cancelled', 'refunded'].includes(payment.status);
  const isDownpayment = payment.payment_type === 'deposit' || payment.payment_type === 'prepayment';
  const hasLexInvoice = !!payment.lexoffice_invoice_id;

  // Netto-Restzahlung = Maestro-Total minus bereits bezahlte Anzahlungen.
  // Wird im Public Offer gegenüber dem Kunden so dargestellt — Maestro spiegelt das.
  const isFinal = payment.payment_type === 'final';
  const hasDeduction = isFinal && totalCents > 0 && paidDepositCents > 0;
  const netCents = hasDeduction ? Math.max(totalCents - paidDepositCents, 0) : payment.amount_cents;
  const isMismatch = hasDeduction && payment.amount_cents !== netCents && payment.status !== 'paid';

  const handleCorrectAmount = useCallback(async () => {
    setActionLoading('correct');
    try {
      const { error } = await (supabase as any)
        .from('event_payments')
        .update({ amount_cents: netCents, updated_at: new Date().toISOString() })
        .eq('id', payment.id);
      if (error) throw error;
      toast.success('Betrag auf Netto-Restzahlung korrigiert');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Korrektur fehlgeschlagen');
    } finally {
      setActionLoading(null);
    }
  }, [netCents, payment.id, onRefresh]);

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${!isActive ? 'opacity-60' : ''} ${status === 'overdue' ? 'border-red-200 bg-red-50/30' : 'border-border/60 bg-white'}`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm tabular-nums">{formatEUR(hasDeduction ? netCents : payment.amount_cents)}</span>
          <span className="text-xs text-muted-foreground">{typeLabels[payment.payment_type]}</span>
          {isMismatch && (
            <span
              className="text-amber-600"
              title={`Gespeichert: ${formatEUR(payment.amount_cents)} — wird im Public Offer als ${formatEUR(netCents)} angezeigt`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge payment={payment} />
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {hasDeduction && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {formatEUR(totalCents)} − {formatEUR(paidDepositCents)} abzgl. Anzahlung
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {status === 'paid' && payment.paid_at && (
          <span>✓ Bezahlt am {formatDate(payment.paid_at)}{payment.paid_via ? ` via ${paidViaLabels[payment.paid_via] || payment.paid_via}` : ''}</span>
        )}
        {status !== 'paid' && payment.effective_due_date && (
          <span className={status === 'overdue' ? 'text-red-600 font-medium' : ''}>
            Fällig: {formatDate(payment.effective_due_date)}
            {payment.due_days_before_event && !payment.due_date
              ? ` (${payment.due_days_before_event} Tage vor Event)` : ''}
          </span>
        )}
        {payment.email_sent_at && (
          <span>Link gesendet am {formatDate(payment.email_sent_at)}</span>
        )}
        {hasLexInvoice && (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Receipt className="h-3 w-3" />
            Anzahlungsrechnung {payment.lexoffice_invoice_number || ''}
          </span>
        )}
      </div>

      {/* Expanded: notes */}
      {expanded && payment.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">
          {payment.notes}
        </p>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {isMismatch && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={handleCorrectAmount}
              disabled={!!actionLoading}
            >
              <RefreshCw className="h-3 w-3" />
              {actionLoading === 'correct' ? 'Korrigiere…' : 'Auf Netto korrigieren'}
            </Button>
          )}
          {status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={handleSendLink}
              disabled={!!actionLoading}
            >
              <Mail className="h-3 w-3" />
              {actionLoading === 'send' ? 'Sende…' : 'Link senden'}
            </Button>
          )}
          {(status === 'sent' || status === 'overdue') && payment.stripe_payment_link_url && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={handleSendReminder}
                disabled={!!actionLoading}
              >
                <Mail className="h-3 w-3" />
                {actionLoading === 'reminder' ? 'Sende…' : 'Erinnerung'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={handleCopyLink}
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Kopiert!' : 'Link'}
              </Button>
            </>
          )}
          {(status === 'draft' || status === 'sent') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
              onClick={handleCancel}
              disabled={!!actionLoading}
            >
              <Ban className="h-3 w-3" />
              {actionLoading === 'cancel' ? '…' : 'Stornieren'}
            </Button>
          )}
          {status === 'paid' && isDownpayment && !hasLexInvoice && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={handleCreateDownpaymentInvoice}
              disabled={!!actionLoading}
            >
              <FileText className="h-3 w-3" />
              {actionLoading === 'lexoffice' ? 'Erstelle…' : 'Anzahlungsrechnung erstellen'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function PaymentCard({ inquiryId, preferredDate, offerTotal, isTest = false }: Props) {
  const [payments, setPayments] = useState<EventPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [finalInvoiceState, setFinalInvoiceState] = useState<{
    id: string | null;
    number: string | null;
    loading: boolean;
  }>({ id: null, number: null, loading: false });

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from('event_payments_enriched')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });

    if (!error && data) setPayments(data as EventPayment[]);
    setIsLoading(false);

    // Schlussrechnung-Status separat laden
    const { data: eventRow } = await (supabase as any)
      .from('v2_events')
      .select('final_lexoffice_invoice_id, final_lexoffice_invoice_number')
      .eq('id', inquiryId)
      .maybeSingle();
    if (eventRow) {
      setFinalInvoiceState(s => ({
        ...s,
        id: eventRow.final_lexoffice_invoice_id || null,
        number: eventRow.final_lexoffice_invoice_number || null,
      }));
    }
  }, [inquiryId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const activePayments = payments.filter(p => !['cancelled', 'refunded'].includes(p.status));
  const paidTotal = activePayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount_cents, 0);

  // Maestro single source of truth: Total kommt aus offerTotal, nicht aus Σ Zahlungen.
  const totalCents = offerTotal != null ? Math.round(offerTotal * 100) : 0;
  const paidDepositCents = activePayments
    .filter(p => (p.payment_type === 'deposit' || p.payment_type === 'prepayment') && p.status === 'paid')
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const openTotal = activePayments
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => {
      if (p.payment_type === 'final' && totalCents > 0 && paidDepositCents > 0) {
        return sum + Math.max(totalCents - paidDepositCents, 0);
      }
      return sum + p.amount_cents;
    }, 0);
  const grandTotal = totalCents > 0 ? totalCents : paidTotal + openTotal;

  const allPaid = activePayments.length > 0 && activePayments.every(p => p.status === 'paid');
  const hasFinalInvoice = !!finalInvoiceState.id;

  const handleCreateFinalInvoice = useCallback(async () => {
    setFinalInvoiceState(s => ({ ...s, loading: true }));
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-lexoffice-final-invoice',
        { body: { inquiryId } }
      );
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Schlussrechnung fehlgeschlagen');
      }
      toast.success(
        data?.invoice_number
          ? `Schlussrechnung ${data.invoice_number} erstellt`
          : 'Schlussrechnung erstellt'
      );
      await loadPayments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler bei LexOffice');
    } finally {
      setFinalInvoiceState(s => ({ ...s, loading: false }));
    }
  }, [inquiryId, loadPayments]);

  return (
    <>
      <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Zahlungen
            </CardTitle>
            {grandTotal > 0 && (
              <span className="text-sm font-medium text-muted-foreground">
                Gesamt: {formatEUR(grandTotal)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-2">Lädt…</div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">
              Noch keine Zahlungen konfiguriert.
            </p>
          ) : (
            <>
              {payments.map(p => (
                <PaymentRow
                  key={p.id}
                  payment={p}
                  onRefresh={loadPayments}
                  totalCents={totalCents}
                  paidDepositCents={paidDepositCents}
                />
              ))}

              {grandTotal > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bezahlt</span>
                      <span className="font-medium text-green-700">{formatEUR(paidTotal)}</span>
                    </div>
                    {openTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Offen</span>
                        <span className="font-medium text-amber-700">{formatEUR(openTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t border-border/40 pt-1">
                      <span>Gesamt</span>
                      <span>{formatEUR(grandTotal)}</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5 text-xs border-dashed"
            onClick={() => setShowAddDrawer(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Zahlung anlegen
          </Button>

          {/* Schlussrechnung */}
          {hasFinalInvoice ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <Receipt className="h-3.5 w-3.5" />
              <span>Schlussrechnung {finalInvoiceState.number || ''} erstellt</span>
            </div>
          ) : allPaid && (
            <Button
              size="sm"
              variant="default"
              className="w-full gap-1.5 text-xs"
              onClick={handleCreateFinalInvoice}
              disabled={finalInvoiceState.loading}
            >
              <Receipt className="h-3.5 w-3.5" />
              {finalInvoiceState.loading ? 'Erstelle Schlussrechnung…' : 'Schlussrechnung erstellen'}
            </Button>
          )}
        </CardContent>
      </Card>

      <AddPaymentDrawer
        open={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        inquiryId={inquiryId}
        preferredDate={preferredDate}
        offerTotal={offerTotal}
        paidSoFar={paidTotal}
        onPaymentCreated={loadPayments}
        isTest={isTest}
      />
    </>
  );
}
