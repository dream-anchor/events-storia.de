import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatEuro, isValidVatSplit } from "@/lib/gift/pricing";

type Basket = Tables<"gift_baskets">;
type Variant = Tables<"gift_basket_variants">;
type Component = Tables<"gift_basket_components">;
type BasketFull = Basket & { gift_basket_variants: Variant[]; gift_basket_components: Component[] };

const ALLERGENS: [string, string][] = [
  ["gluten", "Gluten"], ["crustaceans", "Krebstiere"], ["eggs", "Eier"], ["fish", "Fisch"], ["peanuts", "Erdnüsse"],
  ["soy", "Soja"], ["milk", "Milch"], ["nuts", "Schalenfrüchte"], ["celery", "Sellerie"], ["mustard", "Senf"],
  ["sesame", "Sesam"], ["sulfites", "Schwefeldioxid/Sulfite"], ["lupin", "Lupinen"], ["molluscs", "Weichtiere"],
];

const euroInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Bestand je Weinvariante (nur über RPC mit Protokoll), Körbe, Steuer-Aufteilung, LMIV je Wein/Bestandteil. */
export function GiftStockAdmin() {
  const [baskets, setBaskets] = useState<BasketFull[] | null>(null);
  const [editVariant, setEditVariant] = useState<Variant | null>(null);
  const [editComponent, setEditComponent] = useState<Component | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("gift_baskets")
      .select("*, gift_basket_variants(*), gift_basket_components(*)")
      .is("deleted_at", null)
      .order("sort_order");
    if (error) { toast.error("Laden fehlgeschlagen", { description: error.message }); return; }
    setBaskets((data ?? []) as unknown as BasketFull[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!baskets) return <Loader2 className="h-5 w-5 animate-spin" aria-label="Lädt" />;

  return (
    <div className="space-y-6">
      {baskets.map((b) => (
        <BasketCard key={b.id} basket={b} onChanged={load} onEditVariant={setEditVariant} onEditComponent={setEditComponent} />
      ))}
      <VariantLmivDialog variant={editVariant} onClose={() => setEditVariant(null)} onSaved={load} />
      <ComponentLmivDialog component={editComponent} onClose={() => setEditComponent(null)} onSaved={load} />
    </div>
  );
}

function BasketCard({ basket, onChanged, onEditVariant, onEditComponent }: {
  basket: BasketFull; onChanged: () => void; onEditVariant: (v: Variant) => void; onEditComponent: (c: Component) => void;
}) {
  const [price, setPrice] = useState(euroInput(basket.price_cents));
  const split = isValidVatSplit(basket.vat_split) ? basket.vat_split : null;
  const [share7, setShare7] = useState(split ? String((split.find((s) => s.rate === 7)?.share_bp ?? 0) / 100) : "");

  const lmivMissing =
    basket.gift_basket_variants.some((v) => v.active && !v.lmiv_verified_at) || basket.gift_basket_components.some((c) => !c.lmiv_verified_at);

  const update = async (patch: Partial<Basket>, ok: string) => {
    const { error } = await supabase.from("gift_baskets").update(patch).eq("id", basket.id);
    if (error) { toast.error("Speichern fehlgeschlagen", { description: error.message }); return; }
    toast.success(ok);
    onChanged();
  };

  const toggleActive = async (active: boolean) => {
    if (active && (lmivMissing || !split)) {
      const reasons = [lmivMissing ? "LMIV-Angaben sind noch nicht vollständig gegengelesen" : "", !split ? "die Steuer-Aufteilung (7 %/19 %) fehlt" : ""].filter(Boolean).join(" und ");
      if (!confirm(`Achtung: ${reasons}. Der Korb darf so nicht live gehen. Trotzdem aktivieren?`)) return;
    }
    await update({ active }, active ? "Korb aktiviert" : "Korb deaktiviert");
  };

  const savePrice = async () => {
    const cents = Math.round(parseFloat(price.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { toast.error("Ungültiger Preis"); return; }
    await update({ price_cents: cents }, "Preis gespeichert");
  };

  const saveSplit = async () => {
    const pct = parseFloat(share7.replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { toast.error("Anteil 7 % zwischen 0 und 100 angeben"); return; }
    const bp7 = Math.round(pct * 100);
    await update({ vat_split: [{ rate: 7, share_bp: bp7 }, { rate: 19, share_bp: 10000 - bp7 }] }, "Steuer-Aufteilung gespeichert");
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">{basket.name_de} <span className="text-sm font-normal text-muted-foreground">({basket.size_key})</span></CardTitle>
          <div className="flex items-center gap-2">
            {lmivMissing && <Badge variant="destructive">LMIV unvollständig</Badge>}
            {!split && <Badge variant="destructive">Steuer-Aufteilung fehlt</Badge>}
            <Label htmlFor={`active-${basket.id}`}>{basket.active ? "Live" : "Inaktiv"}</Label>
            <Switch id={`active-${basket.id}`} checked={basket.active} onCheckedChange={toggleActive} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-end gap-2">
            <div className="flex-1"><Label htmlFor={`price-${basket.id}`}>Preis brutto (€)</Label><Input id={`price-${basket.id}`} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></div>
            <Button type="button" variant="outline" onClick={savePrice}>Speichern</Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor={`vat-${basket.id}`}>Anteil 7 % am Preis (%; Rest 19 %) – laut Steuerberater</Label>
              <Input id={`vat-${basket.id}`} value={share7} onChange={(e) => setShare7(e.target.value)} inputMode="decimal" placeholder="nicht festgelegt" />
            </div>
            <Button type="button" variant="outline" onClick={saveSplit}>Speichern</Button>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Weinvarianten und Bestand</h3>
          <div className="space-y-2">
            {basket.gift_basket_variants.sort((a, b) => a.sort_order - b.sort_order).map((v) => (
              <VariantRow key={v.id} variant={v} onChanged={onChanged} onEdit={() => onEditVariant(v)} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Bestandteile (LMIV)</h3>
          <ul className="space-y-1 text-sm">
            {basket.gift_basket_components.sort((a, b) => a.sort_order - b.sort_order).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>{c.name_de}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={c.lmiv_verified_at ? "outline" : "destructive"}>{c.lmiv_verified_at ? "geprüft" : "offen"}</Badge>
                  <Button type="button" size="sm" variant="outline" onClick={() => onEditComponent(c)}>Pflichtangaben</Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Preis aktuell: {formatEuro(basket.price_cents)}.</p>
      </CardContent>
    </Card>
  );
}

function VariantRow({ variant, onChanged, onEdit }: { variant: Variant; onChanged: () => void; onEdit: () => void }) {
  const [target, setTarget] = useState(String(variant.stock_qty));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const adjust = async (delta: number, why: string) => {
    if (delta === 0) return;
    setBusy(true);
    const { error } = await supabase.rpc("gift_adjust_stock", { p_variant_id: variant.id, p_delta: delta, p_reason: why || "manual" });
    setBusy(false);
    if (error) { toast.error("Bestand nicht geändert", { description: error.message }); return; }
    toast.success("Bestand gespeichert");
    setReason("");
    onChanged();
  };

  const setAbsolute = () => {
    const n = Number.parseInt(target, 10);
    if (!Number.isInteger(n) || n < 0) { toast.error("Bestand muss eine Zahl ≥ 0 sein"); return; }
    void adjust(n - variant.stock_qty, reason);
  };

  const toggleActive = async (active: boolean) => {
    const { error } = await supabase.from("gift_basket_variants").update({ active }).eq("id", variant.id);
    if (error) toast.error("Speichern fehlgeschlagen", { description: error.message });
    onChanged();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
      <div className="min-w-[10rem] flex-1">
        <p className="font-medium">{variant.label_de}</p>
        <p className="text-xs text-muted-foreground">
          Bestand: <strong>{variant.stock_qty}</strong>{" "}
          <Badge variant={variant.lmiv_verified_at ? "outline" : "destructive"} className="ml-1">{variant.lmiv_verified_at ? "LMIV geprüft" : "LMIV offen"}</Badge>
        </p>
      </div>
      <Button type="button" size="icon" variant="outline" aria-label="Bestand minus 1" disabled={busy || variant.stock_qty <= 0} onClick={() => adjust(-1, reason)}>−</Button>
      <Button type="button" size="icon" variant="outline" aria-label="Bestand plus 1" disabled={busy} onClick={() => adjust(1, reason)}>+</Button>
      <Input className="w-20" aria-label="Neuer Bestand" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
      <Input className="w-44" aria-label="Grund (Protokoll)" placeholder="Grund (z. B. Lieferung)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button type="button" variant="outline" disabled={busy} onClick={setAbsolute}>Bestand setzen</Button>
      <Button type="button" variant="outline" onClick={onEdit}>Pflichtangaben Wein</Button>
      <div className="flex items-center gap-2"><Switch checked={variant.active} onCheckedChange={toggleActive} aria-label="Variante aktiv" /></div>
    </div>
  );
}

function VariantLmivDialog({ variant, onClose, onSaved }: { variant: Variant | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ net_content: "", abv: "", bottler: "", origin: "", sulfites: true, verified: false });
  useEffect(() => {
    if (variant) setF({
      net_content: variant.net_content ?? "", abv: variant.abv_percent === null ? "" : String(variant.abv_percent).replace(".", ","),
      bottler: variant.bottler ?? "", origin: variant.origin ?? "", sulfites: variant.contains_sulfites, verified: !!variant.lmiv_verified_at,
    });
  }, [variant]);
  if (!variant) return null;

  const save = async () => {
    const abv = f.abv.trim() === "" ? null : parseFloat(f.abv.replace(",", "."));
    if (abv !== null && (!Number.isFinite(abv) || abv < 0 || abv > 100)) { toast.error("Alkoholgehalt ungültig"); return; }
    if (f.verified && (!f.net_content.trim() || abv === null || !f.bottler.trim() || !f.origin.trim())) {
      toast.error("Zum Bestätigen Füllmenge, Alkoholgehalt, Abfüller und Herkunft ausfüllen"); return;
    }
    const { error } = await supabase.from("gift_basket_variants").update({
      net_content: f.net_content.trim() || null, abv_percent: abv, bottler: f.bottler.trim() || null, origin: f.origin.trim() || null,
      contains_sulfites: f.sulfites, lmiv_verified_at: f.verified ? (variant.lmiv_verified_at ?? new Date().toISOString()) : null,
    }).eq("id", variant.id);
    if (error) { toast.error("Speichern fehlgeschlagen", { description: error.message }); return; }
    toast.success("Pflichtangaben gespeichert");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Pflichtangaben: {variant.label_de}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label htmlFor="v-net">Nettofüllmenge</Label><Input id="v-net" value={f.net_content} onChange={(e) => setF({ ...f, net_content: e.target.value })} placeholder="0,75 l" /></div>
          <div><Label htmlFor="v-abv">Alkoholgehalt (% vol.)</Label><Input id="v-abv" value={f.abv} onChange={(e) => setF({ ...f, abv: e.target.value })} inputMode="decimal" /></div>
          <div><Label htmlFor="v-bot">Abfüller / Lebensmittelunternehmer</Label><Input id="v-bot" value={f.bottler} onChange={(e) => setF({ ...f, bottler: e.target.value })} /></div>
          <div><Label htmlFor="v-org">Herkunft</Label><Input id="v-org" value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} /></div>
          <div className="flex items-center gap-2"><Checkbox id="v-sul" checked={f.sulfites} onCheckedChange={(v) => setF({ ...f, sulfites: v === true })} /><Label htmlFor="v-sul">enthält Sulfite</Label></div>
          <div className="flex items-center gap-2"><Checkbox id="v-ver" checked={f.verified} onCheckedChange={(v) => setF({ ...f, verified: v === true })} /><Label htmlFor="v-ver">Gegen das Etikett gegengelesen (ohne Haken zeigt der Shop einen internen Hinweis)</Label></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Abbrechen</Button><Button onClick={save}>Speichern</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComponentLmivDialog({ component, onClose, onSaved }: { component: Component | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ quantity: "", ing_de: "", ing_en: "", allergens: [] as string[], net: "", operator: "", origin: "", verified: false });
  useEffect(() => {
    if (component) setF({
      quantity: component.quantity ?? "", ing_de: component.ingredients_de ?? "", ing_en: component.ingredients_en ?? "",
      allergens: component.allergens ?? [], net: component.net_content ?? "", operator: component.food_business_operator ?? "",
      origin: component.origin ?? "", verified: !!component.lmiv_verified_at,
    });
  }, [component]);
  if (!component) return null;

  const save = async () => {
    if (f.verified && (!f.ing_de.trim() || !f.net.trim() || !f.operator.trim())) {
      toast.error("Zum Bestätigen Zutaten (DE), Nettofüllmenge und Lebensmittelunternehmer ausfüllen"); return;
    }
    const { error } = await supabase.from("gift_basket_components").update({
      quantity: f.quantity.trim() || null, ingredients_de: f.ing_de.trim() || null, ingredients_en: f.ing_en.trim() || null,
      allergens: f.allergens, net_content: f.net.trim() || null, food_business_operator: f.operator.trim() || null, origin: f.origin.trim() || null,
      lmiv_verified_at: f.verified ? (component.lmiv_verified_at ?? new Date().toISOString()) : null,
    }).eq("id", component.id);
    if (error) { toast.error("Speichern fehlgeschlagen", { description: error.message }); return; }
    toast.success("Pflichtangaben gespeichert");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Pflichtangaben: {component.name_de}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label htmlFor="c-qty">Menge im Korb</Label><Input id="c-qty" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
          <div><Label htmlFor="c-ide">Zutatenverzeichnis (DE; Allergene GROSS schreiben)</Label><Textarea id="c-ide" rows={3} value={f.ing_de} onChange={(e) => setF({ ...f, ing_de: e.target.value })} /></div>
          <div><Label htmlFor="c-ien">Ingredients (EN)</Label><Textarea id="c-ien" rows={3} value={f.ing_en} onChange={(e) => setF({ ...f, ing_en: e.target.value })} /></div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Allergene (14 LMIV-Allergene)</legend>
            <div className="grid grid-cols-2 gap-1">
              {ALLERGENS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={f.allergens.includes(key)} onCheckedChange={(v) => setF({ ...f, allergens: v === true ? [...f.allergens, key] : f.allergens.filter((a) => a !== key) })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div><Label htmlFor="c-net">Nettofüllmenge</Label><Input id="c-net" value={f.net} onChange={(e) => setF({ ...f, net: e.target.value })} /></div>
          <div><Label htmlFor="c-op">Lebensmittelunternehmer (Name und Anschrift)</Label><Input id="c-op" value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })} /></div>
          <div><Label htmlFor="c-or">Herkunft (wo vorgeschrieben)</Label><Input id="c-or" value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} /></div>
          <div className="flex items-center gap-2"><Checkbox id="c-ver" checked={f.verified} onCheckedChange={(v) => setF({ ...f, verified: v === true })} /><Label htmlFor="c-ver">Gegen das Etikett gegengelesen</Label></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Abbrechen</Button><Button onClick={save}>Speichern</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
