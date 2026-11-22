// Bestell-/Buchungsnummer des Checkouts: PRÄFIX-TT-MM-JJJJ-NNNNNN.
// Der Suffix ist ein kryptografisch zufälliger 6-stelliger Wert (100000–999999). Früher Sekunden % 1000 + 100:
// wiederholte sich alle ~16 Minuten und kollidierte an der UNIQUE-Constraint von catering_orders.order_number.
// Alte Nummern mit 3–4 Ziffern bleiben gültig (siehe supabase/functions/_shared/giftMixed.ts).

/** Gleichverteilte Zufallszahl in [min, max] ohne Modulo-Verzerrung (Rejection Sampling). */
export function secureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const limit = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return min + (buf[0] % range);
}

export function generateOrderNumber(isEvent: boolean = false, date: Date = new Date()): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const prefix = isEvent ? 'EVT-BUCHUNG' : 'CAT-BESTELLUNG';
  return `${prefix}-${day}-${month}-${year}-${secureRandomInt(100000, 999999)}`;
}
