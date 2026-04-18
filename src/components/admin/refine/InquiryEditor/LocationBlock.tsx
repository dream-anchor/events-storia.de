import { useEffect, useState } from "react";
import { MapPin, Building, Building2, ExternalLink, Info } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ExtendedInquiry, LocationType } from "./types";
import {
  BusinessData,
  resolveLocationAddress,
  buildMapsUrl,
  formatAddressLines,
} from "@/lib/addressResolver";
import { NominatimAutocomplete } from "./NominatimAutocomplete";

interface Props {
  inquiry: ExtendedInquiry;
  onFieldChange: (field: keyof ExtendedInquiry, value: unknown) => void;
  isReadOnly?: boolean;
}

export const LocationBlock = ({ inquiry, onFieldChange, isReadOnly = false }: Props) => {
  const [businessData, setBusinessData] = useState<BusinessData | null>(null);
  const locationType = (inquiry.location_type || 'storia') as LocationType;

  // Load Storia business address from site_settings (cached after first load)
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'business_data')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setBusinessData(data.value as BusinessData);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedAddr = resolveLocationAddress(inquiry, businessData);
  const mapsUrl = buildMapsUrl(resolvedAddr);
  const addrLines = formatAddressLines(resolvedAddr);

  const handleTypeChange = (val: string) => {
    if (!val || isReadOnly) return;
    onFieldChange('location_type', val as LocationType);
  };

  const companyAddrIncomplete =
    locationType === 'company' &&
    !inquiry.company_street && !inquiry.company_city;

  return (
    <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          Veranstaltungsort
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Toggle */}
        <ToggleGroup
          type="single"
          value={locationType}
          onValueChange={handleTypeChange}
          disabled={isReadOnly}
          aria-label="Veranstaltungsort"
          className="justify-start gap-2 flex-wrap"
        >
          <ToggleGroupItem
            value="storia"
            aria-label="Ristorante Storia"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border/60 rounded-lg h-10 px-4"
          >
            <Building className="h-4 w-4 mr-2" />
            Ristorante Storia
          </ToggleGroupItem>
          <ToggleGroupItem
            value="company"
            aria-label="Firmenadresse"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border/60 rounded-lg h-10 px-4"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Firmenadresse
          </ToggleGroupItem>
          <ToggleGroupItem
            value="custom"
            aria-label="Andere Adresse"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border/60 rounded-lg h-10 px-4"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Andere Adresse
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Storia / Company → Address Card (read-only) */}
        {locationType !== 'custom' && (
          <div className="rounded-lg border border-border/60 bg-muted/20 dark:bg-gray-800/40 p-4 transition-all duration-200">
            {companyAddrIncomplete ? (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-900 dark:text-amber-200">
                  Bitte Firmenadresse unten im Block <strong>„Kontakt & Firma"</strong> ergänzen.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {locationType === 'storia' ? (
                    <Building className="h-5 w-5 text-primary" />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {addrLines.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        "text-sm leading-relaxed",
                        i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="shrink-0 h-8"
                >
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    In Maps öffnen
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Custom → editable fields */}
        {locationType === 'custom' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Name (optional)
              </Label>
              <Input
                type="text"
                value={inquiry.location_name || ''}
                onChange={(e) => onFieldChange('location_name', e.target.value || null)}
                disabled={isReadOnly}
                placeholder="z.B. Hotel Bayerischer Hof"
                className="h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Straße</Label>
              <NominatimAutocomplete
                value={inquiry.location_street || ''}
                onChange={(val) => onFieldChange('location_street', val || null)}
                onSelect={(r) => {
                  onFieldChange('location_street', r.street || null);
                  onFieldChange('location_postal_code', r.postalCode || null);
                  onFieldChange('location_city', r.city || null);
                  onFieldChange('location_country', r.country || 'Deutschland');
                }}
                placeholder="Straße und Hausnummer"
                disabled={isReadOnly}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">PLZ</Label>
                <Input
                  type="text"
                  value={inquiry.location_postal_code || ''}
                  onChange={(e) => onFieldChange('location_postal_code', e.target.value || null)}
                  disabled={isReadOnly}
                  placeholder="80333"
                  className="h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-sm font-medium text-muted-foreground">Stadt</Label>
                <Input
                  type="text"
                  value={inquiry.location_city || ''}
                  onChange={(e) => onFieldChange('location_city', e.target.value || null)}
                  disabled={isReadOnly}
                  placeholder="München"
                  className="h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Land</Label>
              <Input
                type="text"
                value={inquiry.location_country || 'Deutschland'}
                onChange={(e) => onFieldChange('location_country', e.target.value || 'Deutschland')}
                disabled={isReadOnly}
                className="h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
              />
            </div>
            {(inquiry.location_street || inquiry.location_city) && (
              <Button variant="outline" size="sm" asChild className="h-9">
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  In Maps öffnen
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
