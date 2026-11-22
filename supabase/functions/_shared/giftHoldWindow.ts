/**
 * Bestands-Fenster bei "Zahlung vor Ort" (Z10, Inhaber 23.11.2026): Körbe sind beliebig weit im Voraus bestellbar, werden
 * aber erst kurz vorher gepackt. Eine bestätigte Vor-Ort-Reservierung belegt den Bestand deshalb erst ab
 * HOLD_WINDOW_DAYS Tagen vor der Abholung (Berliner Datum). Gegenstück in der DB: gift_hold_window_days(),
 * gift_confirm_reservation, gift_activate_deferred_holds (Migration 20261123100000). Online bezahlte Körbe sind nicht betroffen.
 */
import { addDays, berlinParts } from "./giftPricing.ts";

export const HOLD_WINDOW_DAYS = 2;

/** true = Abholtag liegt NACH (heute Berlin + 2 Tage): Bestand wird noch nicht belegt. */
export function isBeyondHoldWindow(handoverDate: string, now: Date): boolean {
  return handoverDate > addDays(berlinParts(now).date, HOLD_WINDOW_DAYS);
}

/** Betreiber-Alarm, wenn der Bestand beim Eintritt ins Fenster nicht reichte (Hold wurde trotzdem gesetzt, keine Stornierung). */
export function stockConflictAlert(o: { order_number: string; handover_date: string; customer_name: string }): { subject: string; html: string } {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  return {
    subject: `Bestand reicht nicht für Reservierung ${o.order_number} (Abholung ${o.handover_date})`,
    html: `<p>Die Vor-Ort-Reservierung <b>${esc(o.order_number)}</b> (${esc(o.customer_name)}, Abholung ${esc(o.handover_date)}) ist ins ` +
      `${HOLD_WINDOW_DAYS}-Tage-Fenster eingetreten, aber der Bestand reicht nicht für die bestätigte Menge. ` +
      `Der Bestand ist jetzt überbucht; die Reservierung bleibt bestehen.</p>` +
      `<p>Bitte entscheiden: Korb nachpacken/Bestand erhöhen, Kunde umbuchen oder absagen (Admin, Geschenkkörbe).</p>`,
  };
}
