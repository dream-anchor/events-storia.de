import { useState, useEffect } from "react";
import { useList, useDelete } from "@refinedev/core";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Users, 
  Package,
  Percent,
  MapPin,
  Check,
  ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Determine dietary info for a single include item
const getDietaryInfo = (item: string): { hasMultiple: boolean; options: string[]; label: string | null } => {
  const lower = item.toLowerCase();
  
  // Food items that have all dietary options
  const hasAllOptions = ['vorspeisenplatte', 'hauptgang', 'fingerfood', 'pasta-station'].some(f => lower.includes(f));
  // Dessert only has Vegan and Vegetarisch
  const isDessert = lower.includes('dessert');
  // Drinks - no dietary options
  const isDrink = ['wein', 'cocktail', 'aperitivo', 'kaffee', 'wasser'].some(d => lower.includes(d));
  
  if (hasAllOptions) {
    return { hasMultiple: true, options: ['Vegan', 'Vegetarisch', 'Fisch', 'Fleisch'], label: 'Vegan bis Fleisch' };
  }
  
  if (isDessert) {
    return { hasMultiple: true, options: ['Vegan', 'Vegetarisch'], label: 'Vegan & Vegetarisch' };
  }
  
  if (isDrink) {
    return { hasMultiple: false, options: [], label: null };
  }
  
  return { hasMultiple: false, options: [], label: null };
};

// Get all unique dietary options for the entire package
const getPackageDietaryOptions = (includes: string[]): string[] => {
  const allOptions = new Set<string>();
  
  includes.forEach(item => {
    const info = getDietaryInfo(item);
    info.options.forEach(opt => allOptions.add(opt));
  });
  
  // Return in specific order
  const order = ['Vegan', 'Vegetarisch', 'Fisch', 'Fleisch'];
  return order.filter(opt => allOptions.has(opt));
};

interface PackageData {
  id: string;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  price: number;
  price_per_person: boolean;
  min_guests?: number;
  max_guests?: number;
  requires_prepayment: boolean;
  prepayment_percentage?: number;
  package_type: string;
  is_active: boolean;
  sort_order?: number;
  includes?: string[];
}

interface LocationData {
  id: string;
  name: string;
  name_en?: string;
  description?: string;
  capacity_seated?: number;
  capacity_standing?: number;
  features?: string[];
  is_active: boolean;
}

interface PackageLocationMapping {
  [packageId: string]: string[];
}

