import { useState, useEffect, useRef } from "react";
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
  FileText,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
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

// --- Template-Verwaltung ---
interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: string;
  is_active: boolean | null;
  sort_order: number | null;
}

const TEMPLATE_VARIABLES = [
  { key: '{{kundenname}}', label: 'Kundenname', group: 'anfrage' },
  { key: '{{firma}}', label: 'Firma', group: 'anfrage' },
  { key: '{{eventdatum}}', label: 'Eventdatum', group: 'anfrage' },
  { key: '{{gaeste}}', label: 'Gäste', group: 'anfrage' },
  { key: '{{eventart}}', label: 'Eventart', group: 'anfrage' },
  { key: '{{raum}}', label: 'Raum', group: 'anfrage' },
  { key: '{{zeitfenster}}', label: 'Zeitfenster', group: 'anfrage' },
  { key: '{{paketname}}', label: 'Paketname', group: 'angebot' },
  { key: '{{menu}}', label: 'Menü', group: 'angebot' },
  { key: '{{getraenke}}', label: 'Getränke', group: 'angebot' },
  { key: '{{gesamtpreis}}', label: 'Gesamtpreis', group: 'angebot' },
  { key: '{{preis_pro_person}}', label: 'Preis/Person', group: 'angebot' },
  { key: '{{optionen}}', label: 'Alle Optionen', group: 'angebot' },
  { key: '{{eventdetails_satz}}', label: 'Eventdetails', group: 'angebot' },
  // Signatur ist jetzt ein eigenes Feld (siehe SignatureEditor)
  { key: '{{checkliste}}', label: 'Checkliste', group: 'angebot' },
  { key: '{{tafelhinweis}}', label: 'Tafelhinweis', group: 'angebot' },
] as const;

