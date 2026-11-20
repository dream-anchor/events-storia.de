/** Routing-Helfer für handle-stripe-webhook: erkennt Geschenkkorb-Sessions (rein, testbar). */
export function isGiftSessionMetadata(md: Record<string, string> | null | undefined): boolean {
  return md?.order_type === "gift_basket" && typeof md?.gift_order_id === "string" && md.gift_order_id.length > 0;
}
