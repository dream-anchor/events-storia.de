import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { readJsonObject } from "./requestBody.ts";

const req = (body?: string) => new Request("http://localhost/", { method: "POST", ...(body !== undefined ? { body } : {}) });

Deno.test("readJsonObject: ohne Body => null", async () => {
  assertEquals(await readJsonObject(req()), null);
});

Deno.test("readJsonObject: leerer/whitespace Body => null", async () => {
  assertEquals(await readJsonObject(req("")), null);
  assertEquals(await readJsonObject(req("  \n")), null);
});

Deno.test("readJsonObject: ungültiges JSON => null", async () => {
  assertEquals(await readJsonObject(req("{nope")), null);
});

Deno.test("readJsonObject: kein Objekt => null", async () => {
  assertEquals(await readJsonObject(req("[]")), null);
  assertEquals(await readJsonObject(req("null")), null);
  assertEquals(await readJsonObject(req("42")), null);
  assertEquals(await readJsonObject(req('"x"')), null);
});

Deno.test("readJsonObject: Objekt => Objekt", async () => {
  assertEquals(await readJsonObject(req("{}")), {});
  assertEquals(await readJsonObject(req('{"items":[1]}')), { items: [1] });
});