// --- E-Mail-Signatur ---
function SignatureEditor() {
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signatureId, setSignatureId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('email_templates')
        .select('id, content')
        .eq('category', 'signatur')
        .limit(1)
        .maybeSingle();
      if (data) {
        setSignature(data.content);
        setSignatureId(data.id);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    if (signatureId) {
      await supabase.from('email_templates').update({ content: signature }).eq('id', signatureId);
    } else {
      const { data } = await supabase.from('email_templates').insert({
        name: 'E-Mail-Signatur',
        subject: '',
        content: signature,
        category: 'signatur',
        is_active: true,
        sort_order: 0,
      }).select('id').maybeSingle();
      if (data) setSignatureId(data.id);
    }
    setSaving(false);
    toast.success('Signatur gespeichert');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          E-Mail-Signatur
        </CardTitle>
        <CardDescription>
          Wird automatisch an alle ausgehenden E-Mails angehängt. Im Online-Angebot wird nur der Name angezeigt (ohne Firmendaten).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={`Speranza GmbH\nKarlstraße 47a\n80333 München\nDeutschland\n\nTelefon: +49 89 51519696\nE-Mail: info@events-storia.de\n\nVertreten durch die Geschäftsführerin:\nAgnese Lettieri\n\nHandelsregisternummer: HRB 209637\nUmsatzsteuer-ID: DE 296024880`}
          className="min-h-[200px] font-mono text-sm leading-relaxed"
        />
        <p className="text-xs text-muted-foreground">
          Tipp: Enthält typischerweise Firmenname, Adresse, Telefon, E-Mail, Geschäftsführung, HRB, USt-ID.
        </p>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Signatur speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateManager() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', subject: '', content: '', category: 'vorlage' });
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCursorRef = useRef<number | null>(null);

  /** Cursor-Position merken */
  const saveCursorPos = () => {
    if (templateTextareaRef.current) {
      lastCursorRef.current = templateTextareaRef.current.selectionStart;
    }
  };

  /** Variable-Tag an Cursor-Position einfügen */
  const insertVariableTag = (tag: string) => {
    const pos = lastCursorRef.current ?? editForm.content.length;
    const before = editForm.content.slice(0, pos);
    const after = editForm.content.slice(pos);
    const newContent = before + tag + after;
    setEditForm(f => ({ ...f, content: newContent }));

    requestAnimationFrame(() => {
      const textarea = templateTextareaRef.current;
      if (textarea) {
        const newPos = pos + tag.length;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
        lastCursorRef.current = newPos;
      }
    });
  };

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_templates')
      .select('id, name, subject, content, category, is_active, sort_order')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });
    if (!error && data) setTemplates(data);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const startEdit = (t: TemplateRow) => {
    setEditingId(t.id);
    setEditForm({ name: t.name, subject: t.subject, content: t.content, category: t.category });
    setIsCreating(false);
  };

  const startCreate = (category: string) => {
    setEditingId(null);
    setEditForm({ name: '', subject: '', content: '', category });
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!editForm.name.trim() || !editForm.content.trim()) {
      toast.error('Name und Text sind Pflichtfelder');
      return;
    }
    setSaving(true);

    if (isCreating) {
      const maxOrder = templates.filter(t => t.category === editForm.category).length + 1;
      const { error } = await supabase.from('email_templates').insert({
        name: editForm.name,
        subject: editForm.subject || editForm.name,
        content: editForm.content,
        category: editForm.category,
        is_active: true,
        sort_order: maxOrder,
      });
      if (error) { toast.error('Fehler beim Erstellen'); }
      else { toast.success('Vorlage erstellt'); }
    } else if (editingId) {
      const { error } = await supabase.from('email_templates').update({
        name: editForm.name,
        subject: editForm.subject,
        content: editForm.content,
        category: editForm.category,
      }).eq('id', editingId);
      if (error) { toast.error('Fehler beim Speichern'); }
      else { toast.success('Vorlage gespeichert'); }
    }

    setSaving(false);
    setEditingId(null);
    setIsCreating(false);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) { toast.error('Fehler beim Löschen'); }
    else { toast.success('Vorlage gelöscht'); fetchTemplates(); }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from('email_templates').update({ is_active: !current }).eq('id', id);
    fetchTemplates();
  };

  const cancel = () => { setEditingId(null); setIsCreating(false); };

  const vorlagen = templates.filter(t => t.category === 'vorlage');
  const bausteine = templates.filter(t => t.category === 'baustein');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Editor-Ansicht
  if (editingId || isCreating) {
    return (
      <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-lg">
            {isCreating ? 'Neue Vorlage erstellen' : 'Vorlage bearbeiten'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="z.B. Network Aperitif"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Betreff (für E-Mail)</Label>
              <Input
                value={editForm.subject}
                onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="z.B. Ihre Veranstaltungsanfrage im STORIA"
                className="h-11"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Kategorie</Label>
            <div className="flex gap-2">
              <Button
                variant={editForm.category === 'vorlage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditForm(f => ({ ...f, category: 'vorlage' }))}
                className="rounded-xl"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Vorlage
              </Button>
              <Button
                variant={editForm.category === 'baustein' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditForm(f => ({ ...f, category: 'baustein' }))}
                className="rounded-xl"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Textbaustein
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Text</Label>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Variablen anklicken zum Einfügen:</p>
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariableTag(v.key)}
                    className="inline-flex items-center h-6 px-2 rounded-md text-[11px] font-mono bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border/30 transition-colors cursor-pointer"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              ref={templateTextareaRef}
              value={editForm.content}
              onChange={(e) => { setEditForm(f => ({ ...f, content: e.target.value })); saveCursorPos(); }}
              onSelect={saveCursorPos}
              onBlur={saveCursorPos}
              onKeyUp={saveCursorPos}
              placeholder="Sehr geehrte Damen und Herren, ..."
              className="min-h-[300px] font-sans text-sm leading-relaxed"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={cancel}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Listen-Ansicht
  return (
    <>
      {/* Vorlagen */}
      <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                E-Mail-Vorlagen
              </CardTitle>
              <CardDescription>
                Komplette Anschreiben — ersetzen den gesamten Text
              </CardDescription>
            </div>
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => startCreate('vorlage')}>
              <Plus className="h-3.5 w-3.5" />
              Neue Vorlage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {vorlagen.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Keine Vorlagen vorhanden</p>
          ) : (
            <div className="space-y-1">
              {vorlagen.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{t.name}</span>
                    <span className="text-xs text-muted-foreground truncate block">
                      {t.content.slice(0, 80)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={t.is_active ?? false}
                      onCheckedChange={() => handleToggleActive(t.id, t.is_active ?? false)}
                      className="scale-75"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => startEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Textbausteine */}
      <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Textbausteine
              </CardTitle>
              <CardDescription>
                Textblöcke zum Einfügen — werden ans Anschreiben angehängt
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => startCreate('baustein')}>
              <Plus className="h-3.5 w-3.5" />
              Neuer Baustein
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bausteine.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Keine Textbausteine vorhanden</p>
          ) : (
            <div className="space-y-1">
              {bausteine.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{t.name}</span>
                    <span className="text-xs text-muted-foreground truncate block">
                      {t.content.slice(0, 80)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={t.is_active ?? false}
                      onCheckedChange={() => handleToggleActive(t.id, t.is_active ?? false)}
                      className="scale-75"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => startEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export const Settings = () => {
  const [activeTab, setActiveTab] = useState("stammdaten");
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(null);

  // Profil bearbeiten
  const [displayName, setDisplayName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Passwort ändern
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

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
  const menuItemsQuery = useList({
    resource: "menu_items" as never,
    pagination: { pageSize: 1 },
  });
  const menuItemsCount = menuItemsQuery.result?.total || 0;

  // Fetch packages count
  const packagesQuery = useList({
    resource: "packages" as never,
    pagination: { pageSize: 1 },
    filters: [{ field: "is_active", operator: "eq", value: true }],
  });
  const packagesCount = packagesQuery.result?.total || 0;

  // Fetch locations count
  const locationsQuery = useList({
    resource: "locations" as never,
    pagination: { pageSize: 1 },
    filters: [{ field: "is_active", operator: "eq", value: true }],
  });
  const locationsCount = locationsQuery.result?.total || 0;

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Benutzer";
        setCurrentUser({ email: user.email || "", name });
        setDisplayName(name);
      }
    });
  }, []);

  // Profil speichern (Anzeigename)
  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      toast.error("Anzeigename darf nicht leer sein");
      return;
    }
    setIsSavingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() },
    });
    if (error) {
      toast.error("Fehler beim Speichern: " + error.message);
    } else {
      setCurrentUser(prev => prev ? { ...prev, name: displayName.trim() } : prev);
      toast.success("Anzeigename gespeichert");
    }
    setIsSavingProfile(false);
  };

  // Passwort ändern
  const handleChangePassword = async () => {
    if (passwordForm.newPassword.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    setIsSavingPassword(true);
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });
    if (error) {
      toast.error("Fehler beim Ändern: " + error.message);
    } else {
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      toast.success("Passwort erfolgreich geändert");
    }
    setIsSavingPassword(false);
  };

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
            <TabsTrigger value="vorlagen" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <FileText className="h-4 w-4" />
              Vorlagen
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

            {/* E-Mail-Signatur */}
            <SignatureEditor />
          </TabsContent>

          {/* Speisen Tab */}
          <TabsContent value="speisen" className="space-y-6">
            {/* Catering Menu - Editable */}
            <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UtensilsCrossed className="h-5 w-5 text-primary" />
                      Catering-Speisekarte
                    </CardTitle>
                    <CardDescription>
                      Speisen für Catering-Bestellungen und Events
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Bearbeitbar
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Verwalten Sie Fingerfood, Buffet-Platten, Pizzen und Desserts für das Catering.
                  Diese Speisen können direkt hier bearbeitet werden.
                </p>
                <Link to="/admin/menu">
                  <Button className="gap-2">
                    Catering-Speisen bearbeiten
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Restaurant Menu - External Link */}
            <Card className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UtensilsCrossed className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      Restaurant-Speisekarte
                    </CardTitle>
                    <CardDescription>
                      Speisen für das Ristorante Storia
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                    Externes System
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Die Restaurant-Speisekarte wird über das separate Admin-Panel des Ristorante Storia verwaltet.
                  Änderungen an den Restaurant-Gerichten erfolgen dort.
                </p>
                <a
                  href="https://www.ristorantestoria.de/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="gap-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950">
                    Restaurant-Admin öffnen
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
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

          {/* Vorlagen Tab */}
          <TabsContent value="vorlagen" className="space-y-6">
            <TemplateManager />
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
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
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
                  <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="gap-2">
                    {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                  Passwort ändern
                </CardTitle>
                <CardDescription>
                  Neues Passwort für Ihren Account festlegen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Neues Passwort</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                      placeholder="Min. 8 Zeichen"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="Passwort wiederholen"
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleChangePassword}
                    disabled={isSavingPassword || !passwordForm.newPassword}
                    variant="outline"
                    className="gap-2"
                  >
                    {isSavingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Passwort ändern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};
