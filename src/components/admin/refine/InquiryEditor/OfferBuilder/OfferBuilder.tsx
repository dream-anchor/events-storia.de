import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useOfferBuilder } from "./useOfferBuilder";
import { OptionCardGrid } from "./OptionCardGrid";
import { EmailComposer } from "./EmailComposer";
import { SendControls } from "./SendControls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExtendedInquiry, Package, EmailTemplate, OfferHistoryEntry, OfferBuilderOption } from "./types";
import { OPTION_LABELS, createEmptyOption } from "./types";
import { PaymentTermsBlock } from "../PaymentTermsBlock";
import { Skeleton } from "@/components/ui/skeleton";
import { mapAiDraftToOption, type MapAiDraftResult } from "./aiDraftToOption";
import { useAiDraft, type AiDraft } from "@/hooks/useAiDraft";
import { AiDraftCard } from "../AiDraftCard";
import { RequestContextBanner } from "./RequestContextBanner";

export interface OfferBuilderHandle {
  /** Scrollt zum E-Mail-Composer und öffnet ihn; generiert optional KI-Text */
  scrollToEmail: (withGeneration?: boolean) => void;
  /** Entsperrt den OfferBuilder für eine neue Angebotsversion */
  triggerNewVersion: () => void;
  /** Sofort speichern — vor Navigation/Unmount aufrufen */
  flushSave: () => void;
  /** Von Preview-Seite aufgerufen: Proposal-Versand direkt auslösen (ohne AlertDialog). */
  triggerSendProposal: () => Promise<unknown>;
  /** Von Preview-Seite aufgerufen: Final-Offer-Versand direkt auslösen (ohne AlertDialog). */
  triggerSendFinalOffer: () => Promise<void>;
  /** True sobald Hook fertig hydriert ist (kein isLoading mehr). Verhindert Send-Race. */
  isReady: () => boolean;
  /**
   * AI-Draft als Vorschlag in den OfferBuilder laden — NUR lokaler UI-State.
   * Kein Write in `v2_offer_options`, keine Mail/PDF/Stripe/History.
   * Liefert das Mapping-Ergebnis (Warnings, skippedItems) zur UI-Anzeige.
   */
  importFromAiDraft: (draft: AiDraft) => MapAiDraftResult;
}

interface OfferBuilderProps {
  inquiry: ExtendedInquiry;
  packages: Package[];
  templates: EmailTemplate[];
  onSave: () => Promise<void>;
  /** Create-Seite: SendControls ausblenden, da eigene Buttons vorhanden */
  isCreateMode?: boolean;
  /** Callback wenn E-Mail-Text geändert wird (für Create-Modus) */
  onEmailContentChange?: (content: string) => void;
  /** Callback um Inquiry-Felder lokal zu ändern (Auto-Save kümmert sich um Persistenz) */
  onFieldChange?: (field: keyof ExtendedInquiry, value: unknown) => void;
  /** True wenn die zugehörige Kostenübernahme unterschrieben ist (locked_after_signature).
   *  Sperrt signaturrelevante Bereiche (Optionen, Preise, Menü, Zahlungsbedingungen, Send-Buttons). */
  isSignatureLocked?: boolean;
}