export const PackagesList = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"package" | "location">("package");
  const [activeTab, setActiveTab] = useState("packages");
  const [packageLocations, setPackageLocations] = useState<PackageLocationMapping>({});
  
  const { query: packagesQuery, result: packagesResult } = useList<PackageData>({
    resource: "packages",
    sorters: [{ field: "sort_order", order: "asc" }],
  });

  const { query: locationsQuery, result: locationsResult } = useList<LocationData>({
    resource: "locations",
    sorters: [{ field: "sort_order", order: "asc" }],
  });
  
  const { mutate: deleteRecord } = useDelete();

  const packages = packagesResult?.data || [];
  const locations = locationsResult?.data || [];

  // Fetch package-location mappings
  useEffect(() => {
    const fetchPackageLocations = async () => {
      const { data } = await supabase
        .from('package_locations')
        .select('package_id, location_id');
      
      if (data) {
        const mapping: PackageLocationMapping = {};
        data.forEach(pl => {
          if (!mapping[pl.package_id]) {
            mapping[pl.package_id] = [];
          }
          mapping[pl.package_id].push(pl.location_id);
        });
        setPackageLocations(mapping);
      }
    };
    
    fetchPackageLocations();
  }, [packagesResult]);

  const getLocationNames = (packageId: string) => {
    const locationIds = packageLocations[packageId] || [];
    return locations
      .filter(loc => locationIds.includes(loc.id))
      .map(loc => loc.name);
  };

  // Get packages for a location (reverse lookup)
  const getPackagesForLocation = (locationId: string) => {
    const pkgIds = Object.entries(packageLocations)
      .filter(([_, locIds]) => locIds.includes(locationId))
      .map(([pkgId]) => pkgId);
    return packages.filter(pkg => pkgIds.includes(pkg.id));
  };
  
  const filteredPackages = packages.filter(pkg => 
    pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pkg.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = () => {
    if (!deleteId) return;
    
    deleteRecord(
      { resource: deleteType === "package" ? "packages" : "locations", id: deleteId },
      {
        onSuccess: () => {
          toast.success(deleteType === "package" ? "Paket gelöscht" : "Location gelöscht");
          packagesQuery.refetch();
          locationsQuery.refetch();
          setDeleteId(null);
        },
        onError: () => {
          toast.error("Fehler beim Löschen");
        },
      }
    );
  };

  const formatPrice = (price: number, perPerson: boolean) => {
    const formatted = new Intl.NumberFormat('de-DE', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(price);
    return `${formatted} €${perPerson ? ' p.P.' : ''}`;
  };

  return (
    <AdminLayout activeTab="settings">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/settings?tab=pakete")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
          <h1 className="text-2xl font-bold tracking-tight">Pakete & Locations</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Event-Pakete und verfügbare Räumlichkeiten
          </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <TabsList className="h-12 p-1">
              <TabsTrigger value="packages" className="text-base px-6 h-10">
                <Package className="h-4 w-4 mr-2" />
                Pakete ({packages.length})
              </TabsTrigger>
              <TabsTrigger value="locations" className="text-base px-6 h-10">
                <MapPin className="h-4 w-4 mr-2" />
                Locations ({locations.length})
              </TabsTrigger>
            </TabsList>
            
            <Button 
              size="lg" 
              className="text-base"
              onClick={() => navigate(activeTab === "packages" ? "/admin/packages/create" : "/admin/locations/create")}
            >
              <Plus className="h-5 w-5 mr-2" />
              {activeTab === "packages" ? "Neues Paket" : "Neue Location"}
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-900 border-border/60 rounded-lg"
            />
          </div>

          {/* Packages Tab */}
          <TabsContent value="packages" className="space-y-6 mt-0">
            {packagesQuery.isLoading ? (
              <div className="grid gap-6 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="h-40 bg-muted" />
                  </Card>
                ))}
              </div>
            ) : filteredPackages.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Package className="h-16 w-16 text-muted-foreground/50 mb-6" />
                  <h3 className="text-xl font-semibold mb-2">Keine Pakete gefunden</h3>
                  <p className="text-muted-foreground text-base mb-6">
                    {searchTerm ? "Versuchen Sie eine andere Suche" : "Erstellen Sie Ihr erstes Paket"}
                  </p>
                  {!searchTerm && (
                    <Button size="lg" onClick={() => navigate("/admin/packages/create")}>
                      <Plus className="h-5 w-5 mr-2" />
                      Paket erstellen
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-3">
                {filteredPackages.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className={`group relative overflow-hidden transition-all rounded-xl border border-border/60 bg-white dark:bg-gray-900 hover:shadow-md hover:border-primary/40 flex flex-col ${!pkg.is_active ? 'opacity-60' : ''}`}
                  >
                    {/* Price Badge */}
                    <div className="absolute top-4 right-4 z-10">
                      <Badge className="text-base font-semibold px-3 py-1.5 bg-primary text-primary-foreground">
                        {pkg.price_per_person ? 'ab ' : ''}{formatPrice(pkg.price, pkg.price_per_person)}
                      </Badge>
                    </div>

                    <CardHeader className="pb-4">
                      <div className="space-y-3">
                        <CardTitle className="text-xl leading-tight pr-24">
                          {pkg.name}
                        </CardTitle>
                        {pkg.description && (
                          <p className="text-base text-muted-foreground leading-relaxed">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col">
                      <div className="space-y-5 flex-1">
                        {/* Includes */}
                        {pkg.includes && Array.isArray(pkg.includes) && pkg.includes.length > 0 && (
                          <ul className="space-y-2">
                            {pkg.includes.map((item, i) => {
                              const dietaryInfo = getDietaryInfo(item);
                              return (
                                <li key={i} className="flex items-start gap-2 text-base">
                                  <Check className="h-4 w-4 text-primary mt-1 shrink-0" />
                                  <span>
                                    {item}
                                    {dietaryInfo.label && (
                                      <span className="text-muted-foreground italic text-sm ml-1">
                                        ({dietaryInfo.label})
                                      </span>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {/* Locations */}
                        {getLocationNames(pkg.id).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {getLocationNames(pkg.id).map((locName, i) => (
                              <Badge key={i} variant="outline" className="text-sm px-3 py-1.5">
                                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                {locName}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Meta Badges */}
                        <div className="flex flex-wrap gap-2">
                          {pkg.min_guests && pkg.min_guests > 0 && (
                            <Badge variant="secondary" className="text-sm px-3 py-1.5">
                              <Users className="h-4 w-4 mr-2" />
                              Min. {pkg.min_guests} Personen
                            </Badge>
                          )}
                          {pkg.requires_prepayment && (
                            <Badge variant="outline" className="text-sm px-3 py-1.5 border-primary/30 text-primary">
                              <Percent className="h-4 w-4 mr-2" />
                              {pkg.prepayment_percentage || 100}% Vorauszahlung
                            </Badge>
                          )}
                        </div>

                        {/* Available Dietary Options for entire package */}
                        {pkg.includes && Array.isArray(pkg.includes) && getPackageDietaryOptions(pkg.includes).length > 0 && (
                          <div className="pt-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-2">Verfügbare Optionen:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {getPackageDietaryOptions(pkg.includes).map((option, i) => (
                                <Badge 
                                  key={i} 
                                  variant="outline" 
                                  className="text-xs px-2 py-0.5 border-muted-foreground/30 text-muted-foreground font-normal"
                                >
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Actions - always at bottom */}
                      <div className="flex gap-3 pt-5 mt-5 border-t">
                        <Button 
                          variant="default" 
                          size="lg"
                          className="flex-1 text-base"
                          onClick={() => navigate(`/admin/packages/${pkg.id}/edit`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Bearbeiten
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="lg"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDeleteType("package");
                            setDeleteId(pkg.id);
                          }}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-6 mt-0">
            {locationsQuery.isLoading ? (
              <div className="grid gap-6 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="h-32 bg-muted" />
                  </Card>
                ))}
              </div>
            ) : filteredLocations.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <MapPin className="h-16 w-16 text-muted-foreground/50 mb-6" />
                  <h3 className="text-xl font-semibold mb-2">Keine Locations gefunden</h3>
                  <p className="text-muted-foreground text-base mb-6">
                    {searchTerm ? "Versuchen Sie eine andere Suche" : "Erstellen Sie Ihre erste Location"}
                  </p>
                  {!searchTerm && (
                    <Button size="lg" onClick={() => navigate("/admin/locations/create")}>
                      <Plus className="h-5 w-5 mr-2" />
                      Location erstellen
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {filteredLocations.map((loc) => (
                  <Card
                    key={loc.id}
                    className={`group transition-all rounded-xl border border-border/60 bg-white dark:bg-gray-900 hover:shadow-md hover:border-primary/40 ${!loc.is_active ? 'opacity-60' : ''}`}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{loc.name}</CardTitle>
                          {loc.description && (
                            <p className="text-base text-muted-foreground">
                              {loc.description}
                            </p>
                          )}
                        </div>
                        <MapPin className="h-8 w-8 text-primary shrink-0" />
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-5">
                      {/* Capacity */}
                      <div className="flex flex-wrap gap-4">
                        {loc.capacity_seated && (
                          <div className="flex items-center gap-2 text-base">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{loc.capacity_seated}</span>
                            <span className="text-muted-foreground">Personen sitzend</span>
                          </div>
                        )}
                        {loc.capacity_standing && (
                          <div className="flex items-center gap-2 text-base">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{loc.capacity_standing}</span>
                            <span className="text-muted-foreground">Personen stehend</span>
                          </div>
                        )}
                      </div>

                      {/* Available Packages */}
                      {getPackagesForLocation(loc.id).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Beinhaltet:</p>
                          <div className="flex flex-wrap gap-2">
                            {getPackagesForLocation(loc.id).map((pkg) => (
                              <Badge key={pkg.id} variant="default" className="text-sm px-3 py-1.5">
                                <Package className="h-3.5 w-3.5 mr-1.5" />
                                {pkg.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Features */}
                      {loc.features && Array.isArray(loc.features) && loc.features.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {loc.features.map((feature, i) => (
                            <Badge key={i} variant="secondary" className="text-sm px-3 py-1">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* Actions */}
                      <div className="flex gap-3 pt-4 border-t">
                        <Button 
                          variant="default" 
                          size="lg"
                          className="flex-1 text-base"
                          onClick={() => navigate(`/admin/locations/${loc.id}/edit`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Bearbeiten
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="lg"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDeleteType("location");
                            setDeleteId(loc.id);
                          }}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              {deleteType === "package" ? "Paket" : "Location"} löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Möchten Sie {deleteType === "package" ? "dieses Paket" : "diese Location"} wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-base">Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground text-base"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};
