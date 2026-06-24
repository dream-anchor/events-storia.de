/**
 * Zentrale Test-/Intern-Erkennung — Single Source of Truth.
 *
 * Eine Anfrage gilt als Test, wenn sie nicht von einem echten Kunden stammt,
 * sondern von einem der Betreiber selbst (Speranza GmbH / Dream & Anchor /
 * Monot Media) zum Ausprobieren des Systems angelegt wurde.
 *
 * Erkennung über drei Signale:
 *   1. das gesetzte `is_test`-Flag,
 *   2. eine bekannte interne E-Mail-Adresse,
 *   3. ein interner Name/Firmenname (Speranza, Mimmo, Antoine, …).
 *
 * Wird sowohl von der Conversion-Auswertung als auch von der Diagnose
 * genutzt, damit beide Ansichten exakt dieselben Zahlen zeigen.
 */

/** Bekannte interne E-Mail-Adressen (Betreiber + Mitarbeiter + Test-Redirect). */
export const INTERNAL_TEST_EMAILS: ReadonlySet<string> = new Set([
  "monot@hey.com",
  "antoine@monot.com",
  "mimmo2905@yahoo.de",
  "nicola@storia.de",
  "madi@events-storia.de",
  "madina.khader@gmail.com",
  "info@storia.de",
  "info@events-storia.de",
]);

/**
 * Hochspezifische interne Marken-/Firmennamen — als GANZES Wort gematcht
 * (nicht als Teilstring), damit keine echten Kunden mit ähnlichen Wörtern
 * getroffen werden.
 */
export const INTERNAL_TEST_WORD_TOKENS: readonly string[] = [
  "speranza", // Betreibergesellschaft (Speranza GmbH)
  "monot", // Inhaber-Marke
  "mimmo", // interner Spitzname von Domenico
  "dreamanchor",
];

/**
 * Mehrteilige interne Namen/Firmen — spezifisch genug für Teilstring-Match.
 * Generische Einzel-Vornamen (Domenico, Nicola, Antoine, …) bewusst NICHT
 * allein, sonst würden echte Kunden mit diesen Namen herausgefiltert.
 */
export const INTERNAL_TEST_FULL_NAMES: readonly string[] = [
  "domenico speranza",
  "nicola speranza",
  "antoine monot",
  "agnese lettieri",
  "madina khader",
  "monot media",
  "dream and anchor",
];

/** Kleinschreibung, & → "and", Sonderzeichen raus, Mehrfach-Leerzeichen weg. */
function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface TestCheckInput {
  is_test?: boolean | null;
  name?: string | null;
  company?: string | null;
  email?: string | null;
}

/** Kern-Prüfung: Ist dieser Datensatz intern/Test? */
export function isInternalTestRecord(input: TestCheckInput): boolean {
  if (input.is_test === true) return true;

  const email = input.email?.toLowerCase().trim();
  if (email && INTERNAL_TEST_EMAILS.has(email)) return true;

  const haystack = `${normalize(input.name)} ${normalize(input.company)}`.trim();
  if (!haystack) return false;

  // Mehrteilige Namen/Firmen: Teilstring (spezifisch genug).
  if (INTERNAL_TEST_FULL_NAMES.some((n) => haystack.includes(n))) return true;

  // Einzel-Tokens nur als ganzes Wort — kein Treffer mitten in einem Wort.
  const words = new Set(haystack.split(" "));
  return INTERNAL_TEST_WORD_TOKENS.some((t) => words.has(t));
}

/**
 * Komfort-Wrapper für eine `v2_events`-Zeile mit gejointem `v2_customers`.
 */
export function isTestEventRow(row: {
  is_test?: boolean | null;
  v2_customers?: { name?: string | null; company?: string | null; email?: string | null } | null;
}): boolean {
  return isInternalTestRecord({
    is_test: row.is_test ?? null,
    name: row.v2_customers?.name ?? null,
    company: row.v2_customers?.company ?? null,
    email: row.v2_customers?.email ?? null,
  });
}
