/**
 * Liest den Request-Body als JSON-Objekt.
 * Leerer Body, ungültiges JSON oder kein Objekt (z. B. Array, Zahl, null) => null.
 * Aufrufer antworten dann mit 400, statt im allgemeinen catch mit 500 + kritischem Alarm zu landen
 * (Bots/Scanner rufen Functions oft ohne Body auf).
 */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (!text.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
