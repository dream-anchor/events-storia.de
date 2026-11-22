import type { PickupHours } from "./pricing";

// Montag zuerst; Schlüssel wie in pickup_hours ("0" = Sonntag … "6" = Samstag)
const ORDER = ["1", "2", "3", "4", "5", "6", "0"];
const NAMES = {
  de: { "0": "So", "1": "Mo", "2": "Di", "3": "Mi", "4": "Do", "5": "Fr", "6": "Sa" },
  en: { "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat" },
} as const;

/** "09:00" -> "9:00" */
const time = (s: string) => s.replace(/^0(\d)/, "$1");

/** Öffnungszeiten für Abholung, aufeinanderfolgende Tage mit gleichen Zeiten zusammengefasst.
 *  Beispiel: ["Mo–Fr 9:00–1:00 Uhr", "Sa–So 12:00–1:00 Uhr"]. Geschlossene Tage entfallen. */
export function formatPickupHours(hours: PickupHours, lang: "de" | "en"): string[] {
  const groups: { from: string; to: string; span: string }[] = [];
  for (const day of ORDER) {
    const h = hours[day];
    if (!h) continue;
    const span = `${time(h.open)}–${time(h.close)}`;
    const last = groups[groups.length - 1];
    const prevDay = ORDER[ORDER.indexOf(day) - 1];
    if (last && last.span === span && last.to === prevDay) last.to = day;
    else groups.push({ from: day, to: day, span });
  }
  const names = NAMES[lang];
  const suffix = lang === "de" ? " Uhr" : "";
  return groups.map(
    (g) => `${names[g.from as keyof typeof names]}${g.from === g.to ? "" : `–${names[g.to as keyof typeof names]}`} ${g.span}${suffix}`,
  );
}
