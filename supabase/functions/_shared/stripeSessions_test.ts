// deno test supabase/functions/_shared/stripeSessions_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { createSessionIdempotent, deterministicExpiresAt, expireSessions, findOpenSessions, reusableSession, sessionIdempotencyKey, type StripeLike } from "./stripeSessions.ts";
import { checkPaymentMatchesOrder } from "./paymentGuard.ts";

const T = Date.UTC(2026, 10, 22, 12, 0, 30);

Deno.test("Mischsession: Ablauf ist je 3-Min-Fenster deterministisch und liegt >= 30 Min nach der Erstellung", () => {
  const a = deterministicExpiresAt(T);
  assertEquals(a, deterministicExpiresAt(T + 100_000)); // gleiches Fenster
  for (const offset of [0, 60_000, 179_000]) {
    const created = Math.floor(T / 180_000) * 180_000 + offset;
    const remainingMin = (a * 1000 - created) / 60_000;
    assert(remainingMin >= 30 && remainingMin <= 33, `Restlaufzeit ${remainingMin}`);
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
  checkout: { sessions: { create: () => Promise.reject(new Error("unused")), expire: () => Promise.resolve({}), search: () => Promise.resolve({ data: [] }), ...impl } },
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

Deno.test("offene Sessions: finden, passende weiterverwenden, übrige ablaufen lassen; Suchfehler = unbekannt", async () => {
  const expired: string[] = [];
  const open = [
    { id: "s1", url: "u1", amount_total: 51425, expires_at: Math.floor(T / 1000) + 20 * 60 },
    { id: "s2", url: "u2", amount_total: 99999, expires_at: Math.floor(T / 1000) + 20 * 60 },
    { id: "s3", url: "u3", amount_total: 51425, expires_at: Math.floor(T / 1000) + 60 },
  ];
  const s = stripe({ search: () => Promise.resolve({ data: open }), expire: (id) => { expired.push(id); return Promise.resolve({}); } });
  const found = await findOpenSessions(s, "CAT-1");
  assertEquals(found?.length, 3);
  assertEquals(reusableSession(found!, 51425, T)?.id, "s1"); // s3 läuft in 1 Min ab, s2 falscher Betrag
  assertEquals(await expireSessions(s, found!.filter((x) => x.id !== "s1")), true);
  assertEquals(expired, ["s2", "s3"]);
  assertEquals(await findOpenSessions(stripe({ search: () => Promise.reject(new Error("down")) }), "CAT-1"), null);
});

Deno.test("expire: schon abgelaufen ist ok, anderer Fehler = unsicher (Korb dann nicht freigeben)", async () => {
  assertEquals(await expireSessions(stripe({ expire: () => Promise.reject(new Error("This Checkout Session has already expired")) }), [{ id: "a" }]), true);
  assertEquals(await expireSessions(stripe({ expire: () => Promise.reject(new Error("network down")) }), [{ id: "a" }]), false);
});

Deno.test("Webhook A1b: stornierte Bestellung oder abweichender Betrag wird nicht bestätigt", () => {
  assertEquals(checkPaymentMatchesOrder({ status: "confirmed", total_amount: 514.25 }, { amount_total: 51425 }, false), { ok: true });
  assertEquals(checkPaymentMatchesOrder({ status: "cancelled", total_amount: 514.25 }, { amount_total: 51425 }, false).ok, false);
  const m = checkPaymentMatchesOrder({ status: "pending", total_amount: 514.25 }, { amount_total: 100 }, false);
  assert(!m.ok && m.reason === "amount_mismatch");
  // Mischbestellung: Betrag enthält Körbe, nur Storno-Prüfung
  assertEquals(checkPaymentMatchesOrder({ status: "pending", total_amount: 514.25 }, { amount_total: 99999 }, true), { ok: true });
});
