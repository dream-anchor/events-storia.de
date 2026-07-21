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
  /**
   * Expliziter Admin-Schalter auf der Anfrage. Nur wenn true, ist die
   * Kostenübernahme aktiv angefordert und dem Kunden im Public-Offer
   * sichtbar. Zahlungswahl hat KEINEN Einfluss mehr auf diese Anforderung.
   */
  requested?: boolean | null;
  /** Behalten für Rückwärtskompatibilität — wird nicht mehr für Ableitung genutzt. */
  depositMethod: DepositMethod | null | undefined;
  /** Behalten für Rückwärtskompatibilität — wird nicht mehr für Ableitung genutzt. */
  balanceMethod: BalanceMethod | null | undefined;
}

export interface CostAcceptanceRequirement {
  /** True wenn Admin die Kostenübernahme aktiv angefordert hat. */
  required: boolean;
  /** Kurzer DE-Grund für Admin-Hinweis und Banner. */
  reasonDe: string;
}

export function evaluateCostAcceptanceRequirement(
  input: CostAcceptanceRequirementInput,
): CostAcceptanceRequirement {
  // Kostenübernahme ist eine eigenständige Admin-Aktion, unabhängig
  // von jeder Zahlungswahl. Sie ist genau dann aktiv, wenn der Admin sie
  // explizit angefordert hat.
  if (input.requested === true) {
    return {
      required: true,
      reasonDe:
        "Kostenübernahme wurde angefordert und ist für den Kunden im Angebot sichtbar.",
    };
  }
  return {
    required: false,
    reasonDe:
      "Kostenübernahme ist nicht angefordert. Zahlungsart bleibt davon unabhängig.",
  };
}