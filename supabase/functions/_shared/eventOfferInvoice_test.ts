// Anzahlung/Vollzahlung/Restzahlung beim Event-Angebot: welche Lexoffice-Rechnung entsteht, was die Schlussrechnung abzieht.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  buildFullInvoicePayload,
  findExistingOfferPayment,
  insertOfferPayment,
  issueInvoiceForOfferPayment,
  type OfferInvoiceInput,
  resolveOfferPaymentType,
} from "./eventOfferInvoice.ts";
import { findExistingFinalInvoice, loadDownPaymentDeductions } from "./finalInvoiceDeductions.ts";

type Row = Record<string, unknown>;

/** Minimaler Supabase-Fake: Tabellen als Arrays, Filter eq/in/not, insert (mit Unique auf source_offer_option_id), update. */
function fakeSupabase(tables: Record<string, Row[]>) {
  const updates: { table: string; patch: Row; filters: [string, unknown][] }[] = [];
  const from = (table: string) => {
    tables[table] ??= [];
    const filters: ((r: Row) => boolean)[] = [];
    const eqs: [string, unknown][] = [];
    let patch: Row | null = null;
    let insertRow: Row | null = null;
    const run = () => {
      if (insertRow) {
        const dup = table === "v2_payments" && insertRow.source_offer_option_id &&
          tables[table].some((r) => r.source_offer_option_id === insertRow!.source_offer_option_id);
        if (dup) return { data: null, error: { code: "23505", message: "duplicate key" } };
        const row = { id: `pay-${tables[table].length + 1}`, created_at: "2026-11-01T10:00:00Z", ...insertRow };
        tables[table].push(row);
        return { data: row, error: null };
      }
      const rows = tables[table].filter((r) => filters.every((f) => f(r)));
      if (patch) {
        updates.push({ table, patch, filters: eqs });
        rows.forEach((r) => Object.assign(r, patch));
        return { data: null, error: null };
      }
      return { data: rows, error: null };
    };
    // deno-lint-ignore no-explicit-any
    const q: any = {
      select: () => q,
      insert: (r: Row) => { insertRow = r; return q; },
      update: (p: Row) => { patch = p; return q; },
      eq: (c: string, v: unknown) => { eqs.push([c, v]); filters.push((r) => r[c] === v); return q; },
      in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return q; },
      not: (c: string, _op: string, v: unknown) => { filters.push((r) => r[c] !== v); return q; },
      order: () => q,
      single: () => { const r = run(); return Promise.resolve(r.error ? r : { data: Array.isArray(r.data) ? r.data[0] : r.data, error: null }); },
      maybeSingle: () => { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }); },
      // deno-lint-ignore no-explicit-any
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return q;
  };
  return { from, updates, tables };
}

