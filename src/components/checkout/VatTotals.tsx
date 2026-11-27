import { cn } from "@/lib/utils";
import { formatEuroTruncated, formatMixedTotal } from "@/lib/gift/mixedCart";
import { splitNetCents, formatCents } from "@/lib/netDisplay";

// Rechenhelfer liegen in src/lib/netDisplay.ts (ohne React testbar); hier weiterhin exportiert.
export { toCents, splitNetCents, lineNetCents, subtotalNetCents, formatCents } from "@/lib/netDisplay";

interface VatTotalsProps {
  language: "de" | "en";
  /** true = Brutto-Anzeige, false = Netto-Umschalter aktiv */
  showGross: boolean;
  /** Catering-Betrag BRUTTO = Zahlbetrag (Server-Angebot); der Stripe-Betrag ändert sich durch die Anzeige nie */
  grandTotal: number;
  /** Mischbestellung: Korb-Anteil (brutto); 0 = reine Catering-Bestellung */
  giftSubtotal?: number;
  /** Echte Steuerbeträge (Brutto minus Netto), NICHT durch den Netto-Umschalter umgerechnet */
  vat7Food: number;
  vat19Drinks: number;
  vat19Delivery: number;
  /** 19-%-Steuer der Chafing-Dish-Leihgeräte (fehlt = 0) */
  vat19Rental?: number;
  /** Lieferung läuft zu 7 % (reine Speisenlieferung) und steckt in vat7Food: nur für die Beschriftung */
  deliveryAt7?: boolean;
  /** Darstellung: "sticky" = Seitenleiste (Serif, groß), "inline" = mobile Zusammenfassung */
  variant: "sticky" | "inline";
}

/** Beschriftung der 19-%-Zeile nach tatsächlicher Zusammensetzung (Getränke-Anteil der Pakete, Chafing-Leihgerät, Lieferung). */
function vat19Scope(drinks: number, delivery: number, rental: number, language: "de" | "en"): string {
  const de = language === "de";
  const parts = [
    drinks > 0 ? (de ? "Getränke" : "drinks") : null,
    rental > 0 ? (de ? "Leihgerät" : "rental") : null,
    delivery > 0 ? (de ? "Lieferung" : "delivery") : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return de ? "Lieferung" : "delivery";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;
}

/**
 * MwSt.-Zeilen und Endbetrag des Checkouts.
 * Brutto-Modus: "inkl. X % MwSt." und "Gesamt".
 * Netto-Modus: Netto-Summe, "zzgl. X % MwSt." mit dem echten Steuerbetrag und als Endbetrag der Brutto-Zahlbetrag, eindeutig beschriftet.
 */
export function VatTotals({ language, showGross, grandTotal, giftSubtotal = 0, vat7Food, vat19Drinks, vat19Delivery, vat19Rental = 0, deliveryAt7 = false, variant }: VatTotalsProps) {
  const de = language === "de";
  // Steuerbeträge auf den Cent GERUNDET und die Netto-Summe als Rest (Brutto minus Steuer), damit Netto + MwSt. immer genau den Zahlbetrag ergeben
  const euro = formatCents;
  const { vat7C, vat19C, netC } = splitNetCents(grandTotal, vat7Food, vat19Drinks, vat19Delivery, vat19Rental);
  const hasGifts = giftSubtotal > 0;
  const vatWord = showGross ? (de ? "inkl." : "incl.") : (de ? "zzgl." : "plus");
  const sticky = variant === "sticky";

  const totalLabel = showGross
    ? `${de ? "Gesamt" : "Total"}${hasGifts ? (de ? " inkl. MwSt." : " incl. VAT") : ""}`
    : hasGifts
      ? (de ? "Gesamt inkl. MwSt." : "Total incl. VAT")
      : (de ? "Gesamtbetrag brutto (Zahlbetrag)" : "Total gross (amount to pay)");
  const totalValue = hasGifts ? formatMixedTotal(grandTotal, giftSubtotal) : formatEuroTruncated(grandTotal);

  return (
    <>
      <div className="text-xs text-muted-foreground pt-2 border-t border-border/50 space-y-1">
        {!showGross && (
          <div className="flex justify-between">
            <span>{hasGifts ? (de ? "Catering netto" : "Catering net") : (de ? "Gesamt netto" : "Total net")}</span>
            <span>{euro(netC)}</span>
          </div>
        )}
        {vat7C > 0 && (
          <div className="flex justify-between">
            <span>{vatWord} 7% {de ? `MwSt. (Speisen${deliveryAt7 ? " & Lieferung" : ""})` : `VAT (food${deliveryAt7 ? " & delivery" : ""})`}</span>
            <span>{euro(vat7C)}</span>
          </div>
        )}
        {vat19C > 0 && (
          <div className="flex justify-between">
            <span>{vatWord} 19% {de ? "MwSt." : "VAT"} ({vat19Scope(vat19Drinks, vat19Delivery, vat19Rental, language)})</span>
            <span>{euro(vat19C)}</span>
          </div>
        )}
      </div>
      {sticky ? (
        <div className="flex justify-between items-center pt-3 border-t border-border">
          <span className="font-serif text-lg font-semibold">{totalLabel}</span>
          <span className="font-serif text-xl font-bold text-amber-950 dark:text-amber-50 whitespace-nowrap shrink-0">{totalValue}</span>
        </div>
      ) : (
        <div className={cn("flex justify-between pt-2 border-t border-border font-medium")}>
          <span>{totalLabel}</span>
          <span className="text-primary font-bold whitespace-nowrap shrink-0 pl-3">{totalValue}</span>
        </div>
      )}
    </>
  );
}
