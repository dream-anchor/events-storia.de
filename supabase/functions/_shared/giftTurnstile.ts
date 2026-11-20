/**
 * Cloudflare Turnstile serverseitig prüfen (Geschenkkorb, Zahlung "vor Ort").
 * Im Repo gab es bisher kein Turnstile; Secret: TURNSTILE_SECRET_KEY (Supabase-Secret), Site-Key im Frontend: VITE_TURNSTILE_SITE_KEY.
 * Ohne Secret schlägt die Prüfung fehl (fail closed) – Ausnahme: Testmodus (Stripe-Testschlüssel), damit Tests ohne Widget laufen.
 */
export type TurnstileResult = { ok: true } | { ok: false; code: "turnstile_failed" | "turnstile_not_configured" };

export async function verifyTurnstile(token: unknown, ip: string, secret: string | undefined, testMode: boolean): Promise<TurnstileResult> {
  if (!secret) return testMode ? { ok: true } : { ok: false, code: "turnstile_not_configured" };
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return { ok: false, code: "turnstile_failed" };
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") form.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { ok: false, code: "turnstile_failed" };
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? { ok: true } : { ok: false, code: "turnstile_failed" };
  } catch {
    return { ok: false, code: "turnstile_failed" };
  }
}

/** SHA-256 (hex) der Client-IP; die Roh-IP wird nicht gespeichert. Optionaler Pfeffer: GIFT_IP_PEPPER. */
export async function hashIp(ip: string, pepper = ""): Promise<string | null> {
  if (!ip || ip === "unknown") return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${pepper}|${ip}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
