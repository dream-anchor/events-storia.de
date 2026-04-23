/**
 * Lightweight haptic feedback for touch devices.
 * Uses the Web Vibration API where available; silently no-ops otherwise.
 *
 * Use sparingly — reserve for confirmations of meaningful user actions
 * (Save, Send, Select, Add). Never for hover or scroll.
 */

type Pattern = "tick" | "select" | "success" | "warning" | "error";

const PATTERNS: Record<Pattern, number | number[]> = {
  tick: 8,
  select: 12,
  success: [10, 40, 10],
  warning: [20, 60, 20],
  error: [30, 80, 30, 80, 30],
};

export function haptic(pattern: Pattern = "tick"): void {
  if (typeof window === "undefined") return;
  const nav = window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  // Respect users with reduced motion preference.
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  } catch {
    /* ignore */
  }
  try {
    nav.vibrate(PATTERNS[pattern]);
  } catch {
    /* ignore */
  }
}