import { useState } from "react";
import { Package, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useList } from "@refinedev/core";

interface SelectedPackage {
  id: string;
  name: string;
  price: number;
}

interface PackageSelectorCardProps {
  selectedPackages: SelectedPackage[];
  onAddPackage: (pkg: SelectedPackage) => void;
  onRemovePackage: (packageId: string) => void;
}

export const PackageSelectorCard = ({
  selectedPackages,
  onAddPackage,
  onRemovePackage,
}: PackageSelectorCardProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch available packages
  const packagesQuery = useList({
    resource: "packages",
    filters: [{ field: "is_active", operator: "eq", value: true }],
    sorters: [{ field: "sort_order", order: "asc" }],
    pagination: { pageSize: 50 },
  });
  const packagesData = packagesQuery.result;

  const availablePackages = (packagesData?.data || []) as Array<{ id: string; name: string; price: number }>;
  
  // Filter by search and exclude already selected
  const filteredPackages = availablePackages.filter(pkg => {
    const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase());
    const notSelected = !selectedPackages.some(sp => sp.id === pkg.id);
    return matchesSearch && notSelected;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          Ausgewählte Pakete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected packages list */}
        {selectedPackages.length > 0 ? (
          <div className="space-y-2">
            {selectedPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between p-2 rounded-lg border bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{pkg.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {pkg.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} p.P.
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemovePackage(pkg.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Noch keine Pakete ausgewählt
          </p>
        )}

        {/* Search and add packages */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Paket suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          {searchTerm && filteredPackages.length > 0 && (
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {filteredPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => {
                    onAddPackage({
                      id: pkg.id,
                      name: pkg.name,
                      price: pkg.price,
                    });
                    setSearchTerm("");
                  }}
                  className="w-full flex items-center justify-between p-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">{pkg.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {pkg.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} p.P.
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {searchTerm && filteredPackages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Keine Pakete gefunden
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
