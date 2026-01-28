import { useMemo } from "react";
import { Calendar, Users, MapPin, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ExtendedInquiry, Package, SelectedPackage } from "./types";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

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
    firmenfeier: 'Firmenfeier',
    geburtstag: 'Geburtstagspakete',
    getraenke: 'Getränkepauschalen',
    general: 'Weitere Pakete',
  };

  const isPackageSelected = (pkgId: string) => 
    selectedPackages.some(sp => sp.id === pkgId);

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

      {/* Packages Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pauschalen & Pakete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(packagesByType).map(([type, pkgs]) => (
            <div key={type}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {packageTypeLabels[type] || type}
              </h4>
              <div className="space-y-2">
                {pkgs.map(pkg => {
                  const guestCount = parseInt(inquiry.guest_count || '0') || 1;
                  const totalPrice = pkg.price_per_person 
                    ? pkg.price * guestCount 
                    : pkg.price;

                  return (
                    <div
                      key={pkg.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isPackageSelected(pkg.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => onPackageToggle(pkg)}
                    >
                      <Checkbox 
                        checked={isPackageSelected(pkg.id)}
                        onCheckedChange={() => onPackageToggle(pkg)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{pkg.name}</p>
                        {pkg.description && (
                          <p className="text-sm text-muted-foreground">{pkg.description}</p>
                        )}
                        {pkg.min_guests && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Min. {pkg.min_guests} Gäste
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{pkg.price.toFixed(2)} €</p>
                        {pkg.price_per_person && (
                          <>
                            <p className="text-xs text-muted-foreground">pro Person</p>
                            <p className="text-sm font-medium text-primary">
                              = {totalPrice.toFixed(2)} €
                            </p>
                          </>
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
