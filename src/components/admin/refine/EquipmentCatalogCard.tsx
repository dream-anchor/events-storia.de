import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, Upload, Plus, Trash2, FileText, Loader2 } from "lucide-react";

export interface EquipmentCatalogItem {
  id: string;
  name: string;
  default_quantity: number;
  price_per_unit: number;
  unit: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}

type ParsedRow = { name: string; quantity: number; price: number };

/** Parse CSV / TSV / TXT.
 *  Accepts separators ; , \t  | and decimal comma or dot.
 *  Columns: name, quantity, price (price optional → 0).
 *  Skips empty + header rows.
 */
export function parseEquipmentFile(raw: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // detect separator
    const sep = [";", "\t", "|", ","].find((s) => line.includes(s)) ?? ";";
    const cols = line.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < 1 || !cols[0]) continue;
    const name = cols[0];
    // skip header lines like "Name;Menge;Preis"
    if (/^(name|bezeichnung|equipment|artikel)$/i.test(name)) continue;

    const parseNum = (v: string | undefined) => {
      if (!v) return NaN;
      const cleaned = v.replace(/[€\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
      const n = parseFloat(cleaned);
      return isFinite(n) ? n : NaN;
    };

    const qty = parseNum(cols[1]);
    const price = parseNum(cols[2]);
    rows.push({
      name,
      quantity: isFinite(qty) && qty > 0 ? Math.round(qty) : 1,
      price: isFinite(price) && price >= 0 ? price : 0,
    });
  }
  return rows;
}

export function EquipmentCatalogCard() {
  const [items, setItems] = useState<EquipmentCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("equipment_catalog" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      toast.error("Konnte Equipment-Katalog nicht laden");
    } else {
      setItems((data || []) as unknown as EquipmentCatalogItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Datei zu groß (max 2 MB)");
      return;
    }
    const text = await file.text();
    const rows = parseEquipmentFile(text);
    if (rows.length === 0) {
      toast.error("Keine gültigen Zeilen erkannt. Format: Name;Menge;Preis");
      return;
    }
    setSaving(true);
    const payload = rows.map((r, idx) => ({
      name: r.name,
      default_quantity: r.quantity,
      price_per_unit: r.price,
      sort_order: items.length + idx,
      is_active: true,
    }));
    const { error } = await supabase.from("equipment_catalog" as any).insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error("Import fehlgeschlagen: " + error.message);
    } else {
      toast.success(`${rows.length} Einträge importiert`);
      reload();
    }
  };

  const handleAddBlank = async () => {
    const { error } = await supabase
      .from("equipment_catalog" as any)
      .insert({ name: "Neues Equipment", default_quantity: 1, price_per_unit: 0, sort_order: items.length } as any);
    if (error) toast.error(error.message);
    else reload();
  };

  const handleUpdate = async (id: string, patch: Partial<EquipmentCatalogItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("equipment_catalog" as any).update(patch as any).eq("id", id);
    if (error) {
      toast.error("Speichern fehlgeschlagen");
      reload();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("equipment_catalog" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Equipment-Katalog
            </CardTitle>
            <CardDescription>
              Equipment-Liste für den Offer Builder. Datei importieren (CSV/TXT) oder einzeln pflegen.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload + Add */}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Datei importieren
          </Button>
          <Button variant="outline" onClick={handleAddBlank} className="gap-2">
            <Plus className="h-4 w-4" />
            Eintrag hinzufügen
          </Button>
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs ml-auto"
          />
        </div>

        {/* Format hint */}
        <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
          <FileText className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground mb-1">Dateiformat — eine Zeile pro Equipment</p>
            <code className="block bg-background/60 rounded px-2 py-1 mb-1">Name;Menge;Preis</code>
            <p>z. B. <code>Stehtisch;10;12,50</code> · Trennzeichen: <code>;</code> <code>,</code> <code>Tab</code> <code>|</code> · Dezimaltrennzeichen: <code>,</code> oder <code>.</code></p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Laden…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            {items.length === 0 ? "Noch keine Equipment-Einträge." : "Keine Treffer."}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-auto pr-1">
            <div className="grid grid-cols-[1fr_80px_110px_40px] gap-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <span>Bezeichnung</span>
              <span className="text-center">Menge</span>
              <span className="text-right">Preis / Einheit</span>
              <span></span>
            </div>
            {filtered.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_80px_110px_40px] gap-2 items-center group"
              >
                <Input
                  value={item.name}
                  onChange={(e) => setItems((p) => p.map((i) => (i.id === item.id ? { ...i, name: e.target.value } : i)))}
                  onBlur={(e) => handleUpdate(item.id, { name: e.target.value.trim() || "Unbenannt" })}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  min={1}
                  value={item.default_quantity || ""}
                  onChange={(e) => setItems((p) => p.map((i) => (i.id === item.id ? { ...i, default_quantity: parseInt(e.target.value) || 1 } : i)))}
                  onBlur={() => handleUpdate(item.id, { default_quantity: item.default_quantity })}
                  className="h-8 text-sm text-center"
                />
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.price_per_unit || ""}
                    onChange={(e) => setItems((p) => p.map((i) => (i.id === item.id ? { ...i, price_per_unit: parseFloat(e.target.value) || 0 } : i)))}
                    onBlur={() => handleUpdate(item.id, { price_per_unit: item.price_per_unit })}
                    className="h-8 text-sm pr-6 text-right"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                  className="h-8 w-8 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}