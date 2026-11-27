// deno test supabase/functions/_shared/lexofficePositions_test.ts
// Ohne Netz: Lexoffice und Anmeldung sind nachgebildet.
import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { MAX_IDS_PER_CALL, parseRequest, REQUEST_SPACING_MS } from "./lexofficePositions.ts";
import { createHandler } from "./lexofficePositionsHandler.ts";

const ID = "6d192839-c077-4514-8645-c25d5f2248b9";
const DOC = {
  voucherNumber: "RE-1", voucherDate: "2026-03-09", voucherStatus: "paid",
  address: { name: "Erika Muster", street: "Musterweg 1" }, introduction: "Liebe Erika", remark: "erika@example.org",
  taxConditions: { taxType: "gross" },
  totalPrice: { totalGrossAmount: 119 },
  taxAmounts: [{ taxRatePercentage: 19, netAmount: 100, taxAmount: 19 }],
  lineItems: [
    { type: "custom", name: "Lieferung", description: "an Musterweg 1", quantity: 1, unitPrice: { grossAmount: 119, taxRatePercentage: 19 }, lineItemAmount: 119 },
    { type: "text", name: "Ansprechpartnerin Erika Muster" },
  ],
};

function setup(responses: Response[], role = "admin", authStatus?: number) {
  const calls: { url: string; method?: string }[] = [];
  const sleeps: number[] = [];
  const handler = createHandler({
    authorize: () => authStatus
      ? Promise.reject(Object.assign(new Error("Nicht autorisiert"), { status: authStatus }))
      : Promise.resolve({ role }),
    apiKey: () => "test-key",
    fetch: (url, init) => {
      calls.push({ url, method: init.method });
      return Promise.resolve(responses.shift() ?? new Response("", { status: 404 }));
    },
    sleep: (ms) => (sleeps.push(ms), Promise.resolve()),
  });
  const call = (body: unknown) => handler(new Request("http://localhost/f", { method: "POST", body: JSON.stringify(body) }));
  return { call, calls, sleeps };
}
const ok = () => new Response(JSON.stringify(DOC));

Deno.test("ohne Anmeldung 401, staff 403 - jeweils kein Lexoffice-Aufruf", async () => {
  for (const [s, expected] of [[setup([ok()], "admin", 401), 401], [setup([ok()], "staff"), 403]] as const) {
    const res = await s.call({ vouchers: [{ id: ID }] });
    assertEquals(res.status, expected);
    await res.body?.cancel();
    assertEquals(s.calls.length, 0);
  }
});

Deno.test("Positionen ohne Adresse, Texte, Beschreibungen; nur GET", async () => {
  const s = setup([ok()]);
  const text = await (await s.call({ vouchers: [{ id: ID }] })).text();
  for (const secret of ["Erika", "Musterweg", "example.org", "test-key"]) assert(!text.includes(secret), secret);
  const [r] = JSON.parse(text).results;
  assertEquals([r.voucherNumber, r.voucherDate, r.positions.length], ["RE-1", "2026-03-09", 1]);
  assertEquals(
    [r.positions[0].name, r.positions[0].quantity, r.positions[0].lineItemAmount, r.positions[0].taxRatePercentage],
    ["Lieferung", 1, 119, 19],
  );
  assertEquals(s.calls, [{ url: `https://api.lexware.io/v1/invoices/${ID}`, method: "GET" }]);
});

Deno.test("429 wartet Retry-After; 404 probiert andere Belegarten mit Abstand", async () => {
  const s = setup([new Response("", { status: 429, headers: { "Retry-After": "3" } }), new Response("", { status: 404 }), ok()]);
  const body = await (await s.call({ vouchers: [{ id: ID }] })).json();
  assertEquals(body.results[0].type, "downpayment");
  assertEquals(s.sleeps, [3000, REQUEST_SPACING_MS, REQUEST_SPACING_MS]);
  assert(REQUEST_SPACING_MS >= 500);
});

Deno.test("Fehlertext von Lexoffice wird nicht weitergereicht; 401 bricht ab", async () => {
  const a = await (await setup([new Response("Erika", { status: 400 })]).call({ vouchers: [{ id: ID }] })).json();
  assertEquals(a.results, [{ id: ID, ok: false, error: "Lexoffice-Fehler 400" }]);
  const s = setup([new Response("", { status: 401 })]);
  const res = await s.call({ vouchers: [{ id: ID }, { id: ID }] });
  assertEquals(res.status, 502);
  await res.body?.cancel();
  assertEquals(s.calls.length, 1);
});

Deno.test("Eingabeprüfung", () => {
  assertThrows(() => parseRequest({}));
  assertThrows(() => parseRequest({ vouchers: [{ id: "../contacts" }] }));
  assertThrows(() => parseRequest({ vouchers: [{ id: ID, type: "contacts" }] }));
  assertThrows(() => parseRequest({ vouchers: Array(MAX_IDS_PER_CALL + 1).fill({ id: ID }) }));
  assertEquals(parseRequest({ vouchers: [{ id: ID }] }), [{ id: ID, type: "invoice" }]);
});
