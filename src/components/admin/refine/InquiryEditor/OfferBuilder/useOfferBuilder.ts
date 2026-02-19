import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateEventPackagePrice } from "@/lib/eventPricing";
import { useCombinedMenuItems } from "@/hooks/useCombinedMenuItems";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import type { CourseConfig, DrinkConfig, DrinkOption } from "../MenuComposer/types";
import {
  OfferBuilderOption,
  OfferPhase,
  OfferMode,
  OfferHistoryEntry,
  CustomerResponse,
  UseOfferBuilderReturn,
  OPTION_LABELS,
  createEmptyOption,
} from "./types";
import type { ExtendedInquiry, SelectedPackage } from "../types";

/** Alte DB-Werte auf neue 3-Modi-Keys mappen */
function mapLegacyMode(dbMode: string | null | undefined): OfferMode {
  switch (dbMode) {
    case 'menu': return 'menu';
    case 'paket': return 'paket';
    case 'email': return 'email';
    case 'fest_menu':
    case 'full_menu':
    case 'teil_menu':
    case 'partial_menu':
      return 'menu';
    case 'a_la_carte':
    case 'alacarte':
      return 'email';
    default:
      return 'menu';
  }
}

// --- Activity Logging (migriert aus useMultiOfferState) ---
const logActivity = async (
  entityId: string,
  action: string,
  metadata?: Record<string, unknown>
) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert([{
      entity_type: 'event_inquiry',
      entity_id: entityId,
      action,
      actor_id: userData.user?.id,
      actor_email: userData.user?.email,
      metadata: metadata as never,
    }]);
  } catch (error) {
    console.error('Activity log error:', error);
  }
};

// --- Props ---
interface UseOfferBuilderProps {
  inquiryId: string;
  guestCount: number;
  selectedPackages?: SelectedPackage[];
  inquiry: ExtendedInquiry;
  packages?: Array<{ id: string; name: string; price: number; price_per_person: boolean; package_type?: string }>;
}

