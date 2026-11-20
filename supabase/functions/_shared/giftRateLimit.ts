/** Einfacher In-Memory-Ratenbegrenzer je Edge-Instanz (best effort, schützt vor Kostenmissbrauch bei ORS/Stripe). */
const hits = new Map<string, number[]>();

/**
 * Client-IP robust ermitteln. Supabase-Edge-Functions laufen hinter Cloudflare und Supabase-Gateway; der Client kann
 * `X-Forwarded-For` selbst vorbelegen (Einträge davor sind frei erfunden). Reihenfolge deshalb:
 *  1. `cf-connecting-ip` – setzt Cloudflare selbst und überschreibt Client-Angaben (vertrauenswürdig),
 *  2. `x-real-ip` – setzt das Gateway,
 *  3. LETZTER Eintrag von `x-forwarded-for` – hängt der nächstgelegene vertrauenswürdige Proxy an; der erste Eintrag
 *     (client-kontrolliert) wird bewusst NICHT genommen.
 * Gibt es nichts davon, "unknown" (dann gelten IP-Grenzen nicht, nur die je E-Mail).
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const single = (v: string | null) => (v ?? "").trim();
  const cf = single(h.get("cf-connecting-ip"));
  if (cf) return cf;
  const real = single(h.get("x-real-ip"));
  if (real) return real;
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "unknown";
}

/** SHA-256 (hex) der Client-IP; die Roh-IP wird nicht gespeichert. Optionaler Pfeffer: GIFT_IP_PEPPER. */
export async function hashIp(ip: string, pepper = ""): Promise<string | null> {
  if (!ip || ip === "unknown") return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${pepper}|${ip}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
