import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate, useCreate } from "@refinedev/core";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
};

export const PackageEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreate = id === "create" || !id;
  
  const [formData, setFormData] = useState<PackageFormData>(defaultFormData);
  const [newIncludeItem, setNewIncludeItem] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { query, result } = useOne({
    resource: "packages",
    id: id!,
    queryOptions: { enabled: !isCreate },
  });

  const isLoading = query.isLoading;
  const data = result;

  const { mutate: update } = useUpdate();
  const { mutate: create } = useCreate();

  useEffect(() => {
    if (data?.data && !isCreate) {
      const pkg = data.data as any;
      setFormData({
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
      });
    }
  }, [data, isCreate]);

  const handleChange = (field: keyof PackageFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }
    if (formData.price <= 0) {
      toast.error("Bitte geben Sie einen gültigen Preis ein");
      return;
    }

    setIsSaving(true);
    
    const payload = {
      ...formData,
      includes: formData.includes,
    };

    if (isCreate) {
      create(
        { resource: "packages", values: payload },
        {
          onSuccess: () => {
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
          onSuccess: () => {
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
      <AdminLayout activeTab="packages">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="packages">
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
        <Card>
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
        <Card>
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
        <Card>
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

        {/* Includes */}
        <Card>
          <CardHeader>
            <CardTitle>Inklusivleistungen</CardTitle>
            <CardDescription>Was ist in diesem Paket enthalten?</CardDescription>
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
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
