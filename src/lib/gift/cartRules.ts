// Reine Regeln für Geschenkkorb-Zeilen im gemeinsamen Warenkorb (CartContext). Keine React-Abhängigkeit,
// damit per Deno testbar (supabase/tests/giftCartRules_test.ts). Maßgeblich bleibt der Server (create-gift-order).
import { MAX_QTY_PER_LINE, MAX_QTY_PER_ORDER } from "./pricing";

export interface CartLineLike {
  id: string;
  kind?: "gift_basket";
  quantity: number;
}

export const GIFT_ID_PREFIX = "gift-";
export const giftItemId = (variantId: string): string => `${GIFT_ID_PREFIX}${variantId}`;
export const isGiftItem = (i: { id: string; kind?: string }): boolean => i.kind === "gift_basket";

/** Summe aller Korb-Stückzahlen im Warenkorb. */
export const giftQuantityTotal = (items: CartLineLike[]): number =>
  items.reduce((s, i) => (isGiftItem(i) ? s + i.quantity : s), 0);

/** Höchstmenge für eine Korb-Zeile: je Zeile MAX_QTY_PER_LINE, je Bestellung MAX_QTY_PER_ORDER über alle Körbe. */
export function giftMaxForLine(items: CartLineLike[], id: string): number {
  const others = items.reduce((s, i) => (isGiftItem(i) && i.id !== id ? s + i.quantity : s), 0);
  return Math.max(0, Math.min(MAX_QTY_PER_LINE, MAX_QTY_PER_ORDER - others));
}

/** Neue Menge einer Korb-Zeile. mode "add" addiert zur bestehenden Menge, "set" setzt sie (Deep-Links). */
export function nextGiftQuantity(
  items: CartLineLike[],
  id: string,
  requested: number,
  mode: "add" | "set",
): { quantity: number; capped: boolean } {
  const existing = items.find((i) => i.id === id)?.quantity ?? 0;
  const wanted = Math.max(0, mode === "set" ? requested : existing + requested);
  const max = giftMaxForLine(items, id);
  const quantity = Math.min(wanted, max);
  return { quantity, capped: quantity < wanted };
}
