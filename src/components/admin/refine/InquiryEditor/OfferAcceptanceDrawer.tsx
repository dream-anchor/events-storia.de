import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, Loader2, Phone, Mail, MapPin, Globe2, Info, ChefHat, Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MenuComposer, type MenuSelection } from "./MenuComposer";

type Via = "phone" | "email" | "onsite" | "online";

interface OfferOption {
  id: string;
  label: string;
  package_name_snapshot?: string | null;
  package_id?: string | null;
  offer_mode?: string | null;
  menu_selection?: MenuSelection | null;
  version?: number | null;
  post_acceptance_adjustment?: boolean | null;
  adjustment_reason?: string | null;
  guest_count: number | null;
  amount_total: number | null;
  is_active: boolean | null;
  is_chosen?: boolean | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  inquiryId: string;
  customerName: string | null;
  preferredDate?: string | null;
  onConfirmed: () => void;
}

const viaMeta: Record<Exclude<Via, "online">, { label: string; icon: typeof Phone }> = {
  phone: { label: "Telefonisch", icon: Phone },
  email: { label: "Per E-Mail", icon: Mail },
  onsite: { label: "Vor Ort / Persönlich", icon: MapPin },
};

function formatEUR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(n));
}

export function OfferAcceptanceDrawer({
  open,
  onClose,
  inquiryId,
  customerName,
  preferredDate,
  onConfirmed,
}: Props) {
  const [via, setVia] = useState<Exclude<Via, "online">>("phone");
  const [confirmName, setConfirmName] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [options, setOptions] = useState<OfferOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [guestCountInput, setGuestCountInput] = useState<string>("");
  const [totalInput, setTotalInput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [menuEditorOpen, setMenuEditorOpen] = useState(false);
  const [draftMenu, setDraftMenu] = useState<MenuSelection | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [savingMenu, setSavingMenu] = useState(false);

  // Optionen laden, wenn Drawer geöffnet wird
  useEffect(() => {
    if (!open) return;
    setConfirmName(customerName?.trim() || "");
    setInternalNote("");
    setVia("phone");
    setOptionsLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from("v2_offer_options")
        .select(
          "id, label, package_name_snapshot, package_id, offer_mode, menu_selection, guest_count, amount_total, is_active, is_chosen, version, sort_order, post_acceptance_adjustment, adjustment_reason",
        )
        .eq("event_id", inquiryId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      setOptionsLoading(false);
      if (error) {
        toast.error("Optionen konnten nicht geladen werden", { description: error.message });
        return;
      }
      const rows = (data as OfferOption[]) || [];
      // Bevorzugt aktive Optionen; wenn keine aktiv, alle anzeigen
      const active = rows.filter((o) => o.is_active !== false);
      const list = active.length ? active : rows;
      setOptions(list);
      const preferred = list.find((o) => o.is_chosen) ?? list[0];
      if (preferred) {
        setSelectedOptionId(preferred.id);
        setGuestCountInput(preferred.guest_count ? String(preferred.guest_count) : "");
        setTotalInput(
          preferred.amount_total !== null && preferred.amount_total !== undefined
            ? String(preferred.amount_total).replace(".", ",")
            : "",
        );
      } else {
        setSelectedOptionId(null);
      }
    })();
  }, [open, inquiryId, customerName]);

  // Wenn Option gewechselt wird: Gäste/Total nachziehen
  useEffect(() => {
    const opt = options.find((o) => o.id === selectedOptionId);
    if (!opt) return;
    setGuestCountInput(opt.guest_count ? String(opt.guest_count) : "");
    setTotalInput(
      opt.amount_total !== null && opt.amount_total !== undefined
        ? String(opt.amount_total).replace(".", ",")
        : "",
    );
  }, [selectedOptionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = useMemo(
    () => options.find((o) => o.id === selectedOptionId) ?? null,
    [options, selectedOptionId],
  );

  // Menü anpassen ist möglich bei allen Menü-/Paket-Modi (nicht bei reinen Text-/E-Mail-Angeboten)
  const canAdjustMenu = !!chosen && chosen.offer_mode !== "email" && chosen.offer_mode !== "text";

  const reloadChosenOption = async () => {
    if (!selectedOptionId) return;
    const { data } = await (supabase as any)
      .from("v2_offer_options")
      .select(
        "id, label, package_name_snapshot, package_id, offer_mode, menu_selection, guest_count, amount_total, is_active, is_chosen, version, sort_order, post_acceptance_adjustment, adjustment_reason",
      )
      .eq("id", selectedOptionId)
      .maybeSingle();
    if (data) {
      setOptions((prev) => prev.map((o) => (o.id === data.id ? (data as OfferOption) : o)));
      if (data.guest_count) setGuestCountInput(String(data.guest_count));
      if (data.amount_total !== null && data.amount_total !== undefined) {
        setTotalInput(String(data.amount_total).replace(".", ","));
      }
    }
  };

  const handleOpenMenuEditor = () => {
    if (!chosen) return;
    setDraftMenu(
      (chosen.menu_selection as MenuSelection) ?? { courses: [], drinks: [] },
    );
    setAdjustmentReason("Telefonisch besprochen");
    setMenuEditorOpen(true);
  };

  const handleSaveMenu = async () => {
    if (!chosen || !draftMenu) return;
    setSavingMenu(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const editorEmail = userRes?.user?.email ?? null;
      const newVersion = (chosen.version ?? 1) + 1;
      const guestCountForUpdate = parsedGuests ?? chosen.guest_count;

      const { error: updateError } = await (supabase as any)
        .from("v2_offer_options")
        .update({
          menu_selection: draftMenu,
          version: newVersion,
          post_acceptance_adjustment: true,
          adjustment_reason: adjustmentReason.trim() || "Bei Annahme angepasst",
          adjusted_at: new Date().toISOString(),
          adjusted_by_email: editorEmail,
          guest_count: guestCountForUpdate,
        })
        .eq("id", chosen.id);
      if (updateError) throw updateError;

      await (supabase as any).from("activity_logs").insert({
        entity_type: "event_inquiry",
        entity_id: inquiryId,
        action: "offer_menu_adjusted_at_acceptance",
        actor_email: editorEmail,
        metadata: {
          option_id: chosen.id,
          option_label: chosen.label,
          old_version: chosen.version ?? 1,
          new_version: newVersion,
          reason: adjustmentReason.trim() || "Bei Annahme angepasst",
          courses: draftMenu.courses?.length ?? 0,
          drinks: draftMenu.drinks?.length ?? 0,
        },
      });

      // Notiz im Drawer ergänzen
      setInternalNote((prev) => {
        const note = `Menü bei Annahme angepasst (V${newVersion}): ${adjustmentReason.trim() || "Telefonisch besprochen"}`;
        return prev ? `${prev}\n${note}` : note;
      });

      await reloadChosenOption();
      toast.success(`Menü angepasst — neue Version V${newVersion} angelegt`);
      setMenuEditorOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSavingMenu(false);
    }
  };

  const parsedGuests = useMemo(() => {
    const n = parseInt(guestCountInput.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [guestCountInput]);

  const parsedTotal = useMemo(() => {
    const n = parseFloat(totalInput.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [totalInput]);

  const guestsChanged = chosen?.guest_count != null && parsedGuests !== chosen.guest_count;
  const totalChanged =
    chosen?.amount_total != null &&
    parsedTotal != null &&
    Number(parsedTotal).toFixed(2) !== Number(chosen.amount_total).toFixed(2);

  const canSubmit =
    !loading &&
    confirmName.trim().length >= 2 &&
    (options.length === 0 || !!selectedOptionId);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("confirm-order", {
        body: {
          inquiry_id: inquiryId,
          selected_option_id: selectedOptionId,
          customer_name: confirmName.trim(),
          agbs_accepted: true,
          terms_accepted: true,
          payment_acknowledged: true,
          via,
          internal_note: internalNote.trim() || null,
          guest_count_override: guestsChanged ? parsedGuests : null,
          amount_total_override: totalChanged ? parsedTotal : null,
        },
      });
      const errMsg =
        (data as { error?: string } | null)?.error || error?.message;
      if (errMsg) throw new Error(errMsg);
      toast.success("Angebot als angenommen markiert", {
        description: "Status & Buchung sind jetzt scharf. Rechnung & Bestätigung kannst du im Tab Details auslösen.",
      });
      onConfirmed();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Annehmen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5 text-foreground" />
            Angebot annehmen
          </SheetTitle>
          <SheetDescription>
            Erfasst die verbindliche Annahme — auch wenn sie telefonisch, per E-Mail
            oder persönlich passiert ist. Rechnung & Kunden-Bestätigung versendest du
            danach manuell (Tab <span className="font-medium">Details → Zahlungen</span>),
            damit telefonisch besprochene Änderungen erst einfließen können.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Annahme-Kanal */}
          <div className="space-y-2">
            <Label>Wie hat der Kunde angenommen?</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(viaMeta) as Array<keyof typeof viaMeta>).map((key) => {
                const meta = viaMeta[key];
                const Icon = meta.icon;
                const active = via === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVia(key)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-xs transition",
                      active
                        ? "border-foreground bg-foreground/5 text-foreground"
                        : "border-border/60 bg-white hover:border-foreground/40 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Option-Auswahl */}
          {optionsLoading ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Angebots-Optionen werden geladen…
            </div>
          ) : options.length === 0 ? (
            <div className="rounded-2xl border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Es wurden keine Angebots-Optionen gefunden. Die Annahme wird ohne
                konkrete Option erfasst.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Welche Option wird angenommen?</Label>
              <RadioGroup
                value={selectedOptionId ?? ""}
                onValueChange={(v) => setSelectedOptionId(v)}
                className="space-y-2"
              >
                {options.map((opt) => {
                  const active = selectedOptionId === opt.id;
                  return (
                    <label
                      key={opt.id}
                      htmlFor={`opt-${opt.id}`}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border px-3 py-3 cursor-pointer transition",
                        active
                          ? "border-foreground bg-foreground/5"
                          : "border-border/60 bg-white hover:border-foreground/40",
                      )}
                    >
                      <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">Option {opt.label}</span>
                          {opt.package_name_snapshot && (
                            <span className="text-xs text-muted-foreground truncate">
                              · {opt.package_name_snapshot}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {opt.guest_count ?? "—"} Gäste · {formatEUR(opt.amount_total)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          {/* Korrekturen */}
          {selectedOptionId && (
            <>
            {canAdjustMenu && (
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-border/60">
                    <ChefHat className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Menü dieser Option</p>
                      {chosen?.post_acceptance_adjustment && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/70 bg-foreground/5 border border-border/60 rounded px-1.5 py-0.5">
                          angepasst V{chosen.version}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Wurde telefonisch etwas anderes besprochen? Menü vor der Annahme anpassen — erzeugt automatisch eine neue interne Version.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenMenuEditor}
                      className="mt-2 h-8 text-xs"
                    >
                      <Pencil className="h-3 w-3 mr-1.5" />
                      Menü anpassen
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acc-guests" className="text-xs">
                  Gästezahl final
                </Label>
                <Input
                  id="acc-guests"
                  inputMode="numeric"
                  value={guestCountInput}
                  onChange={(e) => setGuestCountInput(e.target.value)}
                  placeholder="z.B. 70"
                />
                {guestsChanged && (
                  <p className="text-[11px] text-foreground/70">
                    Abweichend vom Angebot ({chosen?.guest_count ?? "—"})
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-total" className="text-xs">
                  Gesamtbetrag (€)
                </Label>
                <Input
                  id="acc-total"
                  inputMode="decimal"
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  placeholder="z.B. 4900,00"
                />
                {totalChanged && (
                  <p className="text-[11px] text-foreground/70">
                    Abweichend vom Angebot ({formatEUR(chosen?.amount_total)})
                  </p>
                )}
              </div>
            </div>
            </>
          )}

          <Separator />

          {/* Kunden-Name & Notiz */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Name des Kunden (zur Beweissicherung)</Label>
            <Input
              id="acc-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="z.B. Christina Müller"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acc-note" className="flex items-center gap-1.5">
              Interne Notiz
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="acc-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder={
                via === "phone"
                  ? "z.B. Angerufen am " +
                    format(new Date(), "dd.MM.yyyy 'um' HH:mm", { locale: de }) +
                    " — wollte Option A wie besprochen."
                  : "Kurzer Kontext zur Annahme…"
              }
              rows={3}
              className="resize-none"
            />
          </div>

          {preferredDate && (
            <div className="rounded-2xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Veranstaltungsdatum:{" "}
              <span className="text-foreground font-medium">
                {(() => {
                  try {
                    return format(new Date(preferredDate), "dd.MM.yyyy", { locale: de });
                  } catch {
                    return preferredDate;
                  }
                })()}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Angebot annehmen
          </Button>
        </div>
      </SheetContent>

      {/* Menü-Anpassungs-Dialog */}
      <Dialog open={menuEditorOpen} onOpenChange={(v) => !v && !savingMenu && setMenuEditorOpen(false)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Menü anpassen — Option {chosen?.label}
            </DialogTitle>
            <DialogDescription>
              Speichern erzeugt eine neue interne Version (V{(chosen?.version ?? 1) + 1}).
              Das Angebot beim Kunden bleibt unverändert — diese Anpassung dokumentiert
              die telefonisch besprochene Variante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="adj-reason" className="text-xs">Grund der Anpassung</Label>
              <Input
                id="adj-reason"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="z.B. Tiramisu gegen Panna Cotta getauscht"
              />
            </div>

            {chosen && draftMenu && (
              <MenuComposer
                packageId={chosen.package_id ?? null}
                packageName={chosen.package_name_snapshot ?? null}
                guestCount={parsedGuests ?? chosen.guest_count ?? 1}
                menuSelection={draftMenu}
                onMenuSelectionChange={setDraftMenu}
              />
            )}
          </div>

          <DialogFooter className="border-t border-border/40 pt-3">
            <Button variant="ghost" onClick={() => setMenuEditorOpen(false)} disabled={savingMenu}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveMenu} disabled={savingMenu}>
              {savingMenu && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Menü speichern (neue Version)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

export type { Via as OfferAcceptanceVia };
export const OfferAcceptanceOnlineIcon = Globe2;