function fakeFetch(responses: Record<string, unknown>) {
  const calls: { fn: string; body: Row }[] = [];
  const fetchFn = ((url: string, init: { body: string }) => {
    const fn = url.split("/functions/v1/")[1];
    calls.push({ fn, body: JSON.parse(init.body) });
    return Promise.resolve(new Response(JSON.stringify(responses[fn] ?? {}), { status: 200 }));
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

const base = (paymentType: "full" | "deposit"): OfferInvoiceInput => ({
  paymentType,
  paymentId: "pay-1",
  event: { id: "ev-1", date: "2026-12-12", event_time: "18:00" },
  bookingNumber: "EVT-2026-0001",
  customer: { name: "Max Muster", email: "max@example.com" },
  option: {
    package_id: "pkg-1", label: "Weihnachtsfeier", guest_count: 20, amount_total: 2000,
    offer_mode: "package", menu_selection: {}, packages: { package_type: "event" },
  },
});
const deps = (fetchFn: typeof fetch) => ({ fetchFn, supabaseUrl: "https://x.supabase.co", serviceKey: "k" });

Deno.test("Zahlungstyp: Metadata gewinnt, sonst Betrag gegen Angebotssumme", () => {
  assertEquals(resolveOfferPaymentType("deposit", 200000, 200000), "deposit");
  assertEquals(resolveOfferPaymentType("FULL", 40000, 200000), "full");
  assertEquals(resolveOfferPaymentType(undefined, 40000, 200000), "deposit");
  assertEquals(resolveOfferPaymentType(undefined, 200000, 200000), "full");
  assertEquals(resolveOfferPaymentType("quatsch", 199999, 200000), "full"); // 1-Cent-Toleranz
});

Deno.test("Anzahlung: Anzahlungsrechnung für die v2_payments-Zeile, KEINE Vollrechnung, v2_events unberührt", async () => {
  const sb = fakeSupabase({});
  const { fetchFn, calls } = fakeFetch({
    "create-lexoffice-downpayment-invoice": { success: true, invoiceId: "inv-dp", invoiceNumber: "RE-1" },
  });
  const r = await issueInvoiceForOfferPayment(sb, base("deposit"), deps(fetchFn));
  assertEquals(calls.length, 1);
  assertEquals(calls[0].fn, "create-lexoffice-downpayment-invoice");
  assertEquals(calls[0].body, { payment_id: "pay-1" }); // Betrag kommt aus der gezahlten v2_payments-Zeile
  assertEquals(r, { kind: "downpayment", ok: true, invoiceId: "inv-dp", invoiceNumber: "RE-1" });
  assertEquals(sb.updates.length, 0); // weder invoice_lexoffice_id noch lexoffice_document_type auf v2_events
});

Deno.test("Anzahlung: Fehler der Rechnungs-Function (200 + success:false) ist nicht fatal und wird gemeldet", async () => {
  const { fetchFn } = fakeFetch({ "create-lexoffice-downpayment-invoice": { success: false, error: "LexOffice down" } });
  const r = await issueInvoiceForOfferPayment(fakeSupabase({}), base("deposit"), deps(fetchFn));
  assertEquals(r, { kind: "downpayment", ok: false, invoiceId: undefined, invoiceNumber: null });
});

Deno.test("Vollzahlung: Vollrechnung wie bisher (voller Betrag, bezahlt), Verknüpfung auf v2_events und v2_payments", async () => {
  const sb = fakeSupabase({});
  const { fetchFn, calls } = fakeFetch({ "create-lexoffice-invoice": { invoiceId: "inv-full", invoiceNumber: "RE-2" } });
  const r = await issueInvoiceForOfferPayment(sb, base("full"), deps(fetchFn));
  assertEquals(calls.map((c) => c.fn), ["create-lexoffice-invoice"]);
  const body = calls[0].body as ReturnType<typeof buildFullInvoicePayload>;
  assertEquals(body.grandTotal, 2000);
  assertEquals(body.isPaid, true);
  assertEquals(body.documentType, "invoice");
  assertEquals(body.items[0].price, 100);
  assertEquals(r, { kind: "full", ok: true, invoiceId: "inv-full", documentType: "invoice" });
  assertEquals(sb.updates.find((u) => u.table === "v2_events")?.patch, {
    invoice_lexoffice_id: "inv-full", invoice_lexoffice_number: "RE-2", lexoffice_document_type: "invoice",
  });
  assertEquals(sb.updates.find((u) => u.table === "v2_payments")?.patch.lexoffice_invoice_id, "inv-full");
});

Deno.test("70/30-Split bleibt: reines Event-Paket markiert, Paket mit Getränke-Zusatz nicht", () => {
  assertEquals(buildFullInvoicePayload(base("full")).items[0].isEventPackage, true);
  const withDrinks = base("full");
  withDrinks.option.menu_selection = { drinksMode: "pauschale" };
  assertEquals(buildFullInvoicePayload(withDrinks).items[0].isEventPackage, false);
  const menu = base("full");
  menu.option.packages = [{ package_type: "menu" }];
  assertEquals(buildFullInvoicePayload(menu).items[0].isEventPackage, false);
});

Deno.test("Restzahlung nach Anzahlung: Anzahlung setzt keine Standardrechnung, Schlussrechnung ist nicht blockiert und zieht die v2_payments-Anzahlung ab", async () => {
  const sb = fakeSupabase({
    v2_events: [{ id: "ev-1" }],
    v2_payments: [],
  });
  // 1. Anzahlung 400 EUR über den Angebots-Zahlweg
  const ins = await insertOfferPayment(sb, {
    event_id: "ev-1", amount_cents: 40000, payment_type: "deposit", status: "paid", source_offer_option_id: "opt-1",
    paid_at: "2026-11-02T09:00:00Z",
  });
  assertEquals(ins.status, "created");
  const { fetchFn } = fakeFetch({ "create-lexoffice-downpayment-invoice": { success: true, invoiceId: "inv-dp" } });
  await issueInvoiceForOfferPayment(sb, { ...base("deposit"), paymentId: (ins as { paymentId: string }).paymentId }, deps(fetchFn));
  // (die Downpayment-Function schreibt die Rechnungs-ID selbst auf v2_payments)
  Object.assign(sb.tables.v2_payments[0], { lexoffice_invoice_id: "inv-dp", lexoffice_invoice_number: "AR-1" });

  // 2. Schlussrechnung nach der Restzahlung
  assertEquals(findExistingFinalInvoice(sb.tables.v2_events[0] as never), null);
  const ded = await loadDownPaymentDeductions(sb, "ev-1");
  assertEquals(ded, [{ invoice_number: "AR-1", date_iso: "2026-11-02T09:00:00Z", gross: 400, tax_rate: 7 }]);
});

Deno.test("Schlussrechnung: nur bezahlte Anzahlungen/Vorauszahlungen mit Rechnung, Restzahlung/Vollzahlung/andere Events nicht, keine Doppelzählung", async () => {
  const mk = (o: Row) => ({ event_id: "ev-1", status: "paid", created_at: "2026-11-01T10:00:00Z", paid_at: null, ...o });
  const sb = fakeSupabase({
    v2_payments: [
      mk({ id: "a", payment_type: "deposit", amount_cents: 30000, lexoffice_invoice_id: "i1", lexoffice_invoice_number: "AR-1" }),
      mk({ id: "b", payment_type: "prepayment", amount_cents: 10000, lexoffice_invoice_id: "i2", lexoffice_invoice_number: "AR-2" }),
      mk({ id: "c", payment_type: "deposit", amount_cents: 30000, lexoffice_invoice_id: "i1", lexoffice_invoice_number: "AR-1" }), // gleiche Rechnung
      mk({ id: "d", payment_type: "final", amount_cents: 99900, lexoffice_invoice_id: "i3" }),
      mk({ id: "e", payment_type: "full", amount_cents: 99900, lexoffice_invoice_id: "i4" }),
      mk({ id: "f", payment_type: "deposit", amount_cents: 5000, lexoffice_invoice_id: null }),
      mk({ id: "g", payment_type: "deposit", amount_cents: 5000, lexoffice_invoice_id: "i5", status: "sent" }),
      mk({ id: "h", payment_type: "deposit", amount_cents: 5000, lexoffice_invoice_id: "i6", event_id: "ev-2" }),
    ],
  });
  const ded = await loadDownPaymentDeductions(sb, "ev-1");
  assertEquals(ded.map((d) => [d.invoice_number, d.gross]), [["AR-1", 300], ["AR-2", 100]]);
});

Deno.test("Schlussrechnung: bestehende Vollrechnung blockiert weiterhin (Vollzahlung), Anzahlung nicht", () => {
  assertEquals(findExistingFinalInvoice({ invoice_lexoffice_id: "x", lexoffice_document_type: "invoice" }), { id: "x", number: null });
  assertEquals(findExistingFinalInvoice({ invoice_lexoffice_id: "x", lexoffice_document_type: "quotation" }), null);
  assertEquals(findExistingFinalInvoice({ final_lexoffice_invoice_id: "f", final_lexoffice_invoice_number: "S-1" }), { id: "f", number: "S-1" });
  assertEquals(findExistingFinalInvoice(null), null);
});

Deno.test("Idempotenz: Webhook-Wiederholung erzeugt keine zweite Zahlung und keine zweite Rechnung", async () => {
  const sb = fakeSupabase({ v2_payments: [] });
  const { fetchFn, calls } = fakeFetch({ "create-lexoffice-downpayment-invoice": { success: true, invoiceId: "inv-dp" } });
  // Ablauf wie processEventOfferPaymentInline: Vorabprüfung, Insert, Rechnung nur bei neuer Zahlung
  const deliver = async () => {
    if (await findExistingOfferPayment(sb, "opt-1")) return "skipped";
    const ins = await insertOfferPayment(sb, { event_id: "ev-1", amount_cents: 40000, payment_type: "deposit", status: "paid", source_offer_option_id: "opt-1" });
    if (ins.status !== "created") return ins.status;
    await issueInvoiceForOfferPayment(sb, { ...base("deposit"), paymentId: ins.paymentId }, deps(fetchFn));
    return "invoiced";
  };
  assertEquals(await deliver(), "invoiced");
  assertEquals(await deliver(), "skipped");
  assertEquals(sb.tables.v2_payments.length, 1);
  assertEquals(calls.length, 1);
  // Race: Vorabprüfung sah noch nichts, der Insert scheitert an der Unique-Regel -> ebenfalls keine Rechnung
  const race = await insertOfferPayment(sb, { event_id: "ev-1", amount_cents: 40000, payment_type: "deposit", source_offer_option_id: "opt-1" });
  assertEquals(race.status, "duplicate");
  assert(sb.tables.v2_payments.length === 1);
});
