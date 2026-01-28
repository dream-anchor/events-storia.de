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
import { ArrowLeft, Save, Plus, X, Loader2, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

interface LocationFormData {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  capacity_seated: number;
  capacity_standing: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

const defaultFormData: LocationFormData = {
  name: "",
  name_en: "",
  description: "",
  description_en: "",
  capacity_seated: 0,
  capacity_standing: 0,
  features: [],
  is_active: true,
  sort_order: 0,
};

export const LocationEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreate = id === "create" || !id;
  
  const [formData, setFormData] = useState<LocationFormData>(defaultFormData);
  const [newFeature, setNewFeature] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { query: locationQuery, result: locationData } = useOne({
    resource: "locations",
    id: id!,
    queryOptions: { enabled: !isCreate },
  });
  const isLoading = locationQuery?.isLoading ?? false;

  const { mutate: update } = useUpdate();
  const { mutate: create } = useCreate();

  useEffect(() => {
    if (locationData && !isCreate) {
      const loc = locationData as any;
      setFormData({
        name: loc.name || "",
        name_en: loc.name_en || "",
        description: loc.description || "",
        description_en: loc.description_en || "",
        capacity_seated: loc.capacity_seated || 0,
        capacity_standing: loc.capacity_standing || 0,
        features: Array.isArray(loc.features) ? loc.features : [],
        is_active: loc.is_active ?? true,
        sort_order: loc.sort_order || 0,
      });
    }
  }, [locationData, isCreate]);

  const handleChange = (field: keyof LocationFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, newFeature.trim()],
      }));
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    setIsSaving(true);

    if (isCreate) {
      create(
        { resource: "locations", values: formData },
        {
          onSuccess: () => {
            toast.success("Location erstellt");
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
        { resource: "locations", id: id!, values: formData },
        {
          onSuccess: () => {
            toast.success("Location gespeichert");
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
      <div className="space-y-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/packages")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isCreate ? "Neue Location" : "Location bearbeiten"}
            </h1>
            <p className="text-muted-foreground text-base">
              {isCreate ? "Erstellen Sie einen neuen Veranstaltungsraum" : formData.name}
            </p>
          </div>
          <Button size="lg" onClick={handleSave} disabled={isSaving} className="text-base">
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
            <CardTitle className="text-xl flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Grundinformationen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base">Name (Deutsch) *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="z.B. Private Room"
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_en" className="text-base">Name (Englisch)</Label>
                <Input
                  id="name_en"
                  value={formData.name_en}
                  onChange={(e) => handleChange("name_en", e.target.value)}
                  placeholder="z.B. Private Room"
                  className="h-11 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">Beschreibung (Deutsch)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Beschreiben Sie den Raum..."
                rows={3}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_en" className="text-base">Beschreibung (Englisch)</Label>
              <Textarea
                id="description_en"
                value={formData.description_en}
                onChange={(e) => handleChange("description_en", e.target.value)}
                placeholder="Describe the room..."
                rows={3}
                className="text-base"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleChange("is_active", checked)}
              />
              <Label htmlFor="is_active" className="text-base">Location ist aktiv</Label>
            </div>
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="h-5 w-5" />
              Kapazität
            </CardTitle>
            <CardDescription className="text-base">
              Maximale Gästeanzahl für verschiedene Event-Formate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="capacity_seated" className="text-base">Kapazität sitzend</Label>
                <Input
                  id="capacity_seated"
                  type="number"
                  value={formData.capacity_seated || ""}
                  onChange={(e) => handleChange("capacity_seated", parseInt(e.target.value) || 0)}
                  placeholder="z.B. 65"
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity_standing" className="text-base">Kapazität stehend</Label>
                <Input
                  id="capacity_standing"
                  type="number"
                  value={formData.capacity_standing || ""}
                  onChange={(e) => handleChange("capacity_standing", parseInt(e.target.value) || 0)}
                  placeholder="z.B. 80"
                  className="h-11 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort_order" className="text-base">Sortierung</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => handleChange("sort_order", parseInt(e.target.value) || 0)}
                className="h-11 text-base w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Ausstattung & Features</CardTitle>
            <CardDescription className="text-base">
              Besondere Merkmale dieses Raums
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-3">
              <Input
                placeholder="z.B. Separates Soundsystem"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addFeature()}
                className="h-11 text-base"
              />
              <Button variant="outline" size="lg" onClick={addFeature}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            {formData.features.length > 0 && (
              <ul className="space-y-2">
                {formData.features.map((feature, index) => (
                  <li 
                    key={index}
                    className="flex items-center gap-3 p-3 bg-muted rounded-lg text-base"
                  >
                    <span className="flex-1">{feature}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFeature(index)}
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