export const OfferBuilder = forwardRef<OfferBuilderHandle, OfferBuilderProps>(function OfferBuilder({
  inquiry,
  packages,
  templates,
  onSave,
  isCreateMode = false,
  onEmailContentChange,
  onFieldChange,
  isSignatureLocked = false,
}: OfferBuilderProps, ref) {
  const guestCount = parseInt(inquiry.guest_count || "1") || 1;
  const selectedPackages = Array.isArray(inquiry.selected_packages)
    ? inquiry.selected_packages
    : [];

  const builder = useOfferBuilder({
    inquiryId: inquiry.id,
    guestCount,
    selectedPackages,
    inquiry,
    packages,
  });

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [menuImporterOpen, setMenuImporterOpen] = useState(false);
  const [isGeneratingMenu, setIsGeneratingMenu] = useState(false);

  // --- AI-Draft Import (zentral; gleicher Mapper wie imperative handle) ---
  const { data: aiDraftData } = useAiDraft(inquiry.id);
  const runAiDraftImport = useCallback((draft: AiDraft): MapAiDraftResult => {
    const result = mapAiDraftToOption(draft, {
      guestCount,
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.is_active === false ? { archived_at: new Date().toISOString() } : {}),
      })),
      menuItems: builder.menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        category_name: m.category_name,
      })),
    });
    if (result.option) {
      builder.addAiDraftPreview(result.option);
    }
    return result;
  }, [guestCount, packages, builder.menuItems, builder.addAiDraftPreview]);

  // --- AI-Draft Karte — einzige Stelle zur Übernahme des KI-Entwurfs ---
  // Wrapper-Callback: konvertiert MapAiDraftResult → AiDraftPrefillResult-Form,
  // damit AiDraftCard die Toasts/Warnings einheitlich anzeigt.
  const handlePrefillFromAiDraft = useCallback((draft: AiDraft) => {
    const result = runAiDraftImport(draft);
    return {
      ok: !!result.option,
      warnings: result.warnings,
      skippedItems: result.skippedItems,
    };
  }, [runAiDraftImport]);

  const aiDraftCard = aiDraftData?.draft && !builder.isLoading ? (
    <AiDraftCard
      inquiryId={inquiry.id}
      onPrefillFromAiDraft={handlePrefillFromAiDraft}
    />
  ) : null;

  // --- Mehrere Restaurant-Menüs als neue Optionen anlegen ---
  const handleImportMultiple = useCallback((partials: Partial<OfferBuilderOption>[]) => {
    builder.importOptions(partials);
    toast.success(
      partials.length > 1
        ? `${partials.length} Menüs importiert`
        : 'Menü als Option angelegt'
    );
  }, [builder.importOptions]);

  // --- E-Mail Draft (lokal, nicht im Hook) ---
  const [emailDraft, setEmailDraft] = useState(inquiry.email_draft || "");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  // Initial-Sync: wenn inquiry.email_draft nach dem Mount nachgeladen wird
  // (z.B. weil die DB-Query noch lief als die Component mountete), einmalig
  // in den lokalen State uebernehmen. Danach gewinnt der lokale State
  // (Auto-save wuerde sonst User-Input wegloeschen bei jedem Parent-Rerender).
  const emailDraftInitialSyncedRef = useRef(false);
  useEffect(() => {
    if (emailDraftInitialSyncedRef.current) return;
    const incoming = inquiry.email_draft;
    if (typeof incoming === 'string' && incoming.length > 0) {
      setEmailDraft(incoming);
      emailDraftInitialSyncedRef.current = true;
    }
  }, [inquiry.email_draft]);

  // --- CX: Erkennung lokaler Änderungen nach Versand ---
  // Vergleicht aktuelle Options mit dem LETZTEN versendeten Snapshot
  // (aus inquiry_offer_history). Das ist robust ueber Reloads hinweg:
  // solange in der DB nichts versendet wurde, bleibt die amber Strip sichtbar.
  const hasLocalChangesAfterSend = useMemo(() => {
    // Nur wenn das Angebot bereits versendet wurde
    if (!inquiry.offer_sent_at) return false;
    if (builder.isLoading) return false;
    if (builder.history.length === 0) return false;

    // Der neueste History-Eintrag enthaelt den Snapshot der zuletzt versendeten Version.
    // history ist bereits nach version DESC sortiert im Hook ("order by version DESC").
    const lastSent = builder.history[0];
    if (!lastSent || !lastSent.optionsSnapshot) return false;

    // Serialisiere nur die semantisch relevanten Felder
    const serialize = (opts: OfferBuilderOption[]) => JSON.stringify(
      opts.map(o => ({
        packageId: o.packageId,
        offerMode: o.offerMode,
        guestCount: o.guestCount,
        totalAmount: o.totalAmount,
        menuSelection: o.menuSelection,
        isActive: o.isActive,
      }))
    );

    return serialize(builder.options) !== serialize(lastSent.optionsSnapshot);
  }, [inquiry.offer_sent_at, builder.options, builder.history, builder.isLoading]);

  const handleEmailDraftChange = useCallback((content: string) => {
    setEmailDraft(content);
    onEmailContentChange?.(content);
  }, [onEmailContentChange]);

  // E-Mail-Sektion ist IMMER sichtbar (CX-Refactor: WYSIWYG-Prinzip,
  // Edit-Seite hat alle Edit-Möglichkeiten direkt verfügbar).
  const emailSectionRef = useRef<HTMLDivElement>(null);

  // --- E-Mail generieren via Edge Function ---
  const handleGenerateEmail = useCallback(async () => {
    setIsGeneratingEmail(true);
    try {
      // Aktuellen Angebotsstand erzwingen, damit die KI immer mit dem
      // sichtbaren Stand arbeitet (Mengen, Positionen, Rabatt). Ohne
      // flush würde die Edge Function aus der DB lesen und ggf. veraltete
      // Werte erhalten.
      try {
        await builder.flushSave();
      } catch (flushErr) {
        console.warn('[OfferBuilder] flushSave vor KI-Generierung fehlgeschlagen:', flushErr);
      }
      const { data, error } = await supabase.functions.invoke(
        "generate-inquiry-email",
        {
          body: {
            inquiryId: inquiry.id,
            phase: builder.offerPhase === "draft" || builder.offerPhase === "proposal_sent"
              ? "proposal"
              : "final",
          },
        }
      );

      if (error) throw error;
      if (data?.email) {
        handleEmailDraftChange(data.email);
        // Belt-and-suspenders: email_draft direkt in die DB schreiben, falls der
        // Auto-Save-Cascade nicht greift. Zusätzlich Public Offer synchronisieren:
        //  1) Die aktuelle Version in `inquiry_offer_history` mit dem neuen Anschreiben
        //     aktualisieren — die public RPC liest IMMER zuerst die latest history version.
        //  2) Den Übersetzungs-Cache (`v2_events.email_content_translations`) leeren,
        //     damit EN/IT/FR neu erzeugt werden.
        try {
          await supabase
            .from('event_inquiries')
            .update({ email_draft: data.email })
            .eq('id', inquiry.id);

          const { data: histRow } = await supabase
            .from('inquiry_offer_history')
            .select('id, version')
            .eq('inquiry_id', inquiry.id)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();
          if ((histRow as { id?: string } | null)?.id) {
            await supabase
              .from('inquiry_offer_history')
              .update({ email_content: data.email } as Record<string, unknown>)
              .eq('id', (histRow as { id: string }).id);
          }

          await supabase
            .from('v2_events')
            .update({ email_content_translations: {} } as Record<string, unknown>)
            .eq('id', inquiry.id);
        } catch (persistErr) {
          console.warn('[OfferBuilder] public-offer sync failed:', persistErr);
        }
        toast.success("E-Mail generiert");
      }
    } catch (err) {
      console.error("Email generation error:", err);
      toast.error("Fehler beim Generieren der E-Mail");
    } finally {
      setIsGeneratingEmail(false);
    }
  }, [inquiry.id, builder.offerPhase, builder.flushSave, handleEmailDraftChange]);

  // --- Neue Version erstellen ---
  const handleUnlock = useCallback(async () => {
    setIsUnlocking(true);
    await builder.unlockForNewVersion();
    setIsUnlocking(false);
  }, [builder.unlockForNewVersion]);

  // --- KI-Menüvorschlag (3 Varianten Low/Medium/High in nächste freie Optionen) ---
  const handleGenerateMenuSuggestion = useCallback(async () => {
    console.log("[OfferBuilder] KI-Menüvorschlag: Klick erhalten", { inquiryId: inquiry.id });
    setIsGeneratingMenu(true);
    try {
      console.log("[OfferBuilder] KI-Menüvorschlag: invoke generate-menu-suggestion …");
      const { data, error } = await supabase.functions.invoke(
        "generate-menu-suggestion",
        { body: { inquiryId: inquiry.id } },
      );
      console.log("[OfferBuilder] KI-Menüvorschlag: Antwort", { hasError: Boolean(error), variantsCount: (data?.variants as unknown[] | undefined)?.length });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      type Variant = {
        tier: "low" | "medium" | "high";
        mode: "paket" | "menu";
        reasoning?: string;
        estimatedPricePerPerson?: number | null;
        packageId?: string;
        packageName?: string;
        packagePricePerPerson?: number | null;
        courses?: Array<{
          courseType: string;
          courseLabel: string;
          items: Array<{
            id: string;
            rawId: string;
            name: string;
            description: string | null;
            price: number | null;
          }>;
        }>;
      };

      const variants = (data?.variants as Variant[] | undefined) ?? [];
      const overallReasoning = (data?.overallReasoning as string | undefined) ?? "";

      if (variants.length === 0) {
        toast.error("KI lieferte keine Varianten");
        return;
      }

      const tierLabel: Record<Variant["tier"], string> = {
        low: "Low",
        medium: "Medium",
        high: "High",
      };

      // ---------------------------------------------------------------
      // 1) Ziel-Options ermitteln (stabile IDs, kein stale-Closure-Risk)
      // ---------------------------------------------------------------
      const isEmpty = (o: typeof builder.options[number]) =>
        o.offerMode === "unselected" ||
        (!o.packageId &&
          o.offerMode !== "paket" &&
          (o.menuSelection?.courses?.length ?? 0) === 0 &&
          (o.menuSelection?.drinks?.length ?? 0) === 0);

      const freeExisting = builder.options.filter(isEmpty);
      const targets: Array<{ id: string; label: string; tier: Variant["tier"]; variant: Variant }> = [];
      const skipped: Variant["tier"][] = [];
      let currentCount = builder.options.length;

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const existing = freeExisting[i];
        if (existing) {
          targets.push({ id: existing.id, label: existing.optionLabel, tier: v.tier, variant: v });
          continue;
        }
        if (currentCount >= 5) {
          skipped.push(v.tier);
          continue;
        }
        const newId = builder.addOption(v.mode === "paket" ? "paket" : "menu");
        if (!newId) {
          skipped.push(v.tier);
          continue;
        }
        currentCount += 1;
        // Label des neu erzeugten Slots: erste freie Position nach den existierenden
        const usedLabels = new Set([
          ...builder.options.map((o) => o.optionLabel),
          ...targets.map((t) => t.label),
        ]);
        const nextLabel = ["A", "B", "C", "D", "E"].find((l) => !usedLabels.has(l)) ?? "?";
        targets.push({ id: newId, label: nextLabel, tier: v.tier, variant: v });
      }

      console.log("[OfferBuilder] KI-Menüvorschlag: Ziele bestimmt", {
        targets: targets.map((t) => ({ id: t.id, label: t.label, tier: t.tier })),
        skipped,
      });

      // ---------------------------------------------------------------
      // 2) Inhalte schreiben — alle IDs sind jetzt stabil bekannt
      // ---------------------------------------------------------------
      const placed: string[] = [];

      // Equipment & Personal aus der ersten Option mit Eintraegen als
      // gemeinsame Basis übernehmen — Kundenwunsch (Geschirr, Personal etc.)
      // muss in allen KI-Varianten konsistent gespiegelt werden.
      const sharedEquipment =
        builder.options
          .map((o) => o.menuSelection?.equipment ?? [])
          .find((arr) => arr && arr.length > 0) ?? [];
      const sharedStaff =
        builder.options
          .map((o) => o.menuSelection?.staff ?? [])
          .find((arr) => arr && arr.length > 0) ?? [];
      const cloneList = <T,>(arr: T[]): T[] => arr.map((e) => ({ ...e }));

      for (const t of targets) {
        const v = t.variant;
        const tableNote = `KI · ${tierLabel[v.tier]} — ${v.reasoning ?? ""}`.trim();

        const existing = builder.options.find((o) => o.id === t.id);
        const mergedEquipment =
          existing?.menuSelection?.equipment && existing.menuSelection.equipment.length > 0
            ? existing.menuSelection.equipment
            : cloneList(sharedEquipment);
        const mergedStaff =
          existing?.menuSelection?.staff && existing.menuSelection.staff.length > 0
            ? existing.menuSelection.staff
            : cloneList(sharedStaff);

        if (v.mode === "paket" && v.packageId) {
          builder.updateOption(t.id, {
            offerMode: "paket",
            packageId: v.packageId,
            packageName: v.packageName ?? "",
            budgetPerPerson: v.packagePricePerPerson ?? v.estimatedPricePerPerson ?? null,
            tableNote,
            menuSelection: {
              ...(existing?.menuSelection ?? { courses: [], drinks: [] }),
              equipment: mergedEquipment,
              staff: mergedStaff,
            },
          });
        } else if (v.mode === "menu" && Array.isArray(v.courses)) {
          const courses = v.courses.flatMap((c) =>
            c.items.map((it) => ({
              courseType: c.courseType as
                | "starter"
                | "pasta"
                | "main"
                | "main_fish"
                | "main_meat"
                | "dessert"
                | "fingerfood"
                | "vegetarisch"
                | "vegan",
              courseLabel: c.courseLabel,
              itemId: it.id,
              itemName: it.name,
              itemDescription: it.description,
              itemSource: "catering" as const,
              isCustom: false,
              overridePrice: it.price ?? null,
              quantity: 1,
              priceMode: "per_person" as const,
            })),
          );
          builder.updateOption(t.id, {
            offerMode: "menu",
            packageId: null,
            packageName: "",
            budgetPerPerson: v.estimatedPricePerPerson ?? null,
            tableNote,
            menuSelection: {
              ...(existing?.menuSelection ?? {}),
              courses,
              drinks: existing?.menuSelection?.drinks ?? [],
              equipment: mergedEquipment,
              staff: mergedStaff,
            },
          });
        } else {
          skipped.push(v.tier);
          continue;
        }

        placed.push(`${t.label}: ${tierLabel[v.tier]}`);
      }

      if (placed.length === 0) {
        toast.error("Keine Variante konnte übernommen werden");
        return;
      }

      const headline = overallReasoning || "KI-Varianten übernommen";
      const details = placed.join(" · ");
      toast.success(`${headline}\n${details}`, { duration: 8000 });

      if (skipped.length > 0) {
        toast.warning(
          `${skipped.length} Variante(n) übersprungen — alle 5 Optionen sind belegt.`,
          { duration: 6000 },
        );
      }
    } catch (err) {
      console.error("[OfferBuilder] KI-Menüvorschlag fehlgeschlagen:", err);
      toast.error("KI-Menüvorschlag fehlgeschlagen");
    } finally {
      setIsGeneratingMenu(false);
    }
  }, [inquiry.id, builder.options, builder.addOption, builder.updateOption]);

  // --- Exponierten Handle für Parent (SmartInquiryEditor) ---
  useImperativeHandle(ref, () => ({
    scrollToEmail: (withGeneration = true) => {
      if (withGeneration && builder.activeOptions.length > 0) {
        handleGenerateEmail();
      }
      setTimeout(() => {
        emailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    },
    triggerNewVersion: () => {
      handleUnlock();
    },
    flushSave: () => {
      builder.flushSave();
    },
    triggerSendProposal: async () => {
      return await builder.sendProposal(emailDraft);
    },
    triggerSendFinalOffer: async () => {
      await builder.sendFinalOffer(emailDraft);
    },
    isReady: () => !builder.isLoading,
    importFromAiDraft: (draft) => runAiDraftImport(draft),
  }));

  // --- Loading ---
  if (builder.isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300" aria-busy="true" aria-label="Angebot wird geladen">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Versions-Info — grün wenn synchron, amber wenn lokale Änderungen */}
      {inquiry.offer_sent_at && !hasLocalChangesAfterSend && (
        <div className="rounded-xl bg-neutral-50 border border-border/40 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="h-1.5 w-1.5 rounded-full bg-neutral-400 shrink-0" />
            <span className="text-neutral-600 font-medium">
              Version {builder.currentVersion} gesendet
              {inquiry.offer_sent_at && ` am ${format(parseISO(inquiry.offer_sent_at), "d. MMM yyyy", { locale: de })}`}
            </span>
            <span className="text-neutral-400">—</span>
            <span className="text-neutral-500">
              Synchron mit Kunde
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed pl-4">
            ✏️ Zum Bearbeiten einfach Optionen, Preise oder Menü unten anpassen. Änderungen werden automatisch als neue Version gespeichert.
          </p>
        </div>
      )}

      {inquiry.offer_sent_at && hasLocalChangesAfterSend && (
        <div className="rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-amber-800 font-medium">
              Entwurf — Version {builder.currentVersion + 1}
            </span>
          </div>
          <p className="text-[11px] text-amber-700/80 leading-relaxed pl-4">
            Du hast Änderungen vorgenommen. Der Kunde sieht noch Version {builder.currentVersion}
            {inquiry.offer_sent_at && ` vom ${format(parseISO(inquiry.offer_sent_at), "d. MMM yyyy", { locale: de })}`}
            . Klicke unten auf „Vorschau anzeigen" um die neue Version zu senden.
          </p>
        </div>
      )}

      {/* KI-Entwurf des Kunden — einzige sichtbare Stelle. Übernahme ist rein lokal,
          keine DB-Writes / Mail / PDF / Stripe vor manuellem Speichern. */}
      {aiDraftCard}

      {/* Header — Save-Fehler nur bei Problemen anzeigen */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">
          Angebot konfigurieren
          {builder.currentVersion > 1 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Version {builder.currentVersion})
            </span>
          )}
        </h2>
      </div>

      {/* Erklärtext: jede Option ist unabhängig */}
      <p className="text-xs text-muted-foreground -mt-4">
        Erstelle bis zu fünf Varianten (A–E) für deinen Kunden. Jede Option kann unabhängig
        ein Restaurant-Menü, Eigenes Menü, Paket oder nur eine E-Mail sein.
      </p>

      {/* Anfrage-Kontext — zeigt Quelle, angefragtes Paket und Originalnachricht direkt
          über dem Optionen-Grid. Erlaubt 1-Klick-Übernahme des angefragten Pakets in Option A. */}
      <RequestContextBanner
        inquiry={inquiry}
        packages={packages}
        disabled={isSignatureLocked}
        onGenerateMenuSuggestion={handleGenerateMenuSuggestion}
        isGeneratingSuggestion={isGeneratingMenu}
        onApplyPackageToOptionA={(packageId, packageName) => {
          const optionA = builder.options.find((o) => o.optionLabel === "A");
          if (!optionA) return;
          const isEmptyA =
            !optionA.packageId &&
            optionA.offerMode !== "paket" &&
            (optionA.menuSelection?.courses?.length ?? 0) === 0;
          if (!isEmptyA) {
            toast.info("Option A enthält bereits Inhalte — bitte manuell anpassen.");
            return;
          }
          builder.updateOption(optionA.id, {
            offerMode: "paket",
            packageId,
            packageName,
          });
          toast.success(`Paket „${packageName}" in Option A übernommen.`);
        }}
      />

      {/* 3. Options-Grid — pro Option wird der Modus innerhalb der Karte gewählt */}
      <div className={isSignatureLocked ? "pointer-events-none opacity-60" : undefined} aria-disabled={isSignatureLocked || undefined}>
      <OptionCardGrid
        options={builder.options}
        packages={packages}
        menuItems={builder.menuItems}
        packageConfigs={builder.packageConfigs}
        onUpdateOption={builder.updateOption}
        onRemoveOption={builder.removeOption}
        onResetOption={builder.resetOption}
        onToggleActive={builder.toggleOptionActive}
        onAddOption={builder.addOption}
        onImportMultiple={handleImportMultiple}
        isLocked={isSignatureLocked}
        currentVersion={builder.currentVersion}
        guestCount={guestCount}
        menuImporterOpen={menuImporterOpen}
        onMenuImporterOpenChange={setMenuImporterOpen}
        customerResponse={builder.offerPhase === "customer_responded" ? builder.customerResponse : null}
      />
      </div>

      {/* 4. Zahlungs-Konditionen — pro Inquiry editierbar */}
      {onFieldChange && (
        <PaymentTermsBlock
          depositPercent={inquiry.deposit_percent}
          depositAmount={inquiry.deposit_amount}
          depositDueDays={inquiry.deposit_due_days}
          offerValidityDays={inquiry.offer_validity_days}
          paymentMethod={inquiry.payment_method}
          invoiceDueDays={inquiry.invoice_due_days}
          depositMethod={(inquiry as any).deposit_method}
          balanceMethod={(inquiry as any).balance_method}
          balanceDueDaysBeforeEvent={(inquiry as any).balance_due_days_before_event}
          onChange={(field, value) => onFieldChange(field, value)}
          isReadOnly={inquiry.status === 'confirmed' || isSignatureLocked}
        />
      )}

      {/* 5. E-Mail Composer — IMMER offen (CX-Refactor: Anschreiben ist Pflichtbestandteil) */}
      <div ref={emailSectionRef}>
        <EmailComposer
          emailDraft={emailDraft}
          onChange={handleEmailDraftChange}
          templates={templates}
          isGenerating={isGeneratingEmail}
          onGenerate={handleGenerateEmail}
          activeOptionsCount={builder.activeOptions.length}
          customerName={inquiry.contact_name}
          eventDate={inquiry.preferred_date || undefined}
          guestCount={inquiry.guest_count || undefined}
          companyName={inquiry.company_name || undefined}
          eventType={inquiry.event_type || undefined}
          roomSelection={inquiry.room_selection || undefined}
          timeSlot={inquiry.time_slot || undefined}
          activeOptions={builder.activeOptions}
          menuItems={builder.menuItems}
          isLocked={builder.isLocked}
        />
      </div>

      {/* 5. Send Controls — nicht auf der Create-Seite (eigene Buttons im DraftPanel) */}
      {!isCreateMode && (
        isSignatureLocked ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            Nach unterschriebener Kostenübernahme bitte neue Angebotsversion erstellen.
            Das aktuelle Angebot kann nicht erneut versendet oder verändert werden.
          </div>
        ) : (
        <SendControls
        offerPhase={builder.offerPhase}
        emailDraft={emailDraft}
        activeOptionsCount={builder.activeOptions.length}
        isSending={builder.isSaving}
        onSendProposal={builder.sendProposal}
        onSendFinalOffer={builder.sendFinalOffer}
        hasHistory={builder.history.length > 0}
        isNewVersionAfterSend={hasLocalChangesAfterSend}
        currentVersion={builder.currentVersion}
        inquiryId={inquiry.id}
        recipientName={inquiry.contact_name}
        recipientEmail={inquiry.email}
        />
        )
      )}

      {/* Versionshistorie entfernt — wird in Timeline & Aktivitäten angezeigt */}
    </div>
  );
});
