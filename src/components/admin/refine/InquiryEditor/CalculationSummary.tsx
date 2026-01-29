import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, AlertTriangle } from "lucide-react";
import { QuoteItem, SelectedPackage } from "./types";

interface CalculationSummaryProps {
  quoteItems: QuoteItem[];
  selectedPackages: SelectedPackage[];
  guestCount: number;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const CalculationSummary = ({
  quoteItems,
  selectedPackages,
  guestCount,
  notes,
  onNotesChange,
}: CalculationSummaryProps) => {
  // Calculate totals
  const itemsSubtotal = useMemo(() => 
    quoteItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    [quoteItems]
  );

  const packagesSubtotal = useMemo(() => 
    selectedPackages.reduce((sum, pkg) => {
      const price = pkg.pricePerPerson ? pkg.price * guestCount : pkg.price;
      return sum + (price * pkg.quantity);
    }, 0),
    [selectedPackages, guestCount]
  );

  const subtotal = itemsSubtotal + packagesSubtotal;
  const vat = subtotal * 0.07; // 7% food VAT
  const total = subtotal + vat;

  // Check if prepayment required
  const requiresPrepayment = useMemo(() => 
    selectedPackages.some(pkg => pkg.requiresPrepayment),
    [selectedPackages]
  );

  // Check for min guests warnings
  const minGuestsWarnings = useMemo(() => 
    selectedPackages.filter(pkg => 
      pkg.minGuests && pkg.minGuests > 0 && guestCount < pkg.minGuests
    ),
    [selectedPackages, guestCount]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Kalkulation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Min Guests Warnings */}
        {minGuestsWarnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Achtung:</strong>
              {minGuestsWarnings.map(pkg => (
                <div key={pkg.id} className="text-sm mt-1">
                  "{pkg.name}" erfordert mind. {pkg.minGuests} Gäste (aktuell: {guestCount})
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Items */}
        {quoteItems.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Einzelpositionen
            </Label>
            <div className="mt-2 space-y-1">
              {quoteItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-medium">
                    {(item.price * item.quantity).toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Packages */}
        {selectedPackages.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Pakete & Pauschalen
            </Label>
            <div className="mt-2 space-y-1">
              {selectedPackages.map(pkg => {
                const price = pkg.pricePerPerson ? pkg.price * guestCount : pkg.price;
                return (
                  <div key={pkg.id} className="flex justify-between text-sm">
                    <span>
                      {pkg.name}
                      {pkg.pricePerPerson && (
                        <span className="text-muted-foreground ml-1">
                          ({guestCount} Pers.)
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {(price * pkg.quantity).toFixed(2)} €
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="pt-2">
          <Separator className="mb-3" />
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Zwischensumme (netto)</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">MwSt. 7%</span>
              <span>{vat.toFixed(2)} €</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Gesamt (brutto)</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Prepayment Notice */}
        {requiresPrepayment && (
          <div className="pt-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CreditCard className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm">
                <strong>100% Vorauszahlung</strong> für gewählte Pakete erforderlich
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="pt-4">
          <Label htmlFor="calc-notes">Interne Notizen</Label>
          <Textarea
            id="calc-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Interne Anmerkungen zum Angebot..."
            className="mt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
};
