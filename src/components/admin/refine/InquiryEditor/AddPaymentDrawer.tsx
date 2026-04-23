import { useState, useEffect } from "react";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, X, AlertTriangle, FlaskConical } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  inquiryId: string;
  preferredDate?: string | null;
  offerTotal?: number | null;
  paidSoFar: number; // Cent
  onPaymentCreated: () => void;
  isTest?: boolean;
}

type PaymentType = 'deposit' | 'prepayment' | 'final';
type DueType = 'date' | 'days' | 'immediate';

const typeLabels: Record<PaymentType, string> = {
  deposit: 'Anzahlung',
  prepayment: 'Vorauszahlung',
  final: 'Endabrechnung',
};

function parseCentsFromInput(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

function formatEUR(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function AddPaymentDrawer({
  open,
  onClose,
  inquiryId,
  preferredDate,
  offerTotal,
  paidSoFar,
  onPaymentCreated,
  isTest = false,
}: Props) {
  const [paymentType, setPaymentType] = useState<PaymentType>('deposit');
  const [amountInput, setAmountInput] = useState('');
  const [dueType, setDueType] = useState<DueType>('days');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dueDays, setDueDays] = useState('14');
  const [notes, setNotes] = useState('');
  const [sendLink, setSendLink] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPaymentType('deposit');
      setAmountInput('');
      setDueType('days');
      setDueDate(undefined);
      setDueDays('14');
      setNotes('');
      setSendLink(true);
    }
  }, [open]);

  const amountCents = parseCentsFromInput(amountInput);
  const restCents = (offerTotal != null ? offerTotal * 100 : 0) - paidSoFar - amountCents;

  // Berechne live das Fälligkeitsdatum aus "X Tage vor Event"
  const computedDueDate: Date | null = (() => {
    if (dueType === 'days' && preferredDate && dueDays) {
      const days = parseInt(dueDays, 10);
      if (!isNaN(days) && days >= 0) {
        const eventDate = new Date(preferredDate);
        return addDays(eventDate, -days);
      }
    }
    if (dueType === 'date' && dueDate) return dueDate;
    return null;
  })();

  function applyQuickPick(percent: number | 'rest') {
    if (offerTotal == null) return;
    const totalCents = offerTotal * 100;
    const cents = percent === 'rest'
      ? totalCents - paidSoFar
      : Math.round(totalCents * percent / 100);
    setAmountInput((cents / 100).toFixed(2).replace('.', ','));
  }

  async function handleSubmit() {
    if (amountCents <= 0) {
      toast.error('Bitte einen gültigen Betrag eingeben');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        inquiry_id: inquiryId,
        payment_type: paymentType as 'deposit' | 'prepayment' | 'final',
        amount_cents: amountCents,
        status: 'draft' as const,
        notes: notes.trim() || null,
        created_by: user?.id || null,
        due_date: null as string | null,
        due_days_before_event: null as number | null,
      };

      if (dueType === 'date' && dueDate) {
        payload.due_date = format(dueDate, 'yyyy-MM-dd');
      } else if (dueType === 'days' && dueDays) {
        const days = parseInt(dueDays, 10);
        if (!isNaN(days) && days >= 0) {
          payload.due_days_before_event = days;
        }
      }
      // dueType === 'immediate' → kein due_date, kein due_days

      const { data: newPayment, error: insertError } = await supabase
        .from('event_payments')
        .insert(payload)
        .select('id')
        .single();

      if (insertError || !newPayment) throw insertError || new Error('Zahlung konnte nicht gespeichert werden');

      const paymentId = newPayment.id;

      if (sendLink) {
        // Stripe Session erstellen
        const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
          'create-event-payment-session',
          { body: { payment_id: paymentId } }
        );
        if (sessionError || !sessionData?.url) {
          throw new Error(sessionData?.error || 'Stripe Session konnte nicht erstellt werden');
        }

        // E-Mail senden
        const { data: emailData, error: emailError } = await supabase.functions.invoke(
          'send-payment-email',
          { body: { payment_id: paymentId, is_reminder: false } }
        );
        if (emailError || !emailData?.success) {
          // Nicht fatal — Zahlung wurde bereits erstellt, nur E-Mail schlug fehl
          toast.warning(`Zahlung angelegt, E-Mail-Versand fehlgeschlagen: ${emailData?.error || 'Unbekannter Fehler'}`);
        } else {
          toast.success('Zahlung angelegt und Zahlungslink versendet');
        }
      } else {
        toast.success('Zahlung angelegt (Entwurf)');
      }

      onPaymentCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Anlegen der Zahlung');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>Zahlung anlegen</SheetTitle>
            <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-5">
          {/* Typ */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Typ</Label>
            <div className="flex gap-2">
              {(['deposit', 'prepayment'] as PaymentType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPaymentType(t)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                    paymentType === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {t === 'deposit' ? '💰' : '📋'} {typeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Betrag */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Betrag</Label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                className="pr-10 text-base"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">€</span>
            </div>

            {/* Hinweise + Schnellwahl */}
            {offerTotal != null && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex gap-1 flex-wrap items-center">
                  <span>Angebotssumme: {formatEUR(offerTotal * 100)}</span>
                  {paidSoFar > 0 && <span>| Bereits bezahlt: {formatEUR(paidSoFar)}</span>}
                </div>
                <div className="flex gap-1.5">
                  <span className="text-muted-foreground">Schnellwahl:</span>
                  {[25, 50].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyQuickPick(pct)}
                      className="px-2 py-0.5 rounded border border-border hover:border-primary text-xs"
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => applyQuickPick('rest')}
                    className="px-2 py-0.5 rounded border border-border hover:border-primary text-xs"
                  >
                    Rest {restCents > 0 ? `(${formatEUR(restCents)})` : ''}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fälligkeit */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fällig</Label>
            <div className="space-y-2">
              {/* Option: Tage vor Event */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dueType"
                  checked={dueType === 'days'}
                  onChange={() => setDueType('days')}
                  className="accent-primary"
                />
                <span className="text-sm">Tage vor Event:</span>
                <Input
                  type="number"
                  min="0"
                  value={dueDays}
                  onChange={e => setDueDays(e.target.value)}
                  className="w-20 h-7 text-sm"
                  onClick={() => setDueType('days')}
                />
                <span className="text-sm text-muted-foreground">Tage</span>
              </label>

              {/* Option: Am Datum */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dueType"
                  checked={dueType === 'date'}
                  onChange={() => setDueType('date')}
                  className="accent-primary"
                />
                <span className="text-sm">Am Datum:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('h-7 text-xs gap-1', !dueDate && 'text-muted-foreground')}
                      onClick={() => setDueType('date')}
                    >
                      <CalendarIcon className="h-3 w-3" />
                      {dueDate ? format(dueDate, 'dd.MM.yyyy') : 'Datum wählen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      locale={de}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </label>

              {/* Option: Sofort */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dueType"
                  checked={dueType === 'immediate'}
                  onChange={() => setDueType('immediate')}
                  className="accent-primary"
                />
                <span className="text-sm">Sofort (mit Zahlungslink)</span>
              </label>
            </div>

            {/* Live: berechnetes Fälligkeitsdatum */}
            {computedDueDate && dueType === 'days' && (
              <p className="text-xs text-muted-foreground">
                ↳ Event: {preferredDate ? format(new Date(preferredDate), 'dd.MM.yyyy') : '–'}{' '}
                → Fällig: <strong>{format(computedDueDate, 'dd.MM.yyyy', { locale: de })}</strong>
              </p>
            )}
          </div>

          {/* Notiz */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Interne Notiz
            </Label>
            <Textarea
              placeholder='z. B. "Firma zahlt per Billie"'
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <Separator />

          {/* Aktionen nach Anlegen */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nach Anlegen
            </Label>
            <div className="flex items-start gap-2">
              <Checkbox
                id="sendLink"
                checked={sendLink}
                onCheckedChange={v => setSendLink(!!v)}
                className="mt-0.5"
              />
              <label htmlFor="sendLink" className="text-sm cursor-pointer leading-snug">
                Zahlungslink per E-Mail senden
                <span className="block text-xs text-muted-foreground">
                  Stripe Checkout (Karte, SEPA, Billie) wird erstellt und an die Kunden-E-Mail gesendet.
                </span>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={isSubmitting || amountCents <= 0}
            >
              {isSubmitting ? 'Anlegen…' : 'Zahlung anlegen'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
