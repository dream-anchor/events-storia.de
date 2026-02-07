import { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  UtensilsCrossed,
  Package,
  Users,
  MapPin,
  Mail,
  Phone,
  Globe,
  Save,
  Loader2,
  ChevronRight,
  ExternalLink,
  Shield,
  Bell,
  Palette,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useList } from "@refinedev/core";

// Business data interface
interface BusinessData {
  companyName: string;
  legalName: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  vatId: string;
  registrationNumber: string;
  defaultVatRate: string;
  notificationEmail: string;
  enableEmailNotifications: boolean;
}

export const Settings = () => {
  const [activeTab, setActiveTab] = useState("stammdaten");
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(null);

  // Business data state (would be loaded from database in production)
  const [businessData, setBusinessData] = useState<BusinessData>({
    companyName: "Storia Restaurant & Events",
    legalName: "Storia GmbH",
    address: "Karlstr. 47a",
    city: "München",
    postalCode: "80333",
    phone: "089 55 06 71 50",
    email: "info@storia-muenchen.de",
    website: "https://www.events-storia.de",
    vatId: "DE123456789",
    registrationNumber: "HRB 123456",
    defaultVatRate: "7",
    notificationEmail: "admin@storia-muenchen.de",
    enableEmailNotifications: true,
  });

  // Fetch menu items count
  const { data: menuItemsData } = useList({
    resource: "menu_items" as never,
    pagination: { pageSize: 1, current: 1 },
  });
  const menuItemsCount = menuItemsData?.total || 0;

  // Fetch packages count
  const { data: packagesData } = useList({
    resource: "packages" as never,
    pagination: { pageSize: 1, current: 1 },
    filters: [{ field: "is_active", operator: "eq", value: true }],
  });
  const packagesCount = packagesData?.total || 0;

  // Fetch locations count
  const { data: locationsData } = useList({
    resource: "locations" as never,
    pagination: { pageSize: 1, current: 1 },
    filters: [{ field: "is_active", operator: "eq", value: true }],
  });
  const locationsCount = locationsData?.total || 0;

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser({
          email: user.email || "",
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Benutzer",
        });
      }
    });
  }, []);

  const handleBusinessDataChange = (field: keyof BusinessData, value: string | boolean) => {
    setBusinessData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveBusinessData = async () => {
    setIsSaving(true);
    // Simulate save - in production this would save to database
    await new Promise((resolve) => setTimeout(resolve, 800));
    toast.success("Stammdaten gespeichert");
    setIsSaving(false);
  };

  return (
    <AdminLayout activeTab="settings" title="Einstellungen" showCreateButton={false}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verwalten Sie Stammdaten, Speisekarten, Pakete und Nutzereinstellungen
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="stammdaten" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <Building2 className="h-4 w-4" />
              Stammdaten
            </TabsTrigger>
            <TabsTrigger value="speisen" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <UtensilsCrossed className="h-4 w-4" />
              Speisen
            </TabsTrigger>
            <TabsTrigger value="pakete" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <Package className="h-4 w-4" />
              Pakete & Locations
            </TabsTrigger>
            <TabsTrigger value="nutzer" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <Users className="h-4 w-4" />
              Nutzer
            </TabsTrigger>
          </TabsList>

          {/* Stammdaten Tab */}
          <TabsContent value="stammdaten" className="space-y-6">
            {/* Company Info */}
            <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Unternehmensdaten
                </CardTitle>
                <CardDescription>
                  Grundlegende Informationen zu Ihrem Unternehmen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Firmenname (Anzeige)</Label>
                    <Input
                      id="companyName"
                      value={businessData.companyName}
                      onChange={(e) => handleBusinessDataChange("companyName", e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Rechtlicher Name</Label>
                    <Input
                      id="legalName"
                      value={businessData.legalName}
                      onChange={(e) => handleBusinessDataChange("legalName", e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Adresse
                  </h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="address">Straße & Hausnummer</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="address"
                          value={businessData.address}
                          onChange={(e) => handleBusinessDataChange("address", e.target.value)}
                          className="h-11 pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">PLZ</Label>
                      <Input
                        id="postalCode"
                        value={businessData.postalCode}
                        onChange={(e) => handleBusinessDataChange("postalCode", e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:w-1/3">
                    <Label htmlFor="city">Stadt</Label>
                    <Input
                      id="city"
                      value={businessData.city}
                      onChange={(e) => handleBusinessDataChange("city", e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Kontakt
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={businessData.phone}
                          onChange={(e) => handleBusinessDataChange("phone", e.target.value)}
                          className="h-11 pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-Mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={businessData.email}
                          onChange={(e) => handleBusinessDataChange("email", e.target.value)}
                          className="h-11 pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="website">Website</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="website"
                          value={businessData.website}
                          onChange={(e) => handleBusinessDataChange("website", e.target.value)}
                          className="h-11 pl-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Rechtliche Angaben
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vatId">USt-IdNr.</Label>
                      <Input
                        id="vatId"
                        value={businessData.vatId}
                        onChange={(e) => handleBusinessDataChange("vatId", e.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">Handelsregister-Nr.</Label>
                      <Input
                        id="registrationNumber"
                        value={businessData.registrationNumber}
                        onChange={(e) => handleBusinessDataChange("registrationNumber", e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveBusinessData} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Benachrichtigungen
                </CardTitle>
                <CardDescription>
                  Einstellungen für E-Mail-Benachrichtigungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableNotifications">E-Mail-Benachrichtigungen aktivieren</Label>
                    <p className="text-sm text-muted-foreground">
                      Erhalten Sie Benachrichtigungen bei neuen Anfragen und Bestellungen
                    </p>
                  </div>
                  <Switch
                    id="enableNotifications"
                    checked={businessData.enableEmailNotifications}
                    onCheckedChange={(checked) => handleBusinessDataChange("enableEmailNotifications", checked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notificationEmail">Benachrichtigungs-E-Mail</Label>
                  <Input
                    id="notificationEmail"
                    type="email"
                    value={businessData.notificationEmail}
                    onChange={(e) => handleBusinessDataChange("notificationEmail", e.target.value)}
                    className="h-11 max-w-md"
                    disabled={!businessData.enableEmailNotifications}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Speisen Tab */}
          <TabsContent value="speisen" className="space-y-6">
            <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UtensilsCrossed className="h-5 w-5 text-primary" />
                      Speisekarte verwalten
                    </CardTitle>
                    <CardDescription>
                      {menuItemsCount} Speisen in der Datenbank
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {menuItemsCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Verwalten Sie alle Speisen für Catering und Restaurant. Fügen Sie neue Gerichte hinzu,
                  bearbeiten Sie Preise und Beschreibungen.
                </p>
                <Link to="/admin/menu">
                  <Button className="gap-2">
                    Speisekarte öffnen
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{menuItemsCount}</div>
                  <p className="text-sm text-muted-foreground">Speisen gesamt</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">Aktiv</div>
                  <p className="text-sm text-muted-foreground">Speisekarten-Status</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">5</div>
                  <p className="text-sm text-muted-foreground">Kategorien</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pakete & Locations Tab */}
          <TabsContent value="pakete" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Packages Card */}
              <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Event-Pakete
                      </CardTitle>
                      <CardDescription>
                        {packagesCount} aktive Pakete
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {packagesCount}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Verwalten Sie Event-Pakete mit Preisen, Inklusivleistungen und Verfügbarkeiten.
                  </p>
                  <Link to="/admin/packages">
                    <Button className="gap-2 w-full">
                      Pakete verwalten
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Locations Card */}
              <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Locations
                      </CardTitle>
                      <CardDescription>
                        {locationsCount} aktive Locations
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {locationsCount}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Verwalten Sie Veranstaltungsräume mit Kapazitäten und Ausstattung.
                  </p>
                  <Link to="/admin/packages">
                    <Button variant="outline" className="gap-2 w-full">
                      Locations verwalten
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg">Schnellaktionen</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Link to="/admin/packages/create">
                  <Button variant="outline" className="gap-2">
                    <Package className="h-4 w-4" />
                    Neues Paket erstellen
                  </Button>
                </Link>
                <Link to="/admin/locations/create">
                  <Button variant="outline" className="gap-2">
                    <MapPin className="h-4 w-4" />
                    Neue Location erstellen
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nutzer Tab */}
          <TabsContent value="nutzer" className="space-y-6">
            {/* Current User */}
            <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Ihr Konto
                </CardTitle>
                <CardDescription>
                  Verwalten Sie Ihre persönlichen Einstellungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
                    {currentUser?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{currentUser?.name || "Benutzer"}</h3>
                    <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                    <Badge className="mt-1">Administrator</Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="userName">Anzeigename</Label>
                    <Input
                      id="userName"
                      value={currentUser?.name || ""}
                      className="h-11"
                      placeholder="Ihr Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">E-Mail-Adresse</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={currentUser?.email || ""}
                      className="h-11"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      E-Mail-Adresse kann nicht geändert werden
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="gap-2">
                    <Save className="h-4 w-4" />
                    Profil speichern
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  Erscheinungsbild
                </CardTitle>
                <CardDescription>
                  Passen Sie das Aussehen der Anwendung an
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Aktivieren Sie den dunklen Modus für die Admin-Oberfläche
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Sicherheit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="gap-2">
                  Passwort ändern
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <p className="text-sm text-muted-foreground">
                  Sie werden zur Supabase-Authentifizierung weitergeleitet, um Ihr Passwort zu ändern.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};
