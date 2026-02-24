import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate, useCreate, useList } from "@refinedev/core";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Plus, X, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PackageMenuItemsEditor } from "./PackageMenuItemsEditor";

interface PackageFormData {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  price_per_person: boolean;
  min_guests: number;
  max_guests: number;
  requires_prepayment: boolean;
  prepayment_percentage: number;
  package_type: string;
  is_active: boolean;
  sort_order: number;
  includes: string[];
  location_ids: string[];
}

interface LocationData {
  id: string;
  name: string;
  capacity_seated?: number;
  capacity_standing?: number;
}

const defaultFormData: PackageFormData = {
  name: "",
  name_en: "",
  description: "",
  description_en: "",
  price: 0,
  price_per_person: true,
  min_guests: 0,
  max_guests: 0,
  requires_prepayment: true,
  prepayment_percentage: 100,
  package_type: "event",
  is_active: true,
  sort_order: 0,
  includes: [],
  location_ids: [],
};

export const PackageEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreate = id === "create" || !id;
  
  const [formData, setFormData] = useState<PackageFormData>(defaultFormData);
  const [newIncludeItem, setNewIncludeItem] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { query: packageQuery, result: packageData } = useOne({
    resource: "packages",
    id: id!,
    queryOptions: { enabled: !isCreate },
  });

  // Fetch all locations
  const { result: locationsResult } = useList<LocationData>({
    resource: "locations",
    sorters: [{ field: "sort_order", order: "asc" }],
  });
  const locations = locationsResult?.data || [];
  const isLoading = packageQuery?.isLoading ?? false;

  const { mutate: update } = useUpdate();
  const { mutate: create } = useCreate();

  // Fetch assigned location IDs for this package
  useEffect(() => {
    const fetchPackageLocations = async () => {
      if (!id || isCreate) return;
      
      const { data: packageLocations } = await supabase
        .from('package_locations')
        .select('location_id')
        .eq('package_id', id);
      
      if (packageLocations) {
        setFormData(prev => ({
          ...prev,
          location_ids: packageLocations.map(pl => pl.location_id),
        }));
      }
    };
    
    fetchPackageLocations();
  }, [id, isCreate]);

  useEffect(() => {
    if (packageData && !isCreate) {
      const pkg = packageData as any;
      setFormData(prev => ({
        ...prev,
        name: pkg.name || "",
        name_en: pkg.name_en || "",
        description: pkg.description || "",
        description_en: pkg.description_en || "",
        price: pkg.price || 0,
        price_per_person: pkg.price_per_person ?? true,
        min_guests: pkg.min_guests || 0,
        max_guests: pkg.max_guests || 0,
        requires_prepayment: pkg.requires_prepayment ?? true,
        prepayment_percentage: pkg.prepayment_percentage || 100,
        package_type: pkg.package_type || "event",
        is_active: pkg.is_active ?? true,
        sort_order: pkg.sort_order || 0,
        includes: Array.isArray(pkg.includes) ? pkg.includes : [],
      }));
    }
  }, [packageData, isCreate]);

  const handleChange = (field: keyof PackageFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleLocation = (locationId: string) => {
    setFormData((prev) => ({
      ...prev,
      location_ids: prev.location_ids.includes(locationId)
        ? prev.location_ids.filter(id => id !== locationId)
        : [...prev.location_ids, locationId],
    }));
  };

  const addIncludeItem = () => {
    if (newIncludeItem.trim()) {
      setFormData((prev) => ({
        ...prev,
        includes: [...prev.includes, newIncludeItem.trim()],
      }));
      setNewIncludeItem("");
    }
  };

  const removeIncludeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      includes: prev.includes.filter((_, i) => i !== index),
    }));
  };

  const savePackageLocations = async (packageId: string) => {
    // Delete existing relations
    await supabase
      .from('package_locations')
      .delete()
      .eq('package_id', packageId);
    
    // Insert new relations
    if (formData.location_ids.length > 0) {
      await supabase
        .from('package_locations')
        .insert(
          formData.location_ids.map(locationId => ({
            package_id: packageId,
            location_id: locationId,
          }))
        );
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }
    if (formData.price <= 0) {
      toast.error("Bitte geben Sie einen gültigen Preis ein");
      return;
    }

    setIsSaving(true);
    
    const { location_ids, ...payload } = formData;

    if (isCreate) {
      create(
        { resource: "packages", values: payload },
        {
          onSuccess: async (response) => {
            const newId = (response as any).data?.id;
            if (newId) {
              await savePackageLocations(newId);
            }
            toast.success("Paket erstellt");
            navigate("/admin/packages");
          },
          onError: (error) => {
            toast.error("Fehler beim Erstellen: " + error.message);
            setIsSaving(false);
          },
        }
      );
    } else {
      update(
        { resource: "packages", id: id!, values: payload },
        {
          onSuccess: async () => {
            await savePackageLocations(id!);
            toast.success("Paket gespeichert");
            navigate("/admin/packages");
          },
          onError: (error) => {
            toast.error("Fehler beim Speichern: " + error.message);
            setIsSaving(false);
          },
        }
      );
    }
  };

  if (isLoading && !isCreate) {
    return (
      <AdminLayout activeTab="settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="settings">
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/packages")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isCreate ? "Neues Paket" : "Paket bearbeiten"}
            </h1>
            <p className="text-muted-foreground">
              {isCreate ? "Erstellen Sie ein neues Event- oder Catering-Paket" : formData.name}
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Speichern
          </Button>
        </div>

        {/* Basic Info */}
        <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle>Grundinformationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name (Deutsch) *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="z.B. Business Dinner – Exclusive"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_en">Name (Englisch)</Label>
                <Input
                  id="name_en"
                  value={formData.name_en}
                  onChange={(e) => handleChange("name_en", e.target.value)}
                  placeholder="z.B. Business Dinner – Exclusive"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung (Deutsch)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Beschreiben Sie das Paket..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_en">Beschreibung (Englisch)</Label>
              <Textarea
                id="description_en"
                value={formData.description_en}
                onChange={(e) => handleChange("description_en", e.target.value)}
                placeholder="Describe the package..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="package_type">Pakettyp</Label>
                <Select
                  value={formData.package_type}
                  onValueChange={(value) => handleChange("package_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="catering">Catering</SelectItem>
                    <SelectItem value="general">Allgemein</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sortierung</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => handleChange("sort_order", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleChange("is_active", checked)}
              />
              <Label htmlFor="is_active">Paket ist aktiv</Label>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle>Preisgestaltung</CardTitle>
            <CardDescription>Legen Sie den Preis und die Berechnungsart fest</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Preis (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleChange("price", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Preistyp</Label>
                <Select
                  value={formData.price_per_person ? "per_person" : "flat"}
                  onValueChange={(value) => handleChange("price_per_person", value === "per_person")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_person">Pro Person</SelectItem>
                    <SelectItem value="flat">Pauschal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min_guests">Mindestgäste</Label>
                <Input
                  id="min_guests"
                  type="number"
                  value={formData.min_guests}
                  onChange={(e) => handleChange("min_guests", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_guests">Maximale Gäste</Label>
                <Input
                  id="max_guests"
                  type="number"
                  value={formData.max_guests}
                  onChange={(e) => handleChange("max_guests", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle>Zahlungsbedingungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="requires_prepayment"
                checked={formData.requires_prepayment}
                onCheckedChange={(checked) => handleChange("requires_prepayment", checked)}
              />
              <Label htmlFor="requires_prepayment">Vorauszahlung erforderlich</Label>
            </div>

            {formData.requires_prepayment && (
              <div className="space-y-2">
                <Label htmlFor="prepayment_percentage">Vorauszahlung (%)</Label>
                <Select
                  value={String(formData.prepayment_percentage)}
                  onValueChange={(value) => handleChange("prepayment_percentage", parseInt(value))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                    <SelectItem value="100">100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Locations */}
        <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Verfügbare Locations
            </CardTitle>
            <CardDescription>
              Wählen Sie die Räumlichkeiten, in denen dieses Paket stattfinden kann
            </CardDescription>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Locations verfügbar</p>
            ) : (
              <div className="space-y-3">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.location_ids.includes(loc.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleLocation(loc.id)}
                  >
                    <Checkbox
                      checked={formData.location_ids.includes(loc.id)}
                      onCheckedChange={() => toggleLocation(loc.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-base">{loc.name}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {loc.capacity_seated && <span>{loc.capacity_seated} sitzend</span>}
                        {loc.capacity_standing && <span>{loc.capacity_standing} stehend</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Menu Items - Only show for existing packages */}
        {!isCreate && id && (
          <PackageMenuItemsEditor packageId={id} />
        )}

        {/* Includes */}
        <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle>Inklusivleistungen</CardTitle>
            <CardDescription>Was ist in diesem Paket enthalten? (Freitext-Liste)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="z.B. Welcome-Aperitivo"
                value={newIncludeItem}
                onChange={(e) => setNewIncludeItem(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addIncludeItem()}
              />
              <Button variant="outline" onClick={addIncludeItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {formData.includes.length > 0 && (
              <ul className="space-y-2">
                {formData.includes.map((item, index) => (
                  <li 
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                  >
                    <span className="flex-1">{item}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-amber-600"
                      onClick={() => removeIncludeItem(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};
