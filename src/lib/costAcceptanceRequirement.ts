/**
 * Bestimmt, ob die digitale Kostenübernahme für ein Angebot Pflicht oder
 * optional ist.
 *
 * Logik:
 * Eine sofortige Stripe-Anzahlung (`deposit_method === 'stripe'`) gilt als
 * verbindlicher Vertragsschluss. Sobald keine sofortige Zahlung verlangt wird
 * (Anzahlung = none / on_site / invoice — egal welche Restzahlung folgt),
 * MUSS die Kostenübernahme vor dem Event unterschrieben sein, weil sonst kein
 * verbindlicher Vertrag zustande kommt.
 *
 * Diese Funktion ist absichtlich klein und reine Logik — sie wird sowohl im
 * Frontend (Public-Offer, Admin-Editor) als auch in Edge Functions verwendet.
 */
export type DepositMethod = "none" | "stripe" | "on_site" | "invoice";
export type BalanceMethod =
  | "stripe_prepay"
  | "on_site"
  | "invoice_before"
  | "invoice_after";

export interface CostAcceptanceRequirementInput {
  depositMethod: DepositMethod | null | undefined;
  balanceMethod: BalanceMethod | null | undefined;
}

export interface CostAcceptanceRequirement {
  /** True wenn die Kostenübernahme rechtlich nötig ist, um einen Vertrag zu schließen. */
  required: boolean;
  /** Kurzer DE-Grund für Admin-Hinweis und Banner. */
  reasonDe: string;
}

export function evaluateCostAcceptanceRequirement(
  input: CostAcceptanceRequirementInput,
): CostAcceptanceRequirement {
  const dep = (input.depositMethod ?? "none") as DepositMethod;
  if (dep === "stripe") {
    return {
      required: false,
      reasonDe:
        "Stripe-Anzahlung schließt den Vertrag automatisch — Kostenübernahme ist optional.",
    };
  }
  const bal = (input.balanceMethod ?? "stripe_prepay") as BalanceMethod;
  // Sonderfall: Anzahlung "none" + Restzahlung "stripe_prepay" (Link in Mail
  // vor Event). Die Zahlung erfolgt erst kurz vor dem Event — bis dahin gibt
  // es keinen verbindlichen Vertragsschluss. → Pflicht.
  if (dep === "none" && bal === "stripe_prepay") {
    return {
      required: true,
      reasonDe:
        "Zahlung erfolgt erst vor dem Event — Kostenübernahme ist verbindlich erforderlich.",
    };
  }
  return {
    required: true,
    reasonDe:
      "Ohne sofortige Online-Zahlung ist die Kostenübernahme der verbindliche Vertragsschluss.",
  };
}