import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseTariff, isIsoDate, type DeliveryWindow, type PickupHours } from "@/lib/gift/pricing";

type Settings = Tables<"gift_settings">;
type Blackout = Tables<"gift_blackout_dates">;

const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const centsToEuro = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const euroToCents = (s: string) => Math.round(parseFloat(s.replace(",", ".")) * 100);

/** Sperrtage und Einstellungen (Tarif, Abholzeiten, Lieferfenster, Vorlauf, Reservierungsdauer). */
export function GiftSettingsAdmin() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([
      supabase.from("gift_settings").select("*").eq("id", 1).single(),
      supabase.from("gift_blackout_dates").select("*").order("date"),
    ]);
    if (s.error) { toast.error("Laden fehlgeschlagen", { description: s.error.message }); return; }
    setSettings(s.data);
    setBlackouts(b.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!settings) return <Loader2 className="h-5 w-5 animate-spin" aria-label="Lädt" />;
  return (
    <div className="space-y-6">
      <BlackoutCard blackouts={blackouts} onChanged={load} />
      <SettingsCard settings={settings} onChanged={load} />
    </div>
  );
}

function BlackoutCard({ blackouts, onChanged }: { blackouts: Blackout[]; onChanged: () => void }) {
  const [date, setDate] = useState("");
  const [handover, setHandover] = useState<"both" | "pickup" | "delivery">("both");
  const [reason, setReason] = useState("");

  const add = async () => {
    if (!isIsoDate(date)) { toast.error("Bitte ein Datum wählen"); return; }
    const { error } = await supabase.from("gift_blackout_dates").insert({ date, handover, reason: reason.trim() || null });
    if (error) { toast.error("Speichern fehlgeschlagen", { description: error.code === "23505" ? "Für dieses Datum gibt es den Sperrtag schon." : error.message }); return; }
    setDate(""); setReason("");
    onChanged();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("gift_blackout_dates").delete().eq("id", id);
    if (error) toast.error("Löschen fehlgeschlagen", { description: error.message });
    onChanged();
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-lg">Sperrtage (Betriebsferien, Feiertage)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label htmlFor="bo-date">Datum</Label><Input id="bo-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label htmlFor="bo-handover">Gilt für</Label>
            <select id="bo-handover" className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={handover} onChange={(e) => setHandover(e.target.value as typeof handover)}>
              <option value="both">Abholung und Lieferung</option><option value="pickup">nur Abholung</option><option value="delivery">nur Lieferung</option>
            </select>
          </div>
          <div className="min-w-[12rem] flex-1"><Label htmlFor="bo-reason">Grund (intern)</Label><Input id="bo-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button type="button" onClick={add}>Sperrtag anlegen</Button>
        </div>
        <ul className="space-y-1 text-sm">
          {blackouts.length === 0 && <li className="text-muted-foreground">Keine Sperrtage.</li>}
          {blackouts.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5">
              <span>{b.date.split("-").reverse().join(".")} · {b.handover === "both" ? "Abholung und Lieferung" : b.handover === "pickup" ? "nur Abholung" : "nur Lieferung"}{b.reason ? ` · ${b.reason}` : ""}</span>
              <Button type="button" variant="ghost" size="icon" aria-label="Sperrtag löschen" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SettingsCard({ settings, onChanged }: { settings: Settings; onChanged: () => void }) {
  const tiers = (Array.isArray(settings.tariff_tiers) ? settings.tariff_tiers : []) as { from_km: number; per_km_cents: number }[];
  const first = tiers.find((t) => t.from_km === 0)?.per_km_cents ?? 270;
  const second = tiers.find((t) => t.from_km > 0);
  const [firstRate, setFirstRate] = useState(centsToEuro(first));
  const [threshold, setThreshold] = useState(String(second?.from_km ?? 7));
  const [secondRate, setSecondRate] = useState(centsToEuro(second?.per_km_cents ?? 250));
  const [minFee, setMinFee] = useState(centsToEuro(settings.min_fee_cents));
  const [roundUp, setRoundUp] = useState(centsToEuro(settings.round_up_to_cents));
  const [pickupLead, setPickupLead] = useState(String(settings.pickup_lead_minutes));
  const [deliveryLead, setDeliveryLead] = useState(String(settings.delivery_lead_days));
  const [holdMinutes, setHoldMinutes] = useState(String(settings.hold_minutes));
  const [notify, setNotify] = useState(settings.order_notify_email);
  const hoursInit = (settings.pickup_hours ?? {}) as PickupHours;
  const [hours, setHours] = useState<Record<string, { open: string; close: string } | undefined>>(hoursInit);
  const [windows, setWindows] = useState<DeliveryWindow[]>((Array.isArray(settings.delivery_windows) ? settings.delivery_windows : []) as unknown as DeliveryWindow[]);

  const save = async () => {
    const newTiers = [{ from_km: 0, per_km_cents: euroToCents(firstRate) }, { from_km: Number(threshold), per_km_cents: euroToCents(secondRate) }];
    try {
      parseTariff({ tariff_tiers: newTiers, min_fee_cents: euroToCents(minFee), round_up_to_cents: euroToCents(roundUp) });
    } catch { toast.error("Tarif ungültig (Beträge und Schwelle prüfen)"); return; }
    const cleanHours: PickupHours = {};
    for (const [d, h] of Object.entries(hours)) if (h && /^\d{2}:\d{2}$/.test(h.open) && /^\d{2}:\d{2}$/.test(h.close) && h.open < h.close) cleanHours[d] = h;
    if (windows.length === 0 || windows.some((w) => !/^[a-z0-9-]+$/.test(w.key) || !w.label_de.trim() || !w.label_en.trim())) { toast.error("Lieferfenster: Schlüssel (a-z, 0-9, -) und beide Bezeichnungen angeben"); return; }

    const { error } = await supabase.from("gift_settings").update({
      tariff_tiers: newTiers, min_fee_cents: euroToCents(minFee), round_up_to_cents: euroToCents(roundUp),
      pickup_lead_minutes: Number.parseInt(pickupLead, 10), delivery_lead_days: Number.parseInt(deliveryLead, 10),
      hold_minutes: Number.parseInt(holdMinutes, 10), order_notify_email: notify.trim(), pickup_hours: cleanHours, delivery_windows: windows as unknown as Json,
    }).eq("id", 1);
    if (error) { toast.error("Speichern fehlgeschlagen", { description: error.message }); return; }
    toast.success("Einstellungen gespeichert");
    onChanged();
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-lg">Einstellungen</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <fieldset className="grid gap-3 md:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold">Lieferpreis (Taxitarif, einfache Strecke ab {settings.origin_label})</legend>
          <div><Label htmlFor="t-first">€ je km (bis zur Schwelle)</Label><Input id="t-first" value={firstRate} onChange={(e) => setFirstRate(e.target.value)} inputMode="decimal" /></div>
          <div><Label htmlFor="t-thr">Schwelle (km)</Label><Input id="t-thr" value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" /></div>
          <div><Label htmlFor="t-second">€ je Mehr-km (ab Schwelle, nur die Mehr-km)</Label><Input id="t-second" value={secondRate} onChange={(e) => setSecondRate(e.target.value)} inputMode="decimal" /></div>
          <div><Label htmlFor="t-min">Mindestpreis (€)</Label><Input id="t-min" value={minFee} onChange={(e) => setMinFee(e.target.value)} inputMode="decimal" /></div>
          <div><Label htmlFor="t-round">Aufrunden auf (€)</Label><Input id="t-round" value={roundUp} onChange={(e) => setRoundUp(e.target.value)} inputMode="decimal" /></div>
        </fieldset>

        <fieldset className="grid gap-3 md:grid-cols-4">
          <legend className="mb-1 text-sm font-semibold">Vorlauf und Reservierung</legend>
          <div><Label htmlFor="s-pl">Packzeit Abholung (Min)</Label><Input id="s-pl" value={pickupLead} onChange={(e) => setPickupLead(e.target.value)} inputMode="numeric" /></div>
          <div><Label htmlFor="s-dl">Vorlauf Lieferung (Tage)</Label><Input id="s-dl" value={deliveryLead} onChange={(e) => setDeliveryLead(e.target.value)} inputMode="numeric" /></div>
          <div><Label htmlFor="s-hold">Bestand-Reservierung online (Min)</Label><Input id="s-hold" value={holdMinutes} onChange={(e) => setHoldMinutes(e.target.value)} inputMode="numeric" /></div>
          <div><Label htmlFor="s-mail">Betreiber-Mail bei Bestellung</Label><Input id="s-mail" type="email" value={notify} onChange={(e) => setNotify(e.target.value)} /></div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Abholzeiten je Wochentag (leer = geschlossen; „bis" ist zugleich das Ende der Reservierung bei Zahlung vor Ort)</legend>
          <div className="space-y-2">
            {DAYS.map((name, d) => {
              const h = hours[String(d)];
              return (
                <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-24">{name}</span>
                  <Input aria-label={`${name} von`} className="w-28" type="time" value={h?.open ?? ""} onChange={(e) => setHours({ ...hours, [d]: { open: e.target.value, close: h?.close ?? "" } })} />
                  <span>bis</span>
                  <Input aria-label={`${name} bis`} className="w-28" type="time" value={h?.close ?? ""} onChange={(e) => setHours({ ...hours, [d]: { open: h?.open ?? "", close: e.target.value } })} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setHours({ ...hours, [d]: undefined })}>geschlossen</Button>
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Lieferfenster</legend>
          <div className="space-y-2">
            {windows.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input aria-label="Schlüssel" className="w-32" value={w.key} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                <Input aria-label="Bezeichnung DE" className="w-56" value={w.label_de} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, label_de: e.target.value } : x)))} />
                <Input aria-label="Bezeichnung EN" className="w-56" value={w.label_en} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, label_en: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Fenster entfernen" onClick={() => setWindows(windows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setWindows([...windows, { key: "", label_de: "", label_en: "" }])}>Fenster hinzufügen</Button>
          </div>
        </fieldset>

        <Button type="button" onClick={save}>Einstellungen speichern</Button>
      </CardContent>
    </Card>
  );
}
