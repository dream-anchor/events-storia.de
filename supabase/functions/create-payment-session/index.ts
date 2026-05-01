import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';

interface CreatePaymentSessionRequest {
  inquiryId: string;
  optionId?: string;
  paymentType: 'full' | 'deposit';
  optionQuantities?: Array<{ optionId: string; quantity: number }>;
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

    // GUARD: Zahlungsart prüfen — bei "Vor Ort" und "Rechnung" keine Stripe-Session erlauben
    {
      const { data: pmCheck } = await supabase
        .from('event_inquiries')
        .select('payment_method')
        .eq('id', inquiryId)
        .single();
      const pm = (pmCheck as { payment_method: string | null } | null)?.payment_method || 'deposit_online';
      if (pm === 'on_site' || pm === 'invoice_after') {
        return new Response(
          JSON.stringify({ error: `Zahlungsart "${pm === 'on_site' ? 'Vor Ort' : 'Rechnung'}" — keine Online-Zahlung vorgesehen.` }),
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
        .select('id, contact_name, email, preferred_date, guest_count, deposit_percent')
        .eq('id', inquiryId)
        .single();
      if (inqError || !inquiry) throw new Error('Anfrage nicht gefunden');

      const inq = inquiry as {
        id: string; contact_name: string; email: string;
        preferred_date: string | null; guest_count: string | null;
        deposit_percent: number | null;
      };
      const depositPercent = inq.deposit_percent ?? 20;

      if (paymentType === 'deposit' && inq.deposit_percent === 0) {
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

        let pricePerUnitEur: number;
        // Equipment & Staff sind Fixkosten — nicht pro Person skalieren
        const ms = opt.menu_selection;
        const equipStaffFixed = (
          ((ms?.equipment as Array<{name:string;pricePerUnit:number;quantity:number}>) || [])
            .filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0)
            .reduce((s, e) => s + e.pricePerUnit * e.quantity, 0)
          +
          ((ms?.staff as Array<{name:string;pricePerUnit:number;quantity:number}>) || [])
            .filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0)
            .reduce((s, e) => s + e.pricePerUnit * e.quantity, 0)
        );

        if (pricingMode === 'per_event') {
          if (quantity !== 1) {
            throw new Error(`Option "${opt.option_label}": pauschale Preisstellung erlaubt nur Menge 1`);
          }
          pricePerUnitEur = opt.total_amount; // per_event: totalAmount enthält alles, quantity=1
        } else {
          // per_person: Equipment/Staff-Fixkosten vom totalAmount abziehen,
          // nur den Personenanteil pro Gast berechnen, Fixkosten einmalig addieren
          const budgetPerPerson = Number(ms?.budgetPerPerson ?? 0);
          if (budgetPerPerson > 0) {
            pricePerUnitEur = budgetPerPerson;
          } else if (opt.guest_count > 0) {
            // totalAmount minus Fixkosten = skalierbarer Anteil
            pricePerUnitEur = (opt.total_amount - equipStaffFixed) / opt.guest_count;
          } else {
            throw new Error(`Option "${opt.option_label}": Preis pro Person nicht ermittelbar`);
          }
        }

        // Personenkosten × gewählte Menge + einmalige Fixkosten
        const lineEur = pricingMode === 'per_event'
          ? pricePerUnitEur
          : (pricePerUnitEur * quantity) + equipStaffFixed;
        grandTotalEur += lineEur;

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
        ? Math.round(grandTotalEur * depositPercent) / 100
        : grandTotalEur;
      const amountCents = Math.round(amountEur * 100);

      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeKey) throw new Error('Stripe nicht konfiguriert');
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

      const productName = paymentType === 'deposit'
        ? `Anzahlung (${depositPercent}%) — Event ${inq.preferred_date || ''}`
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
        metadata: {
          inquiry_id: inquiryId,
          payment_type: paymentType,
          total_amount: String(grandTotalEur),
          deposit_percent: String(depositPercent),
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
        await supabase.functions.invoke('create-event-quotation', {
          body: { inquiryId, useSelectedQuantity: true },
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
      .select('id, contact_name, email, preferred_date, guest_count, deposit_percent')
      .eq('id', inquiryId)
      .single();

    if (inqError || !inquiry) throw new Error('Anfrage nicht gefunden');

    // Sicherheitsnetz: deposit_percent === 0 darf nicht zu Anzahlung führen
    const inquiryDeposit = (inquiry as { deposit_percent: number | null }).deposit_percent;
    if (paymentType === 'deposit' && inquiryDeposit === 0) {
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
      preferred_date: string | null; guest_count: string | null; deposit_percent: number | null;
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

    const totalAmount = opt.total_amount; // already total (not per person)
    const depositPercent = inq.deposit_percent ?? 20;

    const amountEur = paymentType === 'deposit'
      ? Math.round(totalAmount * depositPercent) / 100
      : totalAmount;

    const amountCents = Math.round(amountEur * 100);

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Stripe nicht konfiguriert');

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    const productName = paymentType === 'deposit'
      ? `Anzahlung (${depositPercent}%) — Event ${inq.preferred_date || ''}`
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
      metadata: {
        inquiry_id: inquiryId,
        option_id: optionId,
        payment_type: paymentType,
        total_amount: String(totalAmount),
        deposit_percent: String(depositPercent),
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unbekannter Fehler' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
