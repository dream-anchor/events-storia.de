// deno test supabase/functions/_shared/stripeSessions_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { createSessionIdempotent, deterministicExpiresAt, expireSessions, findOpenSessions, loadSessionLedger, recordSession, reusableSession, sessionIdempotencyKey, settleSessions, type StripeLike } from "./stripeSessions.ts";
import { alertIfDoublePayment, checkPaymentMatchesOrder, isDoublePayment } from "./paymentGuard.ts";

const T = Date.UTC(2026, 10, 22, 12, 0, 30);

Deno.test("Mischsession: Ablauf ist je 3-Min-Fenster deterministisch und liegt >= 31 Min (Stripe-Minimum 30 + Puffer) nach der Erstellung", () => {
  const a = deterministicExpiresAt(T);
  assertEquals(a, deterministicExpiresAt(T + 100_000)); // gleiches Fenster
  for (const offset of [0, 60_000, 179_000]) {
    const created = Math.floor(T / 180_000) * 180_000 + offset;
    const remainingMin = (a * 1000 - created) / 60_000;
    assert(remainingMin >= 31 && remainingMin <= 34, `Restlaufzeit ${remainingMin}`);
  }
  assert(deterministicExpiresAt(T + 200_000) !== a);
});

Deno.test("Idempotenzschlüssel: gleiche Parameter+Fenster gleich; geänderte Parameter (Name, Zahlart) oder Fenster anders", async () => {
  const p = { customer_email: "a@b.de", metadata: { customer_name: "Max", payment_method_selected: "stripe" }, expires_at: deterministicExpiresAt(T) };
  const k = await sessionIdempotencyKey("CAT-1", p, T);
  assertEquals(k, await sessionIdempotencyKey("CAT-1", p, T + 60_000));
  assert(k !== await sessionIdempotencyKey("CAT-1", { ...p, metadata: { ...p.metadata, customer_name: "Maxi" } }, T));
  assert(k !== await sessionIdempotencyKey("CAT-1", { ...p, metadata: { ...p.metadata, payment_method_selected: "billie" } }, T));
  assert(k !== await sessionIdempotencyKey("CAT-1", p, T + 200_000));
});

const stripe = (impl: Partial<StripeLike["checkout"]["sessions"]>): StripeLike => ({
  checkout: { sessions: { create: () => Promise.reject(new Error("unused")), expire: () => Promise.resolve({ status: "expired" }), retrieve: () => Promise.reject(new Error("unused")), list: () => Promise.resolve({ data: [] }), ...impl } },
});

Deno.test("Idempotenz-Konflikt (409 key_in_use): einmal mit neuem Schlüssel wiederholen statt 25 Min zu hängen", async () => {
  const keys: string[] = [];
  const s = stripe({
    create: (_p, o) => {
      keys.push(o?.idempotencyKey ?? "");
      return keys.length === 1 ? Promise.reject(Object.assign(new Error("in use"), { type: "StripeIdempotencyError", code: "idempotency_key_in_use" })) : Promise.resolve({ id: "cs_2" });
    },
  });
  const r = await createSessionIdempotent(s, {}, "k1", () => Promise.resolve());
  assertEquals(r.id, "cs_2");
  assertEquals(keys, ["k1", "k1-r"]);
});

Deno.test("andere Stripe-Fehler werden nicht verschluckt", async () => {
  const s = stripe({ create: () => Promise.reject(new Error("card_declined")) });
  let msg = "";
  try { await createSessionIdempotent(s, {}, "k"); } catch (e) { msg = (e as Error).message; }
  assertEquals(msg, "card_declined");
});

Deno.test("Retry im selben Fenster liefert dieselbe Session (Korb + Wiederholung, identische Parameter => ein Schlüssel)", async () => {
  const seen = new Map<string, string>();
  const s = stripe({ create: (_p, o) => { const k = o!.idempotencyKey!; if (!seen.has(k)) seen.set(k, `cs_${seen.size + 1}`); return Promise.resolve({ id: seen.get(k) }); } });
  const params = { metadata: { gift_order_id: "g1" }, expires_at: deterministicExpiresAt(T) };
  const a = await createSessionIdempotent(s, params, await sessionIdempotencyKey("CAT-1", params, T));
  const b = await createSessionIdempotent(s, params, await sessionIdempotencyKey("CAT-1", { ...params, expires_at: deterministicExpiresAt(T + 90_000) }, T + 90_000));
  assertEquals(a.id, b.id);
});

const meta = (n: string) => ({ order_number: n });

Deno.test("Fake kennt nur die echte API: checkout.sessions.search existiert nicht und schlägt fehl", async () => {
  const s = stripe({}) as unknown as { checkout: { sessions: { search?: () => Promise<unknown> } } };
  assertEquals(typeof s.checkout.sessions.search, "undefined");
  let threw = false;
  try { await s.checkout.sessions.search!(); } catch { threw = true; }
  assert(threw);
});

