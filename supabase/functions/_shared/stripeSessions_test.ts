// deno test supabase/functions/_shared/stripeSessions_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { createSessionIdempotent, deterministicExpiresAt, expireSessions, findOpenSessions, reusableSession, sessionIdempotencyKey, type StripeLike } from "./stripeSessions.ts";
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

Deno.test("offene Sessions: per list(customer_details.email, status=open, created) holen, nach metadata.order_number filtern, passende weiterverwenden, übrige ablaufen lassen", async () => {
  const expired: string[] = [];
  const calls: unknown[] = [];
  const open = [
    { id: "s1", url: "u1", amount_total: 51425, metadata: meta("CAT-1"), expires_at: Math.floor(T / 1000) + 20 * 60 },
    { id: "s2", url: "u2", amount_total: 99999, metadata: meta("CAT-1"), expires_at: Math.floor(T / 1000) + 20 * 60 },
    { id: "s3", url: "u3", amount_total: 51425, metadata: meta("CAT-1"), expires_at: Math.floor(T / 1000) + 60 },
    { id: "other", url: "u4", amount_total: 51425, metadata: meta("CAT-2"), expires_at: Math.floor(T / 1000) + 20 * 60 },
  ];
  const s = stripe({
    list: (p) => { calls.push(p); return Promise.resolve({ data: open }); },
    expire: (id) => { expired.push(id); return Promise.resolve({ status: "expired" }); },
  });
  const found = await findOpenSessions(s, "CAT-1", "a@b.de", T);
  assertEquals(found?.map((x) => x.id), ["s1", "s2", "s3"]);
  assertEquals(calls, [{ customer_details: { email: "a@b.de" }, status: "open", created: { gte: Math.floor(T / 1000) - 2 * 24 * 3600 }, limit: 100 }]);
  assertEquals(reusableSession(found!, 51425, T)?.id, "s1"); // s3 läuft in 1 Min ab, s2 falscher Betrag
  assertEquals(await expireSessions(s, found!.filter((x) => x.id !== "s1")), "expired");
  assertEquals(expired, ["s2", "s3"]);
  assertEquals(await findOpenSessions(stripe({ list: () => Promise.reject(new Error("down")) }), "CAT-1", "a@b.de"), null);
});

Deno.test("offene Sessions: Seitenwechsel (has_more) wird gelesen; zu viele Seiten = unbekannt", async () => {
  const afters: (string | undefined)[] = [];
  const s = stripe({
    list: (p) => { afters.push(p.starting_after); return Promise.resolve(p.starting_after ? { data: [{ id: "b", metadata: meta("CAT-1") }], has_more: false } : { data: [{ id: "a", metadata: meta("CAT-1") }], has_more: true }); },
  });
  assertEquals((await findOpenSessions(s, "CAT-1", "a@b.de"))?.map((x) => x.id), ["a", "b"]);
  assertEquals(afters, [undefined, "a"]);
  let n = 0;
  assertEquals(await findOpenSessions(stripe({ list: () => Promise.resolve({ data: [{ id: `x${n++}` }], has_more: true }) }), "CAT-1", "a@b.de"), null);
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