export function useOfferBuilder({
  inquiryId,
  guestCount,
  selectedPackages,
  inquiry,
  packages: packagesProp,
}: UseOfferBuilderProps): UseOfferBuilderReturn {
  // --- Core State (migriert aus useMultiOfferState) ---
  const [options, setOptions] = useState<OfferBuilderOption[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [history, setHistory] = useState<OfferHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs für Props die im Load-Effect gebraucht werden (kein Re-Trigger)
  const guestCountRef = useRef(guestCount);
  const selectedPackagesRef = useRef(selectedPackages);
  const inquiryRef = useRef(inquiry);
  guestCountRef.current = guestCount;
  selectedPackagesRef.current = selectedPackages;
  inquiryRef.current = inquiry;

  // --- Neue State ---
  const [offerPhase, setOfferPhase] = useState<OfferPhase>('draft');
  const [customerResponse, setCustomerResponse] = useState<CustomerResponse | null>(null);

  // --- Menu Items (konsolidiert aus useCombinedMenuItems) ---
  const menuItemsQuery = useCombinedMenuItems();

  // --- Package Configs Cache (konsolidiert aus usePackageMenuConfig) ---
  const [packageConfigs, setPackageConfigs] = useState<
    Record<string, { courses: CourseConfig[]; drinks: DrinkConfig[] }>
  >({});

  // Lade Configs für alle verwendeten Pakete
  const packageIdsInUse = useMemo(
    () => [...new Set(options.filter(o => o.packageId).map(o => o.packageId!))],
    [options]
  );

  useEffect(() => {
    const fetchMissingConfigs = async () => {
      const missingIds = packageIdsInUse.filter(id => !packageConfigs[id]);
      if (missingIds.length === 0) return;

      for (const pkgId of missingIds) {
        try {
          const [courseRes, drinkRes] = await Promise.all([
            supabase
              .from('package_course_config')
              .select('*')
              .eq('package_id', pkgId)
              .order('sort_order'),
            supabase
              .from('package_drink_config')
              .select('*')
              .eq('package_id', pkgId)
              .order('sort_order'),
          ]);

          if (courseRes.error) throw courseRes.error;
          if (drinkRes.error) throw drinkRes.error;

          const courses: CourseConfig[] = (courseRes.data || []).map(row => ({
            id: row.id,
            package_id: row.package_id,
            course_type: row.course_type as CourseConfig['course_type'],
            course_label: row.course_label,
            course_label_en: row.course_label_en,
            is_required: row.is_required ?? true,
            allowed_sources: (row.allowed_sources || []) as CourseConfig['allowed_sources'],
            allowed_categories: (row.allowed_categories || []) as string[],
            is_custom_item: row.is_custom_item ?? false,
            custom_item_name: row.custom_item_name,
            custom_item_name_en: row.custom_item_name_en,
            custom_item_description: row.custom_item_description,
            sort_order: row.sort_order ?? 0,
          }));

          const drinks: DrinkConfig[] = (drinkRes.data || []).map(row => {
            let parsedOptions: DrinkOption[] | string[] = [];
            if (row.options) {
              if (Array.isArray(row.options)) {
                parsedOptions = row.options as unknown as DrinkOption[] | string[];
              } else if (typeof row.options === 'string') {
                try { parsedOptions = JSON.parse(row.options); } catch { parsedOptions = []; }
              }
            }
            return {
              id: row.id,
              package_id: row.package_id,
              drink_group: row.drink_group as DrinkConfig['drink_group'],
              drink_label: row.drink_label,
              drink_label_en: row.drink_label_en,
              options: parsedOptions,
              quantity_per_person: row.quantity_per_person,
              quantity_label: row.quantity_label,
              quantity_label_en: row.quantity_label_en,
              is_choice: row.is_choice ?? false,
              is_included: row.is_included ?? true,
              sort_order: row.sort_order ?? 0,
            };
          });

          setPackageConfigs(prev => ({ ...prev, [pkgId]: { courses, drinks } }));
        } catch (err) {
          console.error(`Error fetching config for package ${pkgId}:`, err);
        }
      }
    };

    fetchMissingConfigs();
  }, [packageIdsInUse, packageConfigs]);

  // =================================================================
  // LOAD — Options, Phase, History, Customer Response
  // (migriert aus useMultiOfferState.loadOptions + neue Felder)
  // =================================================================
  useEffect(() => {
    const loadAll = async () => {
      if (!inquiryId) return;
      setIsLoading(true);

      try {
        // 1. Options laden
        const { data: optionsData, error: optionsError } = await supabase
          .from("inquiry_offer_options")
          .select("*")
          .eq("inquiry_id", inquiryId)
          .order("sort_order", { ascending: true });

        if (optionsError) throw optionsError;

        if (optionsData && optionsData.length > 0) {
          const mappedOptions: OfferBuilderOption[] = optionsData.map((opt) => ({
            id: opt.id,
            packageId: opt.package_id,
            packageName: '',
            optionLabel: opt.option_label,
            offerMode: mapLegacyMode((opt as Record<string, unknown>).offer_mode as string),
            isActive: opt.is_active ?? true,
            guestCount: opt.guest_count,
            menuSelection: (opt.menu_selection as unknown as OfferBuilderOption['menuSelection']) || { courses: [], drinks: [] },
            totalAmount: Number(opt.total_amount),
            stripePaymentLinkId: opt.stripe_payment_link_id,
            stripePaymentLinkUrl: opt.stripe_payment_link_url,
            offerVersion: opt.offer_version,
            createdInVersion: (opt as Record<string, unknown>).created_in_version as number | undefined,
            sortOrder: opt.sort_order || 0,
            budgetPerPerson: null,
            attachMenu: false,
            tableNote: null,
          }));
          setOptions(mappedOptions);
          setCurrentVersion(Math.max(...mappedOptions.map(o => o.offerVersion)));
        } else {
          // Erstelle initiale Option A
          const customerPackage = selectedPackagesRef.current?.[0];
          const customerPackageId = customerPackage?.id || null;
          let initialTotal = 0;
          let initialPackageName = '';

          if (customerPackage) {
            initialPackageName = customerPackage.name || '';
            if (customerPackage.price) {
              initialTotal = calculateEventPackagePrice(
                customerPackageId!,
                customerPackage.price,
                guestCountRef.current,
                !!customerPackage.pricePerPerson
              );
            }
          }

          setOptions([{
            id: crypto.randomUUID(),
            ...createEmptyOption('A', guestCountRef.current),
            packageId: customerPackageId,
            packageName: initialPackageName,
            totalAmount: initialTotal,
          }]);
        }

        // 2. History laden
        const { data: historyData } = await supabase
          .from("inquiry_offer_history")
          .select("*")
          .eq("inquiry_id", inquiryId)
          .order("version", { ascending: false });

        if (historyData) {
          setHistory(historyData.map(h => ({
            id: h.id,
            version: h.version,
            sentAt: h.sent_at,
            sentBy: h.sent_by,
            emailContent: h.email_content,
            pdfUrl: h.pdf_url,
            optionsSnapshot: (h.options_snapshot as unknown as OfferBuilderOption[]) || [],
          })));
        }

        // 3. offer_phase aus inquiry lesen
        const phase = (inquiryRef.current as Record<string, unknown>).offer_phase as string | undefined;
        setOfferPhase((phase as OfferPhase) || 'draft');

        // 4. Customer Response laden
        const { data: responseData } = await supabase
          .from("offer_customer_responses")
          .select("*")
          .eq("inquiry_id", inquiryId)
          .order("responded_at", { ascending: false })
          .limit(1);

        if (responseData && responseData.length > 0) {
          const r = responseData[0];
          setCustomerResponse({
            id: r.id,
            selectedOptionId: r.selected_option_id,
            customerNotes: r.customer_notes,
            respondedAt: r.responded_at ?? new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Error loading offer data:", error);
        toast.error("Fehler beim Laden der Angebotsdaten");
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
  // Nur bei inquiryId-Wechsel laden. guestCount/inquiry/selectedPackages via Refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  // =================================================================
  // AUTO-SAVE — 800ms Debounce (exakt aus useMultiOfferState)
  // =================================================================
  useEffect(() => {
    if (isLoading || isInitialLoad.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUserEmail = userData.user?.email;

        // Delete + Re-Insert Pattern (bewährt aus useMultiOfferState)
        await supabase
          .from("inquiry_offer_options")
          .delete()
          .eq("inquiry_id", inquiryId);

        for (const opt of options) {
          await (supabase as any)
            .from("inquiry_offer_options")
            .insert({
              id: opt.id,
              inquiry_id: inquiryId,
              offer_version: currentVersion,
              package_id: opt.packageId,
              option_label: opt.optionLabel,
              offer_mode: opt.offerMode,
              guest_count: opt.guestCount,
              menu_selection: opt.menuSelection,
              total_amount: opt.totalAmount,
              stripe_payment_link_id: opt.stripePaymentLinkId,
              stripe_payment_link_url: opt.stripePaymentLinkUrl,
              is_active: opt.isActive,
              sort_order: opt.sortOrder,
            });
        }

        if (currentUserEmail) {
          await supabase
            .from("event_inquiries")
            .update({
              last_edited_by: currentUserEmail,
              last_edited_at: new Date().toISOString(),
            })
            .eq("id", inquiryId);
        }

        const activeOpts = options.filter(o => o.isActive);
        await logActivity(inquiryId, 'offer_updated', {
          optionCount: activeOpts.length,
          summary: activeOpts.map(o =>
            `Option ${o.optionLabel} (${o.offerMode}): ${o.packageName || 'Kein Paket'} (${o.guestCount} Gäste, ${o.totalAmount.toFixed(2)} €)`
          ).join(', '),
          version: currentVersion,
        });

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error("Auto-save error:", error);
        setSaveStatus('error');
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [options, inquiryId, currentVersion, isLoading]);

  // Initial-Load Guard (exakt aus useMultiOfferState)
  useEffect(() => {
    if (!isLoading && isInitialLoad.current) {
      setTimeout(() => { isInitialLoad.current = false; }, 100);
    }
  }, [isLoading]);

  // =================================================================
  // TOTAL-AMOUNT RECALC — berechnet Preis pro Option automatisch
  // =================================================================
  const priceRecalcRef = useRef(false);

  useEffect(() => {
    if (isLoading || !packagesProp?.length) return;

    setOptions(prev => {
      let changed = false;
      const updated = prev.map(opt => {
        // Menü-Modus: Preis wird manuell gesetzt (kein Auto-Calc)
        if (opt.offerMode === 'menu') return opt;

        // Paket-Modus: Preis aus Paket-Kalkulation
        if (!opt.packageId) return opt;
        const pkg = packagesProp.find(p => p.id === opt.packageId);
        if (!pkg) return opt;

        const locationPrice = calculateEventPackagePrice(
          pkg.id, pkg.price, opt.guestCount, !!pkg.price_per_person
        );
        const newTotal = locationPrice;

        if (Math.abs(opt.totalAmount - newTotal) < 0.01) return opt;
        changed = true;
        return { ...opt, totalAmount: newTotal };
      });

      if (!changed) return prev;
      priceRecalcRef.current = true;
      return updated;
    });
  }, [isLoading, packagesProp, options.map(o => `${o.packageId}:${o.guestCount}:${o.budgetPerPerson}:${o.offerMode}:${o.menuSelection.winePairingPrice}`).join(',')]);

  // =================================================================
  // OPTION CRUD (migriert aus useMultiOfferState)
  // =================================================================
  const addOption = useCallback((mode: OfferMode = 'menu') => {
    const usedLabels = options.map(o => o.optionLabel);
    const nextLabel = OPTION_LABELS.find(l => !usedLabels.includes(l));

    if (!nextLabel) {
      toast.warning("Maximale Anzahl an Optionen erreicht (5)");
      return;
    }

    setOptions(prev => [...prev, {
      id: crypto.randomUUID(),
      ...createEmptyOption(nextLabel, guestCount, mode),
      createdInVersion: currentVersion,
    }]);
  }, [options, guestCount, currentVersion]);

  const removeOption = useCallback((optionId: string) => {
    setOptions(prev => prev.filter(o => o.id !== optionId));
  }, []);

  const updateOption = useCallback((optionId: string, updates: Partial<OfferBuilderOption>) => {
    setOptions(prev => prev.map(o =>
      o.id === optionId ? { ...o, ...updates } : o
    ));
  }, []);

  const toggleOptionActive = useCallback((optionId: string) => {
    setOptions(prev => prev.map(o =>
      o.id === optionId ? { ...o, isActive: !o.isActive } : o
    ));
  }, []);

  // =================================================================
  // SAVE / VERSION (migriert aus useMultiOfferState)
  // =================================================================
  const saveOptions = useCallback(async () => {
    setIsSaving(true);
    try {
      await supabase
        .from("inquiry_offer_options")
        .delete()
        .eq("inquiry_id", inquiryId);

      for (const opt of options) {
        await (supabase as any)
          .from("inquiry_offer_options")
          .insert({
            id: opt.id,
            inquiry_id: inquiryId,
            offer_version: currentVersion,
            package_id: opt.packageId,
            option_label: opt.optionLabel,
            offer_mode: opt.offerMode,
            guest_count: opt.guestCount,
            menu_selection: opt.menuSelection,
            total_amount: opt.totalAmount,
            stripe_payment_link_id: opt.stripePaymentLinkId,
            stripe_payment_link_url: opt.stripePaymentLinkUrl,
            is_active: opt.isActive,
            sort_order: opt.sortOrder,
          });
      }

      // Still save — kein Toast (Auto-Save im Hintergrund)
    } catch (error) {
      console.error("Error saving options:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }, [inquiryId, options, currentVersion]);

  const createNewVersion = useCallback(async (emailContent: string) => {
    const newVersion = currentVersion + 1;
    setCurrentVersion(newVersion);
    setOptions(prev => prev.map(o => ({ ...o, offerVersion: newVersion })));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      await (supabase as any).from("inquiry_offer_history").insert({
        inquiry_id: inquiryId,
        version: newVersion,
        sent_by: user?.email || null,
        email_content: emailContent,
        options_snapshot: options,
      });

      await supabase
        .from("event_inquiries")
        .update({
          current_offer_version: newVersion,
          offer_sent_at: now,
          offer_sent_by: user?.email || null,
        })
        .eq("id", inquiryId);
    } catch (error) {
      console.error("Error creating version history:", error);
    }

    return newVersion;
  }, [currentVersion, inquiryId, options]);

  const unlockForNewVersion = useCallback(async () => {
    try {
      const newVersion = currentVersion + 1;

      await supabase
        .from("event_inquiries")
        .update({
          offer_sent_at: null,
          offer_sent_by: null,
          current_offer_version: newVersion,
          status: 'offer_sent',
        })
        .eq("id", inquiryId);

      setCurrentVersion(newVersion);
      setOptions(prev => prev.map(o => ({ ...o, offerVersion: newVersion })));

      await logActivity(inquiryId, 'offer_unlocked_for_revision', { newVersion });
      toast.success(`Version ${newVersion} erstellt – Angebot kann bearbeitet werden`);
      return newVersion;
    } catch (error) {
      console.error("Error unlocking for new version:", error);
      toast.error("Fehler beim Entsperren");
      return currentVersion;
    }
  }, [currentVersion, inquiryId]);

  // =================================================================
  // PHASE TRANSITIONS (NEU)
  // =================================================================

  /** Phase 1: Vorschlag senden (ohne Stripe) */
  const sendProposal = useCallback(async (emailContent: string) => {
    await saveOptions();
    const newVersion = await createNewVersion(emailContent);

    try {
      await supabase
        .from("event_inquiries")
        .update({
          status: 'offer_sent',
          offer_phase: 'proposal_sent',
        } as Record<string, unknown>)
        .eq("id", inquiryId);

      setOfferPhase('proposal_sent');

      await logActivity(inquiryId, 'proposal_sent', {
        version: newVersion,
        optionCount: options.filter(o => o.isActive).length,
      });

      toast.success("Vorschlag gesendet");
    } catch (error) {
      console.error("Error sending proposal:", error);
      toast.error("Fehler beim Senden des Vorschlags");
    }
  }, [saveOptions, createNewVersion, inquiryId, options]);

  /** Phase 2: Finales Angebot senden (mit Stripe Payment Links) */
  const sendFinalOffer = useCallback(async (emailContent: string) => {
    await saveOptions();

    // Stripe Payment Links für alle aktiven Optionen erstellen
    const activeOpts = options.filter(o => o.isActive);
    let linksCreated = 0;

    for (const opt of activeOpts) {
      if (opt.stripePaymentLinkUrl) { linksCreated++; continue; }
      if (opt.totalAmount <= 0) continue;

      try {
        const pkg = packagesProp?.find(p => p.id === opt.packageId);
        const { data: linkData, error: linkError } = await supabase.functions.invoke(
          'create-offer-payment-link',
          {
            body: {
              inquiryId,
              optionId: opt.id,
              packageName: pkg?.name || opt.packageName || opt.optionLabel,
              amount: opt.totalAmount,
              customerEmail: inquiry.email || '',
              customerName: inquiry.contact_name || '',
              eventDate: inquiry.preferred_date || '',
              guestCount: opt.guestCount,
              companyName: inquiry.company_name || undefined,
            },
          }
        );

        if (!linkError && linkData?.paymentLinkUrl) {
          setOptions(prev => prev.map(o =>
            o.id === opt.id
              ? { ...o, stripePaymentLinkUrl: linkData.paymentLinkUrl, stripePaymentLinkId: linkData.paymentLinkId }
              : o
          ));
          linksCreated++;
        }
      } catch (err) {
        console.error(`Error creating payment link for option ${opt.optionLabel}:`, err);
      }
    }

    const newVersion = await createNewVersion(emailContent);

    try {
      await supabase
        .from("event_inquiries")
        .update({
          status: 'offer_sent',
          offer_phase: 'final_sent',
        } as Record<string, unknown>)
        .eq("id", inquiryId);

      setOfferPhase('final_sent');

      await logActivity(inquiryId, 'final_offer_sent', {
        version: newVersion,
        optionCount: activeOpts.length,
        paymentLinksCreated: linksCreated,
      });

      toast.success(`Finales Angebot gesendet (${linksCreated} Zahlungslink${linksCreated !== 1 ? 's' : ''})`);
    } catch (error) {
      console.error("Error sending final offer:", error);
      toast.error("Fehler beim Senden des finalen Angebots");
    }
  }, [saveOptions, createNewVersion, inquiryId, options, packagesProp, inquiry]);

  // =================================================================
  // COMPUTED
  // =================================================================
  const activeOptions = useMemo(() => options.filter(o => o.isActive), [options]);

  const isLocked = useMemo(() => {
    return !!inquiry.offer_sent_at;
  }, [inquiry.offer_sent_at]);

  // =================================================================
  // RETURN
  // =================================================================
  return {
    options,
    offerPhase,
    currentVersion,
    history,
    customerResponse,

    packageConfigs,
    menuItems: menuItemsQuery.items,

    isLoading: isLoading || menuItemsQuery.isLoading,
    isSaving,
    saveStatus,

    addOption,
    removeOption,
    updateOption,
    toggleOptionActive,

    saveOptions,
    createNewVersion,
    unlockForNewVersion,

    sendProposal,
    sendFinalOffer,

    activeOptions,
    isLocked,
    setOptions,
  };
}

// Re-export für externe Nutzung
export type { CombinedMenuItem, CourseConfig, DrinkConfig };