// Fake mit echter Stripe-Semantik: offene Session hat customer_details = null (wird erst nach Abschluss/Ablauf gefüllt), list kennt keinen
// metadata-Filter (liefert ALLE offenen Sessions, neueste zuerst, in Seiten), expire auf eine complete-Session wirft.
interface FakeSession { id: string; status: "open" | "complete" | "expired"; url: string | null; amount_total: number; metadata: Record<string, string>; customer_details: null | { email: string }; customer_email?: string | null; expires_at: number; created: number }
function realisticStripe(sessions: FakeSession[], opts: { pageSize?: number; failList?: boolean; failRetrieve?: Set<string> } = {}) {
  const calls: { list: Record<string, unknown>[]; expired: string[] } = { list: [], expired: [] };
  const byId = (id: string) => sessions.find((x) => x.id === id);
  const s = stripe({
    list: (p) => {
      calls.list.push(p as Record<string, unknown>);
      if (opts.failList) return Promise.reject(new Error("down"));
      // customer_details-Filter gibt es bei Stripe nur für abgeschlossene Sessions: für offene (customer_details null) nie ein Treffer
      const all = sessions.filter((x) => (!p.status || x.status === p.status) && (typeof p.created !== "object" || x.created >= (p.created.gte ?? 0))
        && (!("customer_details" in p) || x.customer_details?.email === (p as { customer_details?: { email: string } }).customer_details?.email));
      const size = opts.pageSize ?? 100;
      const start = p.starting_after ? all.findIndex((x) => x.id === p.starting_after) + 1 : 0;
      const data = all.slice(start, start + size);
      return Promise.resolve({ data, has_more: start + size < all.length });
    },
    retrieve: (id) => opts.failRetrieve?.has(id) ? Promise.reject(new Error("net")) : byId(id) ? Promise.resolve({ ...byId(id) }) : Promise.reject(new Error("No such checkout.session")),
    expire: (id) => {
      const x = byId(id);
      if (!x) return Promise.reject(new Error("No such checkout.session"));
      if (x.status === "complete") return Promise.reject(new Error("Only Checkout Sessions with a status in (open) can be expired."));
      x.status = "expired"; calls.expired.push(id);
      return Promise.resolve({ ...x });
    },
  });
  return { s, calls };
}
const sess = (id: string, order: string, extra: Partial<FakeSession> = {}): FakeSession => ({
  id, status: "open", url: `u_${id}`, amount_total: 51425, metadata: meta(order), customer_details: null, customer_email: null,
  expires_at: Math.floor(T / 1000) + 20 * 60, created: Math.floor(T / 1000) - 60, ...extra,
});

Deno.test("B1: offene Session OHNE customer_details (echte Stripe-Semantik) wird per Rückfall-Liste gefunden, passende weiterverwendet, übrige abgelaufen", async () => {
  const { s, calls } = realisticStripe([
    sess("s1", "CAT-1"), sess("s2", "CAT-1", { amount_total: 99999 }), sess("s3", "CAT-1", { expires_at: Math.floor(T / 1000) + 60 }), sess("other", "CAT-2"),
  ]);
  const found = await findOpenSessions(s, "CAT-1", [], T);
  assertEquals(found.complete, true);
  assertEquals(found.sessions.map((x) => x.id).sort(), ["s1", "s2", "s3"]);
  // kein customer_details-Filter mehr; Lookback 25 h
  assertEquals(calls.list, [{ status: "open", created: { gte: Math.floor(T / 1000) - 25 * 3600 }, limit: 100 }]);
  assertEquals(reusableSession(found.sessions, 51425, T)?.id, "s1");
  assertEquals(await settleSessions(s, { sessions: found.sessions.filter((x) => x.id !== "s1"), complete: true }), "expired");
  assertEquals(calls.expired.sort(), ["s2", "s3"]);
});

Deno.test("B1: Ledger-ID wird gezielt per retrieve gefunden (auch ohne Liste), bezahlte Ledger-Session => paid, nie freigeben", async () => {
  const { s } = realisticStripe([sess("a", "CAT-1"), sess("b", "CAT-1", { status: "complete", url: null })], { failList: true });
  const found = await findOpenSessions(s, "CAT-1", ["a", "b"], T);
  assertEquals(found.sessions.map((x) => x.id), ["a", "b"]);
  assertEquals(found.complete, false); // Liste ausgefallen => keine Vollständigkeit
  assertEquals(await settleSessions(s, found), "paid");
  // bezahlte Session wird nicht als wiederverwendbar angeboten
  assertEquals(reusableSession(found.sessions.filter((x) => x.id === "b"), 51425, T), null);
});

