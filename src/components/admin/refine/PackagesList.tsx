import { useState } from "react";
import { useList, useDelete } from "@refinedev/core";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Users, 
  Euro,
  Package,
  Percent
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

export const PackagesList = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const { query, result } = useList<PackageData>({
    resource: "packages",
    sorters: [{ field: "sort_order", order: "asc" }],
  });
  
  const { isLoading, refetch } = query;
  const packages = result?.data || [];
  const { mutate: deletePackage } = useDelete();
  
  const filteredPackages = packages.filter(pkg => 
    pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pkg.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = () => {
    if (!deleteId) return;
    
    deletePackage(
      { resource: "packages", id: deleteId },
      {
        onSuccess: () => {
          toast.success("Paket gelöscht");
          refetch();
          setDeleteId(null);
        },
        onError: () => {
          toast.error("Fehler beim Löschen");
        },
      }
    );
  };

  const formatPrice = (price: number, perPerson: boolean) => {
    return `${price.toFixed(2).replace('.', ',')} €${perPerson ? ' p.P.' : ''}`;
  };

  const getPackageTypeBadge = (type: string) => {
    const types: Record<string, { label: string; className: string }> = {
      event: { label: "Event", className: "bg-purple-100 text-purple-700" },
      catering: { label: "Catering", className: "bg-blue-100 text-blue-700" },
      general: { label: "Allgemein", className: "bg-gray-100 text-gray-700" },
    };
    return types[type] || types.general;
  };

  return (
    <AdminLayout activeTab="packages">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pakete</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Event- und Catering-Pakete
            </p>
          </div>
          <Button onClick={() => navigate("/admin/packages/create")}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Paket
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pakete durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Packages Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32 bg-muted" />
                <CardContent className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPackages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Keine Pakete gefunden</h3>
              <p className="text-muted-foreground text-sm">
                {searchTerm ? "Versuchen Sie eine andere Suche" : "Erstellen Sie Ihr erstes Paket"}
              </p>
              {!searchTerm && (
                <Button className="mt-4" onClick={() => navigate("/admin/packages/create")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Paket erstellen
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPackages.map((pkg) => {
              const typeBadge = getPackageTypeBadge(pkg.package_type);
              
              return (
                <Card 
                  key={pkg.id} 
                  className={`relative overflow-hidden transition-shadow hover:shadow-md ${!pkg.is_active ? 'opacity-60' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-lg leading-tight">
                          {pkg.name}
                        </CardTitle>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={typeBadge.className}>
                            {typeBadge.label}
                          </Badge>
                          {!pkg.is_active && (
                            <Badge variant="secondary">Inaktiv</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">
                          {formatPrice(pkg.price, pkg.price_per_person)}
                        </div>
                        {pkg.price_per_person && (
                          <span className="text-xs text-muted-foreground">pro Person</span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {pkg.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 text-xs">
                      {pkg.min_guests && pkg.min_guests > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full">
                          <Users className="h-3 w-3" />
                          <span>Min. {pkg.min_guests} Pers.</span>
                        </div>
                      )}
                      {pkg.requires_prepayment && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          <Percent className="h-3 w-3" />
                          <span>{pkg.prepayment_percentage || 100}% Vorauszahlung</span>
                        </div>
                      )}
                    </div>

                    {/* Includes */}
                    {pkg.includes && Array.isArray(pkg.includes) && pkg.includes.length > 0 && (
                      <div className="text-xs space-y-1">
                        <span className="text-muted-foreground font-medium">Inklusive:</span>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {pkg.includes.slice(0, 3).map((item, i) => (
                            <li key={i} className="truncate">{item}</li>
                          ))}
                          {pkg.includes.length > 3 && (
                            <li className="text-primary">+{pkg.includes.length - 3} weitere</li>
                          )}
                        </ul>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => navigate(`/admin/packages/${pkg.id}/edit`)}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Bearbeiten
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(pkg.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Paket löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie dieses Paket wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};
