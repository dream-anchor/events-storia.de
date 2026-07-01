/**
 * DraftDiffPanel — zeigt kompakte Feldnamen-Liste an, welche Bereiche sich
 * zwischen dem letzten versendeten Snapshot (inquiry_offer_history) und dem
 * aktuellen Draft (event_inquiries + inquiry_offer_options) unterschieden.
 *
 * Absichtlich ohne Alt/Neu-Werte — auf Wunsch reine Feldnamen-Anzeige.
 * Wenn noch keine Version versendet wurde: Panel bleibt unsichtbar.
 */
import { useEffect, useState } from "react";
import { GitCompare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  inquiryId: string;
  refreshKey?: number;
}

type Category = 'menu' | 'address' | 'payment' | 'contact';

const CATEGORY_LABEL: Record<Category, string> = {
  menu: 'Menü, Programm & Preise',
  address: 'Kunden- / Rechnungsadresse',
  payment: 'Zahlungsbedingungen',
  contact: 'Kontakt & Event-Basics',
};

const INQUIRY_KEYS = [
  'contact_name', 'company_name', 'email', 'phone',
  'guest_count', 'event_type', 'preferred_date', 'event_end_date',
  'time_slot', 'customer_language',
];
const ADDRESS_KEYS = [
  'location_type', 'location_name', 'location_street',
  'location_postal_code', 'location_city', 'location_country',
  'company_street', 'company_postal_code', 'company_city', 'company_country',
  'billing_address_different', 'billing_company_name',
  'billing_street', 'billing_postal_code', 'billing_city', 'billing_country',
];
const PAYMENT_KEYS = [
  'deposit_percent', 'deposit_amount', 'deposit_due_days',
  'offer_validity_days', 'payment_method', 'invoice_due_days',
];

function normalize(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function diffKeys(
  snap: Record<string, unknown> | null | undefined,
  live: Record<string, unknown>,
  keys: string[],
): boolean {
  if (!snap) return false; // Alt-Version ohne Snapshot → nicht rot markieren
  for (const k of keys) {
    if (normalize(snap[k]) !== normalize(live[k])) return true;
  }
  return false;
}

function diffOptions(
  snapOptions: unknown,
  liveOptions: Array<Record<string, unknown>>,
): boolean {
  const snaps = Array.isArray(snapOptions) ? snapOptions as Array<Record<string, unknown>> : [];
  const snapActive = snaps.filter(o => (o.is_active as boolean | undefined) !== false);
  const liveActive = liveOptions.filter(o => (o.is_active as boolean | undefined) !== false);
  if (snapActive.length !== liveActive.length) return true;
  const pick = (o: Record<string, unknown>) => ({
    label: o.option_label,
    mode: o.offer_mode,
    pkg: o.package_id,
    guests: o.guest_count,
    qty: o.selected_quantity,
    total: o.total_amount,
    menu: o.menu_selection,
  });
  const sortKey = (o: Record<string, unknown>) => String(o.option_label ?? '') + '|' + String(o.id ?? '');
  const s = [...snapActive].sort((a, b) => sortKey(a).localeCompare(sortKey(b))).map(pick);
  const l = [...liveActive].sort((a, b) => sortKey(a).localeCompare(sortKey(b))).map(pick);
  return JSON.stringify(s) !== JSON.stringify(l);
}

export function DraftDiffPanel({ inquiryId, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState<Category[] | null>(null);
  const [version, setVersion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: histRow }, { data: inqRow }, { data: optRows }] = await Promise.all([
          supabase
            .from('inquiry_offer_history')
            .select('version, options_snapshot, inquiry_snapshot, address_snapshot, payment_terms_snapshot')
            .eq('inquiry_id', inquiryId)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('event_inquiries')
            .select(
              'contact_name, company_name, email, phone, guest_count, event_type, preferred_date, event_end_date, time_slot, customer_language, location_type, location_name, location_street, location_postal_code, location_city, location_country, company_street, company_postal_code, company_city, company_country, billing_address_different, billing_company_name, billing_street, billing_postal_code, billing_city, billing_country, deposit_percent, deposit_amount, deposit_due_days, offer_validity_days, payment_method, invoice_due_days'
            )
            .eq('id', inquiryId)
            .maybeSingle(),
          supabase
            .from('inquiry_offer_options')
            .select('id, option_label, offer_mode, package_id, guest_count, selected_quantity, total_amount, menu_selection, is_active')
            .eq('inquiry_id', inquiryId),
        ]);
        if (cancelled) return;
        const hist = histRow as {
          version?: number;
          options_snapshot?: unknown;
          inquiry_snapshot?: Record<string, unknown> | null;
          address_snapshot?: Record<string, unknown> | null;
          payment_terms_snapshot?: Record<string, unknown> | null;
        } | null;
        if (!hist) {
          setChanged(null); // noch nie versendet
          setVersion(null);
          return;
        }
        setVersion(hist.version ?? null);
        const live = (inqRow ?? {}) as Record<string, unknown>;
        const options = (optRows ?? []) as Array<Record<string, unknown>>;
        const result: Category[] = [];
        if (diffOptions(hist.options_snapshot, options)) result.push('menu');
        if (diffKeys(hist.address_snapshot, live, ADDRESS_KEYS)) result.push('address');
        if (diffKeys(hist.payment_terms_snapshot, live, PAYMENT_KEYS)) result.push('payment');
        if (diffKeys(hist.inquiry_snapshot, live, INQUIRY_KEYS)) result.push('contact');
        setChanged(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inquiryId, refreshKey]);

  if (loading || changed === null) return null;

  const nextVersion = (version ?? 0) + 1;

  if (changed.length === 0) {
    return (
      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground flex items-center gap-2">
        <GitCompare className="h-4 w-4" />
        <span>
          Keine Änderungen gegenüber Version {version}. Beim Versand wird trotzdem
          alles (E-Mail, PDF, LexOffice, Kundenseite) neu generiert.
        </span>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <GitCompare className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Änderungen für Version {nextVersion}
        </div>
      </div>
      <ul className="ml-6 list-disc text-sm text-amber-900/90 dark:text-amber-100/90 space-y-0.5">
        {changed.map((c) => (
          <li key={c}>{CATEGORY_LABEL[c]}</li>
        ))}
      </ul>
      <div className="mt-3 text-xs text-amber-800/80 dark:text-amber-200/80">
        Beim Versand entsteht Version {nextVersion} als neuer Snapshot. E-Mail, PDF,
        LexOffice-Angebot und die öffentliche Kundenseite werden komplett neu erzeugt.
      </div>
    </section>
  );
}