Deno.test("B1: leere Trefferliste zählt NIE als sicher abgelaufen, wenn die Suche nicht vollständig war", async () => {
  // a) Ledger nicht lesbar (Tabelle fehlt) => complete=false => unsafe
  const none = realisticStripe([]);
  const f1 = await findOpenSessions(none.s, "CAT-1", null, T);
  assertEquals(f1, { sessions: [], complete: false });
  assertEquals(await settleSessions(none.s, f1), "unsafe");
  // b) Liste scheitert
  const f2 = await findOpenSessions(realisticStripe([], { failList: true }).s, "CAT-1", [], T);
  assertEquals(f2.complete, false);
  assertEquals(await settleSessions(none.s, f2), "unsafe");
  // c) Ledger-ID nicht abrufbar
  const f3 = await findOpenSessions(realisticStripe([sess("a", "CAT-1")], { failRetrieve: new Set(["a"]) }).s, "CAT-1", ["a"], T);
  assertEquals(f3.complete, false);
  // d) Blättern nicht ausgeschöpft (MAX_PAGES) => unvollständig
  const many = Array.from({ length: 12 }, (_, i) => sess(`x${i}`, "CAT-9"));
  const f4 = await findOpenSessions(realisticStripe(many, { pageSize: 1 }).s, "CAT-1", [], T);
  assertEquals(f4.complete, false);
  // e) Ledger lesbar + Liste vollständig + nichts offen => nachweislich leer => expired
  const f5 = await findOpenSessions(none.s, "CAT-1", [], T);
  assertEquals(f5, { sessions: [], complete: true });
  assertEquals(await settleSessions(none.s, f5), "expired");
});

Deno.test("B1: Blättern über mehrere Seiten findet die Session der Bestellung auch hinter Fremd-Sessions", async () => {
  const many = [...Array.from({ length: 5 }, (_, i) => sess(`x${i}`, "CAT-9")), sess("mine", "CAT-1")];
  const { s, calls } = realisticStripe(many, { pageSize: 2 });
  const f = await findOpenSessions(s, "CAT-1", [], T);
  assertEquals(f.sessions.map((x) => x.id), ["mine"]);
  assertEquals(f.complete, true);
  assertEquals(calls.list.length, 3);
});

Deno.test("B1: abgelaufene Ledger-Session zählt nicht als offen; Fake-Semantik: expire auf complete wirft, retrieve entscheidet", async () => {
  const { s } = realisticStripe([sess("old", "CAT-1", { status: "expired", url: null }), sess("paid", "CAT-1", { status: "complete", url: null })]);
  let threw = false;
  try { await s.checkout.sessions.expire("paid"); } catch { threw = true; }
  assert(threw);
  const f = await findOpenSessions(s, "CAT-1", ["old"], T);
  assertEquals(f.sessions, []);
  assertEquals(f.complete, true);
});

Deno.test("Ledger: fehlertolerant (Tabelle fehlt / wirft) und liest/schreibt die Tabelle catering_checkout_sessions", async () => {
  const rows: { session_id: string; order_number: string }[] = [];
  const db = {
    from: (t: string) => ({
      select: () => ({ eq: (_c: string, v: string) => Promise.resolve({ data: t === "catering_checkout_sessions" ? rows.filter((r) => r.order_number === v) : null, error: null }) }),
      upsert: (r: { session_id: string; order_number: string }) => { rows.push(r); return Promise.resolve({ error: null }); },
    }),
  };
  assertEquals(await recordSession(db, "CAT-1", "cs_1"), true);
  assertEquals(await loadSessionLedger(db, "CAT-1"), ["cs_1"]);
  assertEquals(await loadSessionLedger(db, "CAT-2"), []);
  const missing = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "relation does not exist" } }) }), upsert: () => Promise.resolve({ error: { message: "relation does not exist" } }) }) };
  assertEquals(await loadSessionLedger(missing, "CAT-1"), null);
  assertEquals(await recordSession(missing, "CAT-1", "cs_1"), false);
  const throwing = { from: () => { throw new Error("boom"); } };
  assertEquals(await loadSessionLedger(throwing, "CAT-1"), null);
  assertEquals(await recordSession(throwing, "CAT-1", "cs_1"), false);
});

Deno.test("expire: Erfolg mit status expired ok; schon abgelaufen (Fehler, retrieve=expired) ok", async () => {
  assertEquals(await expireSessions(stripe({}), [{ id: "a" }]), "expired");
  const s = stripe({ expire: () => Promise.reject(new Error("This Checkout Session has already expired")), retrieve: () => Promise.resolve({ status: "expired" }) });
  assertEquals(await expireSessions(s, [{ id: "a" }]), "expired");
});

