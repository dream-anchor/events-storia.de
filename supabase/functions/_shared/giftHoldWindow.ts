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

/** Sammel-Alarm (EINE Mail je Lauf), wenn der Bestand beim Eintritt ins Fenster bzw. bei "Bereit" nicht reichte
 *  (Hold wurde trotzdem gesetzt, keine Stornierung). Bewusst ohne Kundenname (nur Bestellnummer und Termin). */
export function stockConflictAlert(orders: { order_number: string; handover_date: string }[]): { subject: string; html: string } {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const list = orders.map((o) => `<li><b>${esc(o.order_number)}</b>, Abholung ${esc(o.handover_date)}</li>`).join("");
  return {
    subject: orders.length === 1
      ? `Bestand reicht nicht für Reservierung ${orders[0].order_number} (Abholung ${orders[0].handover_date})`
      : `Bestand reicht nicht für ${orders.length} Reservierungen`,
    html: `<p>Der Bestand reicht nicht für die bestätigte Menge folgender Vor-Ort-Reservierungen (Eintritt ins ${HOLD_WINDOW_DAYS}-Tage-Fenster ` +
      `bzw. Status "Bereit"). Der Bestand ist überbucht; die Reservierungen bleiben bestehen:</p><ul>${list}</ul>` +
      `<p>Bitte entscheiden: Korb nachpacken/Bestand erhöhen (der Hinweis verschwindet dann von selbst), Kunde umbuchen oder absagen (Admin, Geschenkkörbe).</p>`,
  };
}
