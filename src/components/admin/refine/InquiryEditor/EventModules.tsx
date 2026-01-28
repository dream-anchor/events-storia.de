import { useMemo } from "react";
import { Calendar, Users, MapPin, AlertTriangle, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExtendedInquiry, Package, SelectedPackage } from "./types";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EventModulesProps {
  inquiry: ExtendedInquiry;
  packages: Package[];
  selectedPackages: SelectedPackage[];
  onPackageToggle: (pkg: Package) => void;
  onRoomChange: (room: string) => void;
  onTimeSlotChange: (slot: string) => void;
  onGuestCountChange: (count: string) => void;
}

const ROOMS = [
  { id: 'terrazza', name: 'Terrazza', capacity: '20-40 Gäste', description: 'Sonnige Terrasse mit Blick auf den Garten' },
  { id: 'sala-grande', name: 'Sala Grande', capacity: '40-80 Gäste', description: 'Großer Saal für Feiern' },
  { id: 'privato', name: 'Separée Privato', capacity: '10-20 Gäste', description: 'Intimer Raum für kleine Gruppen' },
  { id: 'ristorante', name: 'Gesamtes Restaurant', capacity: '80-120 Gäste', description: 'Exklusiv-Buchung' },
];

const TIME_SLOTS = [
  { id: 'lunch', label: 'Mittag (11:30-14:30)' },
  { id: 'afternoon', label: 'Nachmittag (14:30-18:00)' },
  { id: 'dinner', label: 'Abend (18:00-22:00)' },
  { id: 'evening', label: 'Spätabend (ab 22:00)' },
];

export const EventModules = ({
  inquiry,
  packages,
  selectedPackages,
  onPackageToggle,
  onRoomChange,
  onTimeSlotChange,
  onGuestCountChange,
}: EventModulesProps) => {
  const guestCount = parseInt(inquiry.guest_count || '0') || 0;

  // Group packages by type
  const packagesByType = useMemo(() => {
    const grouped: Record<string, Package[]> = {};
    packages.forEach(pkg => {
      if (!grouped[pkg.package_type]) {
        grouped[pkg.package_type] = [];
      }
      grouped[pkg.package_type].push(pkg);
    });
    return grouped;
  }, [packages]);

  const packageTypeLabels: Record<string, string> = {
    hochzeit: 'Hochzeitspakete',
    firmenfeier: 'Firmenfeier & Events',
    geburtstag: 'Geburtstagspakete',
    getraenke: 'Getränkepauschalen',
    general: 'Weitere Pakete',
  };

  const isPackageSelected = (pkgId: string) => 
    selectedPackages.some(sp => sp.id === pkgId);

  // Check if any selected package requires prepayment
  const requiresPrepayment = useMemo(() => {
    return selectedPackages.some(sp => sp.requiresPrepayment);
  }, [selectedPackages]);

  // Handle package selection with min guests validation
  const handlePackageClick = (pkg: Package) => {
    const minGuests = pkg.min_guests || 0;
    
    // If selecting (not unselecting) and min guests not met, show warning
    if (!isPackageSelected(pkg.id) && minGuests > 0 && guestCount < minGuests) {
      toast.warning(`Mindestteilnehmerzahl für "${pkg.name}": ${minGuests} Personen`, {
        description: `Aktuell: ${guestCount || 0} Gäste angegeben`,
        duration: 5000,
      });
    }
    
    onPackageToggle(pkg);
  };

  return (
    <div className="space-y-6">
      {/* Event Info Header */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                {inquiry.preferred_date 
                  ? format(parseISO(inquiry.preferred_date), "dd.MM.yyyy", { locale: de })
                  : 'Kein Datum'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>{inquiry.guest_count || '?'} Gäste</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{inquiry.event_type || 'Event'}</span>
            </div>
            <div>
              <Badge variant="outline">{inquiry.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room & Time Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Raumauswahl</Label>
          <Select value={inquiry.room_selection || ''} onValueChange={onRoomChange}>
            <SelectTrigger>
              <SelectValue placeholder="Raum wählen..." />
            </SelectTrigger>
            <SelectContent>
              {ROOMS.map(room => (
                <SelectItem key={room.id} value={room.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{room.name}</span>
                    <span className="text-xs text-muted-foreground">{room.capacity}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Zeitfenster</Label>
          <Select value={inquiry.time_slot || ''} onValueChange={onTimeSlotChange}>
            <SelectTrigger>
              <SelectValue placeholder="Zeit wählen..." />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map(slot => (
                <SelectItem key={slot.id} value={slot.id}>
                  {slot.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Personenanzahl</Label>
          <Input
            type="number"
            value={inquiry.guest_count || ''}
            onChange={(e) => onGuestCountChange(e.target.value)}
            placeholder="Anzahl Gäste"
          />
        </div>
      </div>

      {/* Prepayment Notice */}
      {requiresPrepayment && (
        <Alert className="border-amber-500/50 bg-amber-50">
          <CreditCard className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Vorauszahlung erforderlich:</strong> Für dieses Event ist eine Vorauszahlung von 100% erforderlich.
          </AlertDescription>
        </Alert>
      )}

      {/* Packages Selection - Selectable Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pakete & Pauschalen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(packagesByType).map(([type, pkgs]) => (
            <div key={type}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {packageTypeLabels[type] || type}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pkgs.map(pkg => {
                  const selected = isPackageSelected(pkg.id);
                  const totalPrice = pkg.price_per_person 
                    ? pkg.price * (guestCount || 1)
                    : pkg.price;
                  const minGuestsNotMet = pkg.min_guests && pkg.min_guests > 0 && guestCount < pkg.min_guests;

                  return (
                    <div
                      key={pkg.id}
                      onClick={() => handlePackageClick(pkg)}
                      className={cn(
                        "relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",
                        "hover:shadow-md hover:border-primary/50",
                        selected 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border bg-card",
                        minGuestsNotMet && selected && "border-amber-500 bg-amber-50/50"
                      )}
                    >
                      {/* Selection indicator */}
                      {selected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}

                      {/* Package Content */}
                      <div className="space-y-3">
                        {/* Title */}
                        <h3 className="font-semibold text-base pr-6">{pkg.name}</h3>

                        {/* Price - prominent */}
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-primary">
                            {pkg.price.toFixed(0)} €
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {pkg.price_per_person ? 'pro Person' : 'Pauschal'}
                          </span>
                        </div>

                        {/* Calculated total for per-person */}
                        {pkg.price_per_person && guestCount > 0 && (
                          <div className="text-sm font-medium text-foreground/80">
                            = {totalPrice.toFixed(2)} € für {guestCount} Gäste
                          </div>
                        )}

                        {/* Description */}
                        {pkg.description && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {pkg.description}
                          </p>
                        )}

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {pkg.min_guests && pkg.min_guests > 0 && (
                            <Badge 
                              variant={minGuestsNotMet ? "destructive" : "secondary"} 
                              className="text-xs"
                            >
                              Min. {pkg.min_guests} Pers.
                            </Badge>
                          )}
                          {pkg.requires_prepayment && (
                            <Badge variant="outline" className="text-xs">
                              <CreditCard className="h-3 w-3 mr-1" />
                              100% Anzahlung
                            </Badge>
                          )}
                        </div>

                        {/* Warning if min guests not met */}
                        {minGuestsNotMet && selected && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-2">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Personenzahl unter Minimum</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          {packages.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              Keine Pakete verfügbar
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