Deno.test("expire: BEZAHLTE Session (complete) => paid, nichts freigeben; auch wenn die Fehlermeldung nach 'expired' klingt", async () => {
  const s = stripe({ expire: () => Promise.reject(new Error("Only open sessions can be expired; this session is complete")), retrieve: () => Promise.resolve({ status: "complete" }) });
  assertEquals(await expireSessions(s, [{ id: "a" }]), "paid");
  // Meldung enthält 'expired', Status ist trotzdem complete
  const s2 = stripe({ expire: () => Promise.reject(new Error("session cannot be expired")), retrieve: () => Promise.resolve({ status: "complete" }) });
  assertEquals(await expireSessions(s2, [{ id: "a" }]), "paid");
  // paid hat Vorrang vor unsicheren Vorgängern nicht: erste unsichere, zweite bezahlt => paid
  const s3 = stripe({ expire: () => Promise.reject(new Error("x")), retrieve: (id) => id === "b" ? Promise.resolve({ status: "complete" }) : Promise.reject(new Error("net")) });
  assertEquals(await expireSessions(s3, [{ id: "a" }, { id: "b" }]), "paid");
});

Deno.test("expire: anderer Fehler oder Status nicht ermittelbar/open = unsafe (Hold bleibt)", async () => {
  assertEquals(await expireSessions(stripe({ expire: () => Promise.reject(new Error("network down")), retrieve: () => Promise.reject(new Error("network down")) }), [{ id: "a" }]), "unsafe");
  assertEquals(await expireSessions(stripe({ expire: () => Promise.reject(new Error("rate")), retrieve: () => Promise.resolve({ status: "open" }) }), [{ id: "a" }]), "unsafe");
  // expire meldet Erfolg, aber Status nicht expired und retrieve scheitert
  assertEquals(await expireSessions(stripe({ expire: () => Promise.resolve({ status: "open" }), retrieve: () => Promise.reject(new Error("x")) }), [{ id: "a" }]), "unsafe");
});

Deno.test("Doppelzahlung: anderer PaymentIntent auf bezahlter Bestellung erkannt, Wiederholung desselben nicht", () => {
  assertEquals(isDoublePayment({ stripe_payment_intent_id: "pi_1" }, { payment_intent: "pi_2" }), true);
  assertEquals(isDoublePayment({ stripe_payment_intent_id: "pi_1" }, { payment_intent: "pi_1" }), false);
  assertEquals(isDoublePayment({ stripe_payment_intent_id: null }, { payment_intent: "pi_2" }), false);
  assertEquals(isDoublePayment({ stripe_payment_intent_id: "pi_1" }, { payment_intent: null }), false);
});

Deno.test("Webhook A1b: stornierte Bestellung oder abweichender Betrag wird nicht bestätigt", () => {
  assertEquals(checkPaymentMatchesOrder({ status: "confirmed", total_amount: 514.25 }, { amount_total: 51425 }, false), { ok: true });
  assertEquals(checkPaymentMatchesOrder({ status: "cancelled", total_amount: 514.25 }, { amount_total: 51425 }, false).ok, false);
  const m = checkPaymentMatchesOrder({ status: "pending", total_amount: 514.25 }, { amount_total: 100 }, false);
  assert(!m.ok && m.reason === "amount_mismatch");
  // Mischbestellung: Betrag enthält Körbe, nur Storno-Prüfung
  assertEquals(checkPaymentMatchesOrder({ status: "pending", total_amount: 514.25 }, { amount_total: 99999 }, true), { ok: true });
});

Deno.test("Doppelzahlung (Webhook-Pfad bezahlte Bestellung): anderer PaymentIntent alarmiert genau einmal mit escapten Werten, Wiederholung bleibt still", async () => {
  const reports: string[] = [];
  const alerts: { subject: string; html: string }[] = [];
  const deps = {
    report: (m: string) => { reports.push(m); },
    alert: (subject: string, html: string) => { alerts.push({ subject, html }); return Promise.resolve(); },
    esc: (x: string) => x.replace(/</g, "&lt;"),
  };
  const order = { stripe_payment_intent_id: "pi_1" };
  assertEquals(await alertIfDoublePayment(order, { id: "cs_2", payment_intent: "pi_1" }, "CAT-1", deps), false); // Wiederholung
  assertEquals(await alertIfDoublePayment(order, { id: "cs_2", payment_intent: null }, "CAT-1", deps), false);
  assertEquals(reports.length + alerts.length, 0);
  assertEquals(await alertIfDoublePayment(order, { id: "cs_<2>", payment_intent: "pi_2" }, "CAT-1", deps), true);
  assertEquals(reports.length, 1);
  assert(reports[0].includes("double_payment order=CAT-1") && reports[0].includes("pi=pi_2"));
  assertEquals(alerts.length, 1);
  assertEquals(alerts[0].subject, "Doppelzahlung: CAT-1");
  assert(alerts[0].html.includes("cs_&lt;2>"));
});
