/** Einfacher In-Memory-Ratenbegrenzer je Edge-Instanz (best effort, schützt vor Kostenmissbrauch bei ORS/Stripe). */
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
