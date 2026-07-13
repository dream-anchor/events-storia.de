import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { reportEdgeError } from '../_shared/reportError.ts';

interface CreatePaymentSessionRequest {
  inquiryId: string;
  optionId?: string;
  paymentType: 'full' | 'deposit';
  optionQuantities?: Array<{ optionId: string; quantity: number }>;
}

function effectiveTotalForOption(opt: { total_amount: number; menu_selection: Record<string, unknown> | null }): number {
  const explicitTotal = Number(opt.total_amount ?? 0);
  if (explicitTotal > 0) return explicitTotal;

  const ms = opt.menu_selection;
  const freeform = ms?.freeformProgram as {
    totalsFromText?: { gross?: number | string | null } | null;
    discount?: { mode?: 'percent' | 'amount' | null; value?: number | string | null } | null;
  } | undefined;
  const gross = Number(freeform?.totalsFromText?.gross ?? 0);
  if (gross <= 0) return 0;

  const discount = freeform?.discount;
  let discountAmount = 0;
  if (discount?.mode === 'amount') discountAmount = Number(discount.value ?? 0) || 0;
  if (discount?.mode === 'percent') discountAmount = (gross * (Number(discount.value ?? 0) || 0)) / 100;
  if (!discountAmount && Number(ms?.discountAmount ?? 0) > 0) discountAmount = Number(ms?.discountAmount ?? 0);
  if (!discountAmount && Number(ms?.discountPercent ?? 0) > 0) discountAmount = (gross * Number(ms?.discountPercent ?? 0)) / 100;

  return Math.max(0, gross - discountAmount);
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function serviceTotal(ms: Record<string, unknown> | null, key: 'equipment' | 'staff'): number {
  return (((ms?.[key] as Array<{ name?: string; pricePerUnit?: number; quantity?: number }>) || [])
    .filter(e => e.name && Number(e.pricePerUnit || 0) > 0 && Number(e.quantity || 0) > 0)
    .reduce((s, e) => s + Number(e.pricePerUnit || 0) * Number(e.quantity || 0), 0));
}

function selectableParts(opt: { total_amount: number; guest_count: number; menu_selection: Record<string, unknown> | null }) {
  const ms = opt.menu_selection;
  const total = effectiveTotalForOption(opt);
  const guests = Math.max(1, Number(opt.guest_count || 1));
  const pricingMode = (ms?.pricingMode as string | undefined) ?? 'per_person';
  if (!ms || pricingMode === 'per_event' || !!ms.freeformProgram) {
    return { perPerson: pricingMode === 'per_event' ? total : total / guests, fixed: 0, total };
  }

  let fixed = serviceTotal(ms, 'equipment') + serviceTotal(ms, 'staff');
  let perPersonAdd = 0;

  for (const d of ((ms.drinks as Array<{ pricePerUnit?: number; quantity?: number; priceMode?: string | null }>) || [])) {
    const price = Number(d.pricePerUnit || 0);
    if (price <= 0) continue;
    const qty = d.quantity == null ? 1 : Math.max(0, Number(d.quantity));
    if ((d.priceMode ?? 'per_person') === 'flat') fixed += price * qty;
    else perPersonAdd += price * qty;
  }

  const mode = (ms.drinksMode as string | undefined) ?? 'none';
  if (mode === 'pauschale') perPersonAdd += Number(ms.drinksPauschalePrice || 0);
  if (mode === 'weinbegleitung' || mode === 'none') perPersonAdd += Number(ms.winePairingPrice || 0);
  if (mode === 'einzeln') {
    for (const d of ((ms.drinksEinzeln as Array<{ pricePerPerson?: number; quantity?: number; priceMode?: string | null }>) || [])) {
      const price = Number(d.pricePerPerson || 0);
      if (price <= 0) continue;
      const qty = d.quantity == null ? 1 : Math.max(0, Number(d.quantity));
      if ((d.priceMode ?? 'per_person') === 'flat') fixed += price * qty;
      else perPersonAdd += price * qty;
    }
  }

  const fallbackBudget = Number(ms.budgetPerPerson || 0) + perPersonAdd;
  const perPerson = total > 0 ? Math.max(0, total - fixed) / guests : fallbackBudget;
  return { perPerson, fixed, total };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as CreatePaymentSessionRequest;
    const { inquiryId, optionId, paymentType, optionQuantities } = body;

    if (!inquiryId || !paymentType) {
      throw new Error('inquiryId und paymentType sind erforderlich');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // GUARD: Zahlungsart prüfen — neue Maestro-Felder bevorzugen,
    // Legacy `payment_method` als Fallback. Erlaubt z.B. Stripe-Anzahlung
    // + Restzahlung vor Ort (deposit_method=stripe, balance_method=on_site).
    {
      const { data: pmCheck } = await supabase
        .from('event_inquiries')
        .select('payment_method, deposit_method, balance_method')
        .eq('id', inquiryId)
        .single();
      const row = (pmCheck as { payment_method: string | null; deposit_method: string | null; balance_method: string | null } | null);
      const pm = (row?.payment_method || 'deposit_online').toLowerCase();
      const legacyPair: { deposit: string; balance: string } = (() => {
        switch (pm) {
          case 'deposit_online':    return { deposit: 'stripe', balance: 'stripe_prepay' };
          case 'prepayment_online':
          case 'full_online':       return { deposit: 'none',   balance: 'stripe_prepay' };
          case 'on_site':
          case 'pay_on_site':       return { deposit: 'none',   balance: 'on_site' };
          case 'invoice_after':
          case 'invoice_after_event': return { deposit: 'none', balance: 'invoice_after' };
          case 'invoice_before':
          case 'invoice_before_event':
          case 'bank_transfer_prepay': return { deposit: 'none', balance: 'invoice_before' };
          default: return { deposit: 'stripe', balance: 'stripe_prepay' };
        }
      })();
      const depositMethod = row?.deposit_method || legacyPair.deposit;
      const balanceMethod = row?.balance_method || legacyPair.balance;

      if (paymentType === 'deposit' && depositMethod !== 'stripe') {
        return new Response(
          JSON.stringify({ error: 'Für dieses Angebot ist keine Online-Anzahlung vorgesehen.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (paymentType === 'full' && balanceMethod !== 'stripe_prepay') {
        const label =
          balanceMethod === 'on_site' ? 'Vor Ort'
          : balanceMethod === 'invoice_before' ? 'Rechnung vor Event'
          : balanceMethod === 'invoice_after' ? 'Rechnung nach Event'
          : 'Offline';
        return new Response(
          JSON.stringify({ error: `Zahlungsart "${label}" — keine Online-Komplettzahlung vorgesehen.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ============================================================
    // NEW PATH: Multi-Option Bundling
    // Aktiv, sobald optionQuantities vorhanden ist und mindestens
    // ein Eintrag eine quantity > 0 hat.
    // ============================================================
    const hasMultiOption = Array.isArray(optionQuantities)
      && optionQuantities.some(q => (q?.quantity ?? 0) > 0);

    if (hasMultiOption) {
      const { data: inquiry, error: inqError } = await supabase
        .from('event_inquiries')
        .select('id, contact_name, email, preferred_date, guest_count, deposit_percent, deposit_amount')
        .eq('id', inquiryId)
        .single();
      if (inqError || !inquiry) throw new Error('Anfrage nicht gefunden');

      const inq = inquiry as {
        id: string; contact_name: string; email: string;
        preferred_date: string | null; guest_count: string | null;
        deposit_percent: number | null;
        deposit_amount: number | null;
      };
      const depositPercent = inq.deposit_percent ?? 20;
      const fixedDeposit = inq.deposit_amount;
      const isFixedDeposit = fixedDeposit != null && fixedDeposit > 0;

      if (paymentType === 'deposit' && !isFixedDeposit && inq.deposit_percent === 0) {
        throw new Error('Anzahlung ist für dieses Angebot nicht vorgesehen');
      }

      const filtered = optionQuantities!.filter(q => (q?.quantity ?? 0) > 0);
      const optionIds = filtered.map(q => q.optionId);

      const { data: options, error: optsError } = await supabase
        .from('inquiry_offer_options')
        .select('id, inquiry_id, option_label, total_amount, guest_count, offer_mode, menu_selection, package_id, packages(name)')
        .in('id', optionIds);

      if (optsError || !options || options.length !== optionIds.length) {
        throw new Error('Eine oder mehrere Optionen wurden nicht gefunden');
      }

      // Security: alle Options müssen zur inquiryId gehören
      const wrongInquiry = (options as Array<{ inquiry_id: string }>).find(o => o.inquiry_id !== inquiryId);
      if (wrongInquiry) throw new Error('Ungültige Optionen für diese Anfrage');

      type OptRow = {
        id: string; option_label: string; total_amount: number; guest_count: number;
        offer_mode: string | null;
        menu_selection: Record<string, unknown> | null;
        package_id: string | null;
        packages: { name: string | null } | null;
      };
      const optsById = new Map<string, OptRow>();
      (options as OptRow[]).forEach(o => optsById.set(o.id, o));

      let grandTotalEur = 0;
      const descriptionParts: string[] = [];

      for (const { optionId: oid, quantity } of filtered) {
        const opt = optsById.get(oid);
        if (!opt) throw new Error(`Option ${oid} nicht gefunden`);

        const pricingMode = (opt.menu_selection?.pricingMode as string | undefined) ?? 'per_person';
        const ms = opt.menu_selection;
        const parts = selectableParts(opt);

        if (pricingMode === 'per_event' || !!opt.menu_selection?.freeformProgram) {
          if (quantity !== 1) {
            throw new Error(`Option "${opt.option_label}": pauschale Preisstellung erlaubt nur Menge 1`);
          }
        } else if (parts.perPerson <= 0 && opt.guest_count <= 0) {
          throw new Error(`Option "${opt.option_label}": Preis pro Person nicht ermittelbar`);
        }

        const lineEur = pricingMode === 'per_event' || !!opt.menu_selection?.freeformProgram
          ? parts.total
          : (parts.perPerson * quantity) + parts.fixed;
        grandTotalEur += money(lineEur);

        const overrideName = (opt.menu_selection?.packageNameOverride as string | undefined)?.trim();
        const pkgName = opt.packages?.name?.trim();
        const isCustom = opt.offer_mode === 'menu'
          || !pkgName
          || pkgName === 'Individuelles Paket'
          || pkgName === 'Individuelles Menü';
        const displayName = overrideName || (isCustom ? `Menü ${opt.option_label}` : pkgName!);
        descriptionParts.push(`${displayName} × ${quantity}`);
      }

      const amountEur = paymentType === 'deposit'
        ? (isFixedDeposit
            ? Math.min(fixedDeposit as number, grandTotalEur)
            : Math.round(grandTotalEur * depositPercent) / 100)
        : grandTotalEur;
      const amountCents = Math.round(amountEur * 100);

      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeKey) throw new Error('Stripe nicht konfiguriert');
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });

      const depositLabel = isFixedDeposit
        ? `${(fixedDeposit as number).toFixed(2)} €`
        : `${depositPercent}%`;
      const productName = paymentType === 'deposit'
        ? `Anzahlung (${depositLabel}) — Event ${inq.preferred_date || ''}`
        : `Event-Buchung — ${inq.preferred_date || ''}`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: inq.email,
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: productName,
              description: descriptionParts.join(' + '),
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        success_url: `https://events-storia.de/offer/${inquiryId}?payment=success`,
        cancel_url: `https://events-storia.de/offer/${inquiryId}?payment=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        metadata: {
          inquiry_id: inquiryId,
          payment_type: paymentType,
          total_amount: String(grandTotalEur),
          deposit_percent: String(depositPercent),
          deposit_amount: isFixedDeposit ? String(fixedDeposit) : '',
          option_quantities: JSON.stringify(filtered),
        },
      });

      // selected_quantity pro Option persistieren
      for (const { optionId: oid, quantity } of filtered) {
        await supabase
          .from('inquiry_offer_options')
          .update({ selected_quantity: quantity } as Record<string, unknown>)
          .eq('id', oid);
      }

      await supabase
        .from('event_inquiries')
        .update({
          payment_type: paymentType,
          remaining_amount: paymentType === 'deposit' ? grandTotalEur - amountEur : 0,
        } as Record<string, unknown>)
        .eq('id', inquiryId);

      // Verbindliches LexOffice-Angebot erst JETZT mit den finalen Mengen erzeugen.
      // Fehler nicht hochbubbeln — Stripe-Checkout darf nicht blockiert werden.
      try {
        // create-event-quotation erfordert jetzt Auth (requireAuth) ODER das
        // interne Secret — dieser Aufruf laeuft mit dem Service-Role-Key statt
        // einem echten User-JWT (Checkout kann auch anonym gestartet werden).
        await supabase.functions.invoke('create-event-quotation', {
          body: { inquiryId, useSelectedQuantity: true },
          headers: { 'x-webhook-secret': Deno.env.get('MAESTRO_INTERNAL_FUNCTION_SECRET') ?? '' },
        });
      } catch (quotErr) {
        console.error('create-event-quotation (selected) failed:', quotErr);
      }

      return new Response(
        JSON.stringify({ success: true, checkoutUrl: session.url, sessionId: session.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ============================================================
    // OLD PATH (UNCHANGED): Single-Option Zahlung
    // ============================================================
    if (!optionId) {
      throw new Error('optionId ist erforderlich');
    }

    // Anfrage + Option laden
    const { data: inquiry, error: inqError } = await supabase
      .from('event_inquiries')
      .select('id, contact_name, email, preferred_date, guest_count, deposit_percent, deposit_amount')
      .eq('id', inquiryId)
      .single();

    if (inqError || !inquiry) throw new Error('Anfrage nicht gefunden');

    // Sicherheitsnetz: deposit_percent === 0 darf nicht zu Anzahlung führen
    const inquiryDeposit = (inquiry as { deposit_percent: number | null }).deposit_percent;
    const inquiryDepositAmount = (inquiry as { deposit_amount: number | null }).deposit_amount;
    const isFixedDepositSingle = inquiryDepositAmount != null && inquiryDepositAmount > 0;
    if (paymentType === 'deposit' && !isFixedDepositSingle && inquiryDeposit === 0) {
      throw new Error('Anzahlung ist für dieses Angebot nicht vorgesehen');
    }

    const { data: option, error: optError } = await supabase
      .from('inquiry_offer_options')
      .select('id, option_label, total_amount, guest_count, offer_mode, menu_selection, package_id')
      .eq('id', optionId)
      .single();

    if (optError || !option) throw new Error('Angebotsoption nicht gefunden');

    const inq = inquiry as {
      id: string; contact_name: string; email: string;
      preferred_date: string | null; guest_count: string | null;
      deposit_percent: number | null; deposit_amount: number | null;
    };
    const opt = option as {
      id: string; option_label: string;
      total_amount: number; guest_count: number; offer_mode: string;
      menu_selection: Record<string, unknown> | null;
      package_id: string | null;
    };

    // Paketnamen auflösen: Override aus menu_selection > packages-Tabelle > Default
    let packageName = 'Individuelles Angebot';
    const nameOverride = opt.menu_selection?.packageNameOverride as string | undefined;
    if (nameOverride) {
      packageName = nameOverride;
    } else if (opt.package_id) {
      const { data: pkg } = await supabase
        .from('packages')
        .select('name')
        .eq('id', opt.package_id)
        .single();
      if (pkg?.name) packageName = pkg.name;
    } else if (opt.offer_mode === 'menu') {
      packageName = 'Individuelles Menü';
    }

    const totalAmount = effectiveTotalForOption(opt); // already total (not per person); freeform falls back to Maestro gross minus discount
    const depositPercent = inq.deposit_percent ?? 20;
    const fixedDeposit = inq.deposit_amount;
    const isFixedDeposit = fixedDeposit != null && fixedDeposit > 0;

    const amountEur = paymentType === 'deposit'
      ? (isFixedDeposit
          ? Math.min(fixedDeposit as number, totalAmount)
          : Math.round(totalAmount * depositPercent) / 100)
      : totalAmount;

    const amountCents = Math.round(amountEur * 100);

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Stripe nicht konfiguriert');

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });

    const depositLabel = isFixedDeposit
      ? `${(fixedDeposit as number).toFixed(2)} €`
      : `${depositPercent}%`;
    const productName = paymentType === 'deposit'
      ? `Anzahlung (${depositLabel}) — Event ${inq.preferred_date || ''}`
      : `Event-Buchung — ${inq.preferred_date || ''}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: inq.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: productName,
            description: `Option ${opt.option_label} · ${opt.guest_count} Gäste · ${packageName}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      success_url: `https://events-storia.de/offer/${inquiryId}?payment=success`,
      cancel_url: `https://events-storia.de/offer/${inquiryId}?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      metadata: {
        inquiry_id: inquiryId,
        option_id: optionId,
        payment_type: paymentType,
        total_amount: String(totalAmount),
        deposit_percent: String(depositPercent),
        deposit_amount: isFixedDeposit ? String(fixedDeposit) : '',
      },
    });

    // payment_type + Betrag in event_inquiries speichern
    await supabase
      .from('event_inquiries')
      .update({
        payment_type: paymentType,
        remaining_amount: paymentType === 'deposit' ? totalAmount - amountEur : 0,
      } as Record<string, unknown>)
      .eq('id', inquiryId);

    return new Response(
      JSON.stringify({ success: true, checkoutUrl: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('create-payment-session error:', error);
    reportEdgeError({ source: 'edge:create-payment-session', severity: 'critical', message: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unbekannter Fehler' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
