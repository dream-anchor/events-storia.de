import { useCallback, useEffect, useState } from "react";
import type { CartLine } from "@/lib/gift/types";
import { MAX_QTY_PER_LINE } from "@/lib/gift/pricing";

const KEY = "storia-gift-cart";

function load(): CartLine[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed)
      ? parsed.filter((l) => typeof l?.variantId === "string" && Number.isInteger(l?.qty) && l.qty >= 1 && l.qty <= MAX_QTY_PER_LINE)
      : [];
  } catch {
    return [];
  }
}

/** Eigener Mini-Warenkorb (sessionStorage), bewusst NICHT der Catering-CartContext (keine Misch-Regeln). */
export function useGiftCart() {
  const [lines, setLines] = useState<CartLine[]>(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* privater Modus: Warenkorb nur im Speicher */
    }
  }, [lines]);

  const add = useCallback((variantId: string, qty: number) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variantId);
      if (existing) return prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(l.qty + qty, MAX_QTY_PER_LINE) } : l));
      return [...prev, { variantId, qty: Math.min(qty, MAX_QTY_PER_LINE) }];
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.variantId !== variantId) : prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(qty, MAX_QTY_PER_LINE) } : l)),
    );
  }, []);

  const replace = useCallback((next: CartLine[]) => setLines(next), []);
  const clear = useCallback(() => setLines([]), []);

  return { lines, add, setQty, replace, clear };
}
