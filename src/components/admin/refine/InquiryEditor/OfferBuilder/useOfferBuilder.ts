import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateEventPackagePrice } from "@/lib/eventPricing";
import { useCombinedMenuItems } from "@/hooks/useCombinedMenuItems";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import type { CourseConfig, DrinkConfig, DrinkOption, CourseSelection } from "../MenuComposer/types";
import { useRegisterSaveStatus } from "@/components/admin/shared/SaveStatusContext";
import { detectPricingMode, calculateTotalAmount, parseQuantityPrefix } from "./pricingMode";
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

/**
 * Migriert Legacy-Daten: wenn itemName / drink.name ein "N x Name"-Pattern hat
 * und quantity noch nicht gesetzt ist, wird die Menge extrahiert und der Name
 * bereinigt. Das wandert dann beim naechsten Save in die DB. Ohne Aenderung
 * am DB-Schema.
 *
 * Wichtig: bei Legacy-Daten war overridePrice / pricePerPerson bisher der
 * Zeilen-Gesamtpreis (z.B. 196,9 € fuer "11 x Salat" oder 287 € fuer "70 x Softdrink").
 * Nach der Migration ist overridePrice / pricePerPerson der Einzelpreis
 * (Zeilen-Total = quantity * Einzelpreis). Damit die Migration bedeutungs-
 * erhaltend ist, teilen wir den Preis durch quantity.
 *
 * Wenn quantity schon vorhanden ist, bleibt der Eintrag unveraendert.
 */
function migrateCourseQuantities(
  menuSelection: OfferBuilderOption['menuSelection']
): OfferBuilderOption['menuSelection'] {
  if (!menuSelection) return menuSelection;

  // 1. Kurse migrieren
  const migratedCourses = menuSelection.courses?.length
    ? menuSelection.courses.map((c) => {
        if (c.quantity != null) return c; // schon migriert
        const parsed = parseQuantityPrefix(c.itemName);
        if (!parsed) return { ...c, quantity: 1 };
        const oldTotal = c.overridePrice;
        const newUnitPrice = (oldTotal != null && oldTotal > 0 && parsed.quantity > 0)
          ? Math.round((oldTotal / parsed.quantity) * 100) / 100
          : oldTotal;
        return {
          ...c,
          itemName: parsed.cleanName,
          quantity: parsed.quantity,
          overridePrice: newUnitPrice,
        };
      })
    : menuSelection.courses;

  // 2. Einzeln-Getraenke migrieren (gleiche Logik, anderes Feld)
  const migratedDrinksEinzeln = menuSelection.drinksEinzeln?.length
    ? menuSelection.drinksEinzeln.map((d) => {
        if (d.quantity != null) return d;
        const parsed = parseQuantityPrefix(d.name);
        if (!parsed) return { ...d, quantity: 1 };
        const oldTotal = d.pricePerPerson;
        const newUnitPrice = (oldTotal != null && oldTotal > 0 && parsed.quantity > 0)
          ? Math.round((oldTotal / parsed.quantity) * 100) / 100
          : oldTotal;
        return {
          ...d,
          name: parsed.cleanName,
          quantity: parsed.quantity,
          pricePerPerson: newUnitPrice,
        };
      })
    : menuSelection.drinksEinzeln;

  return { ...menuSelection, courses: migratedCourses, drinksEinzeln: migratedDrinksEinzeln };
}


// =================================================================
// SAVE-HELPER (fix für Foreign-Key-Bug bei offer_customer_responses)
//
// Früher: DELETE all + INSERT all (scheiterte wenn der Kunde bereits
// eine Option ausgewählt hatte, weil offer_customer_responses.selected_option_id
// darauf referenziert).
//
// Jetzt: Diff-basiert mit upsert. Nur Optionen löschen die im neuen
// State nicht mehr vorkommen UND nicht referenziert sind. Bestehende
// IDs bleiben erhalten → Kundenauswahl bleibt intakt.
// =================================================================
async function saveOptionsToDb(
  inquiryId: string,
  options: OfferBuilderOption[],
  currentVersion: number
): Promise<void> {
  // Optionen ohne gewählten Modus werden NICHT persistiert (UX: Karte wartet
  // auf Typ-Auswahl). Sie sind reiner In-Memory-State.
  options = options.filter(o => o.offerMode !== 'unselected');

  // 1. Aktuelle Options in DB laden (nur IDs)
  const { data: existingRows } = await supabase
    .from('inquiry_offer_options')
    .select('id')
    .eq('inquiry_id', inquiryId);

  const existingIds = new Set((existingRows || []).map(r => r.id));
  const newIds = new Set(options.map(o => o.id));

  // =================================================================
  // SAFETY NET: niemals einen "leeren" Save persistieren wenn die DB
  // bereits Optionen für diese Inquiry hat. Das wuerde bedeuten dass
  // ein Render-Race zwischen Mount/Hydration und Send-Trigger das
  // gesamte Angebot lautlos wegwirft (siehe Bug 1, Inquiry e2dbb511).
  //
  // Wir loggen den Fall sichtbar und werfen — sendProposal faengt
  // diese Exception und zeigt dem Admin einen harten Fehler.
  // =================================================================
  if (options.length === 0 && existingIds.size > 0) {
    const msg =
      `[saveOptionsToDb] Abort: leeres options-Array, aber DB hat ${existingIds.size} Eintrag(e) ` +
      `fuer inquiry ${inquiryId}. Kein Save ausgefuehrt.`;
    console.error(msg, { inquiryId, existingDbIds: [...existingIds] });
    toast.error(
      'Speichern abgebrochen: das Angebot waere geloescht worden. ' +
      'Bitte Seite neu laden.',
      { id: 'save-empty-abort', duration: 12000 },
    );
    throw new Error(
      'Empty options array would erase existing offer in DB — save aborted to protect data.',
    );
  }

  // 2. IDs die gelöscht werden müssen (in DB, aber nicht mehr im neuen State)
  const idsToDelete = [...existingIds].filter(id => !newIds.has(id));

  // 3. Referenzierte IDs prüfen — die NICHT löschen
  if (idsToDelete.length > 0) {
    const { data: referenced } = await supabase
      .from('offer_customer_responses')
      .select('selected_option_id')
      .in('selected_option_id', idsToDelete);

    const referencedIds = new Set(
      (referenced || []).map(r => r.selected_option_id).filter(Boolean)
    );

    const safeToDelete = idsToDelete.filter(id => !referencedIds.has(id));

    if (safeToDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('inquiry_offer_options')
        .delete()
        .in('id', safeToDelete);
      if (delErr) throw delErr;
    }

    // Wenn referenzierte Optionen "gelöscht" werden sollten: stumm überspringen.
    // Der User kann eine vom Kunden ausgewählte Option nicht löschen —
    // das ist ein Feature, kein Bug. Die Option bleibt in der DB.
  }

  // 4. Upsert aller aktuellen Options (neu + bestehend)
  const rows = options.map(opt => ({
    id: opt.id,
    inquiry_id: inquiryId,
    offer_version: currentVersion,
    package_id: opt.packageId,
    option_label: opt.optionLabel,
    offer_mode: opt.offerMode,
    guest_count: opt.guestCount,
    menu_selection: {
      ...opt.menuSelection,
      budgetPerPerson: opt.budgetPerPerson,
      pricingMode: opt.pricingMode ?? 'per_person',
      discountPercent: opt.discountPercent,
      packageNameOverride: opt.packageName || null,
    },
    total_amount: opt.totalAmount,
    stripe_payment_link_id: opt.stripePaymentLinkId,
    stripe_payment_link_url: opt.stripePaymentLinkUrl,
    is_active: opt.isActive,
    sort_order: opt.sortOrder,
  }));

  if (rows.length > 0) {
    const { error: upsertErr } = await (supabase as any)
      .from('inquiry_offer_options')
      .upsert(rows, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;
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
  const isDirtyRef = useRef(false);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [history, setHistory] = useState<OfferHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>('');
  const consecutiveSaveErrorsRef = useRef(0);
  const errorToastShownRef = useRef(false);

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
  const [localUnlocked, setLocalUnlocked] = useState(false);

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
          const mappedOptions: OfferBuilderOption[] = optionsData.map((opt) => {
            // Korrektur: Wenn packageId gesetzt aber offerMode ist 'menu' → 'paket'
            let mode = mapLegacyMode((opt as Record<string, unknown>).offer_mode as string);
            if (opt.package_id && mode === 'menu') {
              mode = 'paket';
            }
            // Paketnamen auflösen: Override aus menu_selection > packages-Prop > leer
            const menuSel = opt.menu_selection as Record<string, unknown> | null;
            const nameOverride = menuSel?.packageNameOverride as string | undefined;
            const pkgName = nameOverride
              ? nameOverride
              : opt.package_id
                ? packagesProp?.find(p => p.id === opt.package_id)?.name || ''
                : '';
            return {
            id: opt.id,
            packageId: opt.package_id,
            packageName: pkgName,
            optionLabel: opt.option_label,
            offerMode: mode,
            isActive: opt.is_active ?? true,
            guestCount: opt.guest_count,
            menuSelection: migrateCourseQuantities(
              (opt.menu_selection as unknown as OfferBuilderOption['menuSelection']) || { courses: [], drinks: [] }
            ),
            totalAmount: Number(opt.total_amount),
            stripePaymentLinkId: opt.stripe_payment_link_id,
            stripePaymentLinkUrl: opt.stripe_payment_link_url,
            offerVersion: opt.offer_version,
            createdInVersion: (opt as Record<string, unknown>).created_in_version as number | undefined,
            sortOrder: opt.sort_order || 0,
            budgetPerPerson: ((opt.menu_selection as Record<string, unknown>)?.budgetPerPerson as number) ?? null,
            pricingMode: ((opt.menu_selection as Record<string, unknown>)?.pricingMode as 'per_person' | 'per_event') ?? detectPricingMode(((opt.menu_selection as Record<string, unknown>)?.courses as CourseSelection[] | undefined)),
            discountPercent: ((opt.menu_selection as Record<string, unknown>)?.discountPercent as number) ?? 0,
            attachMenu: false,
            tableNote: null,
          }; });
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
            ...createEmptyOption('A', guestCountRef.current, customerPackageId ? 'paket' : 'menu'),
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
  // AUTO-SAVE — 800ms Debounce mit JSON-Vergleich (verhindert Loop)
  // =================================================================
  useEffect(() => {
    if (isLoading || isInitialLoad.current) return;
    if (!inquiryId) return; // Kein Save ohne gültige inquiry_id (z.B. auf /create vor Draft-Init)

    if (!isDirtyRef.current) return;
    isDirtyRef.current = false;
    const currentJson = JSON.stringify(options);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      // Retry-Stopp: nach 3 Fehlschlägen in Folge nicht mehr automatisch speichern
      if (consecutiveSaveErrorsRef.current >= 3) {
        return;
      }

      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUserEmail = userData.user?.email;

        // Diff-basiertes Save (sicher bei vom Kunden ausgewählten Optionen)
        await saveOptionsToDb(inquiryId, options, currentVersion);

        if (currentUserEmail) {
          await supabase
            .from("event_inquiries")
            .update({
              last_edited_by: currentUserEmail,
              last_edited_at: new Date().toISOString(),
            })
            .eq("id", inquiryId);
        }

        lastSavedJsonRef.current = currentJson;
        setSaveStatus('idle');
        consecutiveSaveErrorsRef.current = 0;
        errorToastShownRef.current = false;
      } catch (error) {
        consecutiveSaveErrorsRef.current += 1;
        const msg = error instanceof Error ? error.message : JSON.stringify(error);
        console.error("Auto-save error:", msg, error);
        setSaveStatus('error');

        // Nur EINMAL pro Fehler-Serie einen Toast anzeigen (kein Spam)
        if (!errorToastShownRef.current) {
          errorToastShownRef.current = true;
          if (consecutiveSaveErrorsRef.current >= 3) {
            toast.error(
              "Speichern dauerhaft fehlgeschlagen. Seite bitte neu laden.",
              { duration: Infinity, id: 'save-error-permanent' }
            );
          } else {
            toast.error(`Speichern fehlgeschlagen: ${msg}`, { id: 'save-error' });
          }
        }
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [options, inquiryId, currentVersion, isLoading]);

  // Initial-Load Guard — setzt lastSavedJsonRef um sofortigen Save zu verhindern
  useEffect(() => {
    if (!isLoading && isInitialLoad.current) {
      lastSavedJsonRef.current = JSON.stringify(options);
      setTimeout(() => { isInitialLoad.current = false; }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Sync guestCount → alle Options wenn Inquiry-Gästezahl sich ändert
  useEffect(() => {
    if (isLoading || isInitialLoad.current || guestCount <= 1) return;
    setOptions(prev => {
      const anyWrong = prev.some(o => o.guestCount !== guestCount);
      if (!anyWrong) return prev;
      isDirtyRef.current = true;
      return prev.map(o => o.guestCount !== guestCount ? { ...o, guestCount } : o);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestCount, isLoading]);

  // =================================================================
  // TOTAL-AMOUNT RECALC — berechnet Preis pro Option automatisch
  // Menü-Modus: Summe der Kurspreise (−20% Rabatt) × Gäste
  // Paket-Modus: Paketpreis-Kalkulation
  // =================================================================
  const priceRecalcRef = useRef(false);
  const MENU_DISCOUNT = 0.25;

  useEffect(() => {
    if (isLoading) return;

    setOptions(prev => {
      let changed = false;
      const updated = prev.map(opt => {
        if (opt.offerMode === 'menu') {
          // Menue-Modus: Zeilen-Totals aus quantity * overridePrice
          let dishSubtotal = 0;
          for (const course of opt.menuSelection.courses) {
            if (course.overridePrice != null && course.overridePrice > 0) {
              const qty = course.quantity ?? 1;
              dishSubtotal += course.overridePrice * qty;
            }
          }
          // Getränke je nach Modus
          let drinksPerPerson = 0;
          const drinkMode = opt.menuSelection.drinksMode ?? 'none';
          const pm = opt.pricingMode ?? 'per_person';
          if (drinkMode === 'weinbegleitung' || drinkMode === 'none') {
            drinksPerPerson = opt.menuSelection.winePairingPrice || 0;
          } else if (drinkMode === 'pauschale') {
            drinksPerPerson = opt.menuSelection.drinksPauschalePrice || 0;
          } else if (drinkMode === 'einzeln') {
            // per_event: absolute Mengen x Einzelpreis (Zeilen-Total)
            // per_person: einfach Summe der Einzelpreise (quantity wird nicht genutzt)
            drinksPerPerson = (opt.menuSelection.drinksEinzeln || []).reduce((s, d) => {
              const qty = pm === 'per_event' ? (d.quantity ?? 1) : 1;
              return s + d.pricePerPerson * qty;
            }, 0);
          }
          const subtotal = dishSubtotal + drinksPerPerson;
          const discount = dishSubtotal * MENU_DISCOUNT;
          const netPerPerson = subtotal - discount;

          // budgetPerPerson (manuell gesetzt) hat Vorrang
          const effectivePerPerson = (opt.budgetPerPerson != null && opt.budgetPerPerson > 0)
            ? opt.budgetPerPerson
            : netPerPerson;
          // Gesamtsumme je nach Pricing-Modus
          const mode = opt.pricingMode ?? 'per_person';
          const fallbackTotal = netPerPerson * opt.guestCount;
          const newTotal = calculateTotalAmount(mode, effectivePerPerson, opt.guestCount, fallbackTotal);

          if (Math.abs(opt.totalAmount - newTotal) < 0.01) return opt;
          changed = true;
          return { ...opt, totalAmount: newTotal };
        }

        // Paket-Modus: Preis aus Paket-Kalkulation
        if (!opt.packageId || !packagesProp?.length) return opt;
        const pkg = packagesProp.find(p => p.id === opt.packageId);
        if (!pkg) return opt;

        // Pricing-Modus entscheidet:
        //  per_event: budgetPerPerson ist bereits der Gesamtpreis
        //  per_person: wie bisher (budgetPerPerson * guestCount oder Paket-Kalkulation)
        const mode = opt.pricingMode ?? 'per_person';
        let newTotal: number;
        if (opt.budgetPerPerson != null && opt.budgetPerPerson > 0) {
          if (mode === 'per_event') {
            newTotal = opt.budgetPerPerson;
          } else {
            newTotal = pkg.price_per_person
              ? opt.budgetPerPerson * opt.guestCount
              : opt.budgetPerPerson;
          }
        } else {
          newTotal = calculateEventPackagePrice(
            pkg.id, pkg.price, opt.guestCount, !!pkg.price_per_person
          );
        }

        if (Math.abs(opt.totalAmount - newTotal) < 0.01) return opt;
        changed = true;
        return { ...opt, totalAmount: newTotal };
      });

      if (!changed) return prev;
      priceRecalcRef.current = true;
      // Recalc-Updates müssen auch persistiert werden (Auto-Save triggern)
      isDirtyRef.current = true;
      return updated;
    });
  }, [isLoading, packagesProp, options.map(o => {
    const courseKey = o.offerMode === 'menu'
      ? o.menuSelection.courses.map(c => `${c.overridePrice ?? ''}`).join('|')
      : '';
    const drinkKey = o.offerMode === 'menu'
      ? `${o.menuSelection.drinksMode ?? 'none'}:${o.menuSelection.winePairingPrice ?? ''}:${o.menuSelection.drinksPauschalePrice ?? ''}:${(o.menuSelection.drinksEinzeln ?? []).map(d => d.pricePerPerson).join('|')}`
      : '';
    return `${o.packageId}:${o.guestCount}:${o.budgetPerPerson}:${o.offerMode}:${courseKey}:${drinkKey}`;
  }).join(',')]);

  // =================================================================
  // AUTO-REPAIR — Korrigiert itemName (Name+Beschreibung → nur Name),
  // setzt fehlende overridePrice (Katalogpreis × 0.8), fixet Legacy-IDs
  // =================================================================
  const menuItems = menuItemsQuery.items;

  /** Finde MenuItem — bevorzugt Items mit Preis > 0 */
  const findMenuItem = useCallback((itemId: string | null, itemName: string): CombinedMenuItem | undefined => {
    if (!menuItems.length) return undefined;
    const candidates: CombinedMenuItem[] = [];

    // 1. Exakte ID
    if (itemId) {
      const exact = menuItems.find(m => m.id === itemId);
      if (exact) candidates.push(exact);
    }
    // 2. Name-basiert (startsWith für lange Namen mit Beschreibung)
    if (itemName) {
      for (const m of menuItems) {
        if (candidates.includes(m)) continue;
        if (m.name === itemName || itemName.startsWith(m.name) || m.name.startsWith(itemName)) {
          candidates.push(m);
        }
      }
    }
    if (candidates.length === 0) return undefined;
    // Bevorzuge Preis > 0, dann Ristorante vor Catering
    return candidates.sort((a, b) => {
      const aPrice = (a.price && a.price > 0) ? 1 : 0;
      const bPrice = (b.price && b.price > 0) ? 1 : 0;
      if (aPrice !== bPrice) return bPrice - aPrice;
      if (a.source === 'ristorante' && b.source !== 'ristorante') return -1;
      if (b.source === 'ristorante' && a.source !== 'ristorante') return 1;
      return 0;
    })[0];
  }, [menuItems]);

  const hasRepaired = useRef(false);

  useEffect(() => {
    if (isLoading || menuItemsQuery.isLoading || menuItems.length === 0) return;
    if (hasRepaired.current) return;
    hasRepaired.current = true;

    setOptions(prev => {
      let changed = false;
      const updated = prev.map(opt => {
        if (opt.offerMode !== 'menu') return opt;
        const updatedCourses = opt.menuSelection.courses.map(course => {
          if (!course.itemId && !course.itemName) return course;

          const menuItem = findMenuItem(course.itemId, course.itemName);
          if (!menuItem) return course;

          const updates: Partial<typeof course> = {};

          // Fix Name+Beschreibung → nur Name
          if (menuItem.name !== course.itemName) {
            updates.itemName = menuItem.name;
            updates.itemDescription = menuItem.description;
          }

          // Fix Legacy-ID → prefixed ID
          if (menuItem.id !== course.itemId) {
            updates.itemId = menuItem.id;
            updates.itemSource = menuItem.source;
          }

          // Fix fehlender overridePrice (voller Katalogpreis, Rabatt wird am Ende ausgewiesen)
          if (!(course.overridePrice != null && course.overridePrice > 0) && menuItem.price && menuItem.price > 0) {
            updates.overridePrice = menuItem.price;
          }

          if (Object.keys(updates).length === 0) return course;
          changed = true;
          return { ...course, ...updates };
        });
        if (updatedCourses === opt.menuSelection.courses) return opt;
        return { ...opt, menuSelection: { ...opt.menuSelection, courses: updatedCourses } };
      });
      return changed ? updated : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, menuItemsQuery.isLoading, menuItems.length]);

  // =================================================================
  // OPTION CRUD (migriert aus useMultiOfferState)
  // =================================================================
  const addOption = useCallback((mode?: OfferMode, copyFrom?: OfferBuilderOption) => {
    const usedLabels = options.map(o => o.optionLabel);
    const nextLabel = OPTION_LABELS.find(l => !usedLabels.includes(l));

    if (!nextLabel) {
      toast.warning("Maximale Anzahl an Optionen erreicht (5)");
      return;
    }

    const base = copyFrom
      ? {
          packageId: copyFrom.packageId,
          packageName: copyFrom.packageName,
          offerMode: copyFrom.offerMode,
          isActive: true,
          guestCount: copyFrom.guestCount,
          menuSelection: JSON.parse(JSON.stringify(copyFrom.menuSelection)),
          totalAmount: copyFrom.totalAmount,
          stripePaymentLinkId: null,
          stripePaymentLinkUrl: null,
          offerVersion: currentVersion,
          sortOrder: OPTION_LABELS.indexOf(nextLabel as typeof OPTION_LABELS[number]),
          budgetPerPerson: copyFrom.budgetPerPerson,
          discountPercent: copyFrom.discountPercent,
          attachMenu: copyFrom.attachMenu,
          tableNote: copyFrom.tableNote,
        }
      : createEmptyOption(nextLabel, guestCount, mode ?? 'unselected');

    isDirtyRef.current = true;
    setOptions(prev => [...prev, {
      id: crypto.randomUUID(),
      ...base,
      optionLabel: nextLabel,
      createdInVersion: currentVersion,
    }]);
  }, [options, guestCount, currentVersion]);

  const removeOption = useCallback((optionId: string) => {
    isDirtyRef.current = true;
    setOptions(prev => {
      const filtered = prev.filter(o => o.id !== optionId);
      return filtered.map((o, i) => ({ ...o, optionLabel: OPTION_LABELS[i] }));
    });
  }, []);

  const importOptions = useCallback((partials: Partial<OfferBuilderOption>[]) => {
    const isEmptyOption = (o: OfferBuilderOption) =>
      o.offerMode === 'menu' &&
      o.menuSelection.courses.length === 0 &&
      !o.packageId &&
      (!o.totalAmount || o.totalAmount === 0);

    isDirtyRef.current = true;
    setOptions(prev => {
      const nonEmpty = prev.filter(o => !isEmptyOption(o));
      const relabeled = nonEmpty.map((o, i) => ({ ...o, optionLabel: OPTION_LABELS[i] }));
      const available = OPTION_LABELS.slice(relabeled.length);
      const toAdd = partials.slice(0, available.length);

      const newOpts: OfferBuilderOption[] = toAdd.map((partial, i) => ({
        ...createEmptyOption(available[i], guestCount, 'paket'),
        id: crypto.randomUUID(),
        createdInVersion: currentVersion,
        ...partial,
        optionLabel: available[i],
      }));

      return [...relabeled, ...newOpts];
    });
  }, [guestCount, currentVersion]);

  const updateOption = useCallback((optionId: string, updates: Partial<OfferBuilderOption>) => {
    isDirtyRef.current = true;
    setOptions(prev => prev.map(o =>
      o.id === optionId ? { ...o, ...updates } : o
    ));
  }, []);

  const toggleOptionActive = useCallback((optionId: string) => {
    isDirtyRef.current = true;
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
      await saveOptionsToDb(inquiryId, options, currentVersion);
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

    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    // History-Eintrag (Fehler weiterwerfen — ohne History kein sauberer Versand-Zustand)
    const { error: historyErr } = await (supabase as any).from("inquiry_offer_history").insert({
      inquiry_id: inquiryId,
      version: newVersion,
      sent_by: user?.email || null,
      email_content: emailContent,
      options_snapshot: options,
    });
    if (historyErr) {
      console.error('[createNewVersion] inquiry_offer_history insert failed:', historyErr);
      throw new Error(`History konnte nicht angelegt werden: ${historyErr.message}`);
    }

    // Versandzeitpunkt + Version auf Inquiry setzen (Fehler weiterwerfen)
    const { error: updateErr } = await supabase
      .from("event_inquiries")
      .update({
        current_offer_version: newVersion,
        offer_sent_at: now,
        offer_sent_by: user?.email || null,
      })
      .eq("id", inquiryId);
    if (updateErr) {
      console.error('[createNewVersion] event_inquiries update failed:', updateErr);
      throw new Error(`Versandzeitpunkt konnte nicht gespeichert werden: ${updateErr.message}`);
    }

    return newVersion;
  }, [currentVersion, inquiryId, options]);

  const unlockForNewVersion = useCallback(async () => {
    try {
      const newVersion = currentVersion + 1;

      // 1. Inquiry-Felder zurücksetzen
      await supabase
        .from("event_inquiries")
        .update({
          offer_sent_at: null,
          offer_sent_by: null,
          current_offer_version: newVersion,
          offer_phase: 'draft',
          status: 'offer_sent',
        } as Record<string, unknown>)
        .eq("id", inquiryId);

      // 2. Options sofort mit neuer Version in DB schreiben
      const updatedOptions = options.map(o => ({ ...o, offerVersion: newVersion }));
      await saveOptionsToDb(inquiryId, updatedOptions, newVersion);

      // 3. Lokalen State aktualisieren
      setCurrentVersion(newVersion);
      setOfferPhase('draft');
      setLocalUnlocked(true);
      setOptions(updatedOptions);
      lastSavedJsonRef.current = JSON.stringify(updatedOptions);

      await logActivity(inquiryId, 'offer_unlocked_for_revision', { newVersion });
      toast.success(`Version ${newVersion} erstellt – Angebot kann bearbeitet werden`);
      return newVersion;
    } catch (error) {
      console.error("Error unlocking for new version:", error);
      toast.error("Fehler beim Entsperren");
      return currentVersion;
    }
  }, [currentVersion, inquiryId, options]);

  // =================================================================
  // PHASE TRANSITIONS (NEU)
  // =================================================================

  /** Phase 1: Vorschlag senden (ohne Stripe) — erstellt LexOffice-Angebot + sendet Email */
  const sendProposal = useCallback(async (emailContent: string) => {
    // =================================================================
    // RACE-CONDITION-GUARD (Bug 1):
    // Wenn der Send-Trigger zu frueh feuert (Wizard → confirmed=1 vor
    // Hydration), ist `options` noch [] obwohl in der DB schon Eintraege
    // existieren. Ohne Schutz wuerde saveOptionsToDb das Angebot leeren.
    // Wir pruefen hier explizit gegen die DB und brechen mit klarem
    // Fehler ab, statt stillschweigend Daten zu verlieren.
    // =================================================================
    if (options.length === 0) {
      const { data: dbRows } = await supabase
        .from('inquiry_offer_options')
        .select('id')
        .eq('inquiry_id', inquiryId);
      if (dbRows && dbRows.length > 0) {
        const msg = `[sendProposal] Abort: lokaler State hat 0 Optionen, DB hat ${dbRows.length}. Hydration noch nicht abgeschlossen.`;
        console.error(msg, { inquiryId });
        toast.error(
          'Versand abgebrochen: Angebot wird noch geladen. Bitte 2 Sekunden warten und erneut klicken.',
          { duration: 12000 },
        );
        throw new Error('OfferBuilder not yet hydrated — refusing to send empty offer.');
      }
    }

    // Schritt 1: Lokalen Save erzwingen — wenn der fehlschlägt, wird nicht versendet
    try {
      await saveOptionsToDb(inquiryId, options, currentVersion);
    } catch (saveErr) {
      console.error('[sendProposal] saveOptionsToDb failed:', saveErr);
      const msg = saveErr instanceof Error ? saveErr.message : 'Unbekannter Fehler';
      toast.error(`Vorschlag konnte nicht gesendet werden: Speichern fehlgeschlagen (${msg})`);
      // HART abbrechen — Exception nach oben werfen, damit der Caller
      // (SmartInquiryEditor) den Fehler sieht und den Erfolgs-Modal NICHT zeigt.
      throw saveErr instanceof Error ? saveErr : new Error(msg);
    }

    // Schritt 2: Version anlegen + Versandzeitpunkt setzen
    let newVersion: number;
    try {
      newVersion = await createNewVersion(emailContent);
    } catch (versionErr) {
      console.error('[sendProposal] createNewVersion failed:', versionErr);
      const msg = versionErr instanceof Error ? versionErr.message : 'Unbekannter Fehler';
      toast.error(`Vorschlag konnte nicht gesendet werden: ${msg}`);
      return;
    }

    const activeOpts = options.filter(o => o.isActive);
    let lexofficeQuotationId: string | null = null;

    // Schritt 3: LexOffice-Angebot (non-blocking — Fehler wird geloggt aber unterbricht nicht)
    try {
      const { data: quotationResult } = await supabase.functions.invoke(
        'create-event-quotation',
        { body: { inquiryId } },
      );
      if (quotationResult?.success && quotationResult.quotationId) {
        lexofficeQuotationId = quotationResult.quotationId;
        const { error: lexUpdateErr } = await supabase
          .from('event_inquiries')
          .update({ lexoffice_quotation_id: lexofficeQuotationId } as Record<string, unknown>)
          .eq('id', inquiryId);
        if (lexUpdateErr) {
          console.error('[sendProposal] LexOffice ID-Update fehlgeschlagen:', lexUpdateErr);
        }
      }
    } catch (lexErr) {
      console.error('[sendProposal] LexOffice quotation error (non-blocking):', lexErr);
    }

    // Schritt 4: Phase + Status aktualisieren
    // Fehler hier ist kritisch — ohne Phase-Update rendert PublicOffer das Menu nicht
    const { error: phaseErr } = await supabase
      .from("event_inquiries")
      .update({
        status: 'offer_sent',
        offer_phase: 'proposal_sent',
      } as Record<string, unknown>)
      .eq("id", inquiryId);
    if (phaseErr) {
      console.error('[sendProposal] Phase-Update fehlgeschlagen:', phaseErr);
      toast.error(
        `Kritischer Fehler: Phase konnte nicht auf "Vorschlag gesendet" gesetzt werden. ` +
        `Bitte Seite neu laden und ggf. den Datensatz manuell korrigieren.`,
        { duration: Infinity }
      );
      return;
    }
    setOfferPhase('proposal_sent');

    // Schritt 5: Email an Kunden senden (ERST JETZT, nachdem State konsistent ist)
    const customerEmail = inquiry.email;
    const customerName = inquiry.contact_name;
    let emailSent = false;
    let emailErrorMessage: string | null = null;
    let emailMessageId: string | null = null;

    if (customerEmail) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-offer-email',
          {
            body: {
              inquiryId,
              emailContent,
              customerEmail,
              customerName: customerName || '',
              senderEmail: user?.email,
              lexofficeQuotationId,
            },
          }
        );
        emailSent = !emailError && emailResult?.emailSent;
        emailMessageId = emailResult?.messageId ?? null;
        if (emailError) {
          emailErrorMessage = emailError.message || 'Unbekannter Fehler';
          console.error('[sendProposal] Email send error:', emailError);
        }
      } catch (emailErr) {
        emailErrorMessage = emailErr instanceof Error ? emailErr.message : 'Unbekannter Fehler';
        console.error('[sendProposal] Error invoking send-offer-email:', emailErr);
      }
    }

    await logActivity(inquiryId, 'proposal_sent', {
      version: newVersion,
      optionCount: activeOpts.length,
      emailSent,
      emailErrorMessage,
      lexofficeQuotationId,
    });

    // Klares Feedback: Phase ist gesetzt, aber Mail-Status wird sichtbar kommuniziert
    if (emailSent) {
      const parts: string[] = ['Email zugestellt'];
      if (lexofficeQuotationId) parts.push('LexOffice-Angebot erstellt');
      toast.success(`Vorschlag gesendet — ${parts.join(', ')}`);
    } else if (customerEmail) {
      toast.warning(
        `Vorschlag intern gespeichert, aber Email an ${customerEmail} konnte NICHT zugestellt werden` +
        (emailErrorMessage ? ` (${emailErrorMessage})` : '') +
        `. Bitte Link manuell teilen oder nochmal senden.`,
        { duration: 15000 }
      );
    } else {
      toast.info('Vorschlag gespeichert (keine E-Mail-Adresse hinterlegt — Link manuell teilen)');
    }

    // Result an Caller (SmartInquiryEditor) zurueckreichen — fuer Erfolgs-Modal (Bug 3).
    return {
      emailSent,
      recipient: customerEmail || null,
      messageId: emailMessageId,
      sentAt: new Date().toISOString(),
      version: newVersion,
      lexofficeQuotationId,
      errorMessage: emailErrorMessage,
    };
  }, [inquiryId, options, currentVersion, createNewVersion, inquiry, packagesProp]);

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

    // Version anlegen (Fehler wird geworfen)
    let newVersion: number;
    try {
      newVersion = await createNewVersion(emailContent);
    } catch (versionErr) {
      console.error('[sendFinalOffer] createNewVersion failed:', versionErr);
      const msg = versionErr instanceof Error ? versionErr.message : 'Unbekannter Fehler';
      toast.error(`Finales Angebot konnte nicht gesendet werden: ${msg}`);
      return;
    }

    // Phase + Status aktualisieren — KRITISCH vor Mail-Versand
    const { error: phaseErr } = await supabase
      .from("event_inquiries")
      .update({
        status: 'offer_sent',
        offer_phase: 'final_sent',
      } as Record<string, unknown>)
      .eq("id", inquiryId);
    if (phaseErr) {
      console.error('[sendFinalOffer] Phase-Update fehlgeschlagen:', phaseErr);
      toast.error(
        `Kritischer Fehler: Finale Phase konnte nicht gesetzt werden (${phaseErr.message}). ` +
        `Bitte Seite neu laden und ggf. den Datensatz manuell korrigieren.`,
        { duration: Infinity }
      );
      return;
    }
    setOfferPhase('final_sent');

    // Email an Kunden senden (ERST JETZT, nachdem State konsistent ist)
    const customerEmail = inquiry.email;
    let emailSent = false;
    let emailErrorMessage: string | null = null;

    if (customerEmail) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-offer-email',
          {
            body: {
              inquiryId,
              emailContent,
              customerEmail,
              customerName: inquiry.contact_name || '',
              senderEmail: user?.email,
            },
          }
        );
        emailSent = !emailError && emailResult?.emailSent;
        if (emailError) {
          emailErrorMessage = emailError.message || 'Unbekannter Fehler';
          console.error('[sendFinalOffer] Email send error:', emailError);
        }
      } catch (emailErr) {
        emailErrorMessage = emailErr instanceof Error ? emailErr.message : 'Unbekannter Fehler';
        console.error('[sendFinalOffer] Error invoking send-offer-email:', emailErr);
      }
    }

    await logActivity(inquiryId, 'final_offer_sent', {
      version: newVersion,
      optionCount: activeOpts.length,
      paymentLinksCreated: linksCreated,
      emailSent,
      emailErrorMessage,
    });

    // Klares Feedback: Phase ist gesetzt, Mail-Status wird sichtbar kommuniziert
    if (emailSent) {
      toast.success(
        `Finales Angebot gesendet — Email zugestellt ` +
        `(${linksCreated} Zahlungslink${linksCreated !== 1 ? 's' : ''})`
      );
    } else if (customerEmail) {
      toast.warning(
        `Finales Angebot intern gespeichert, aber Email an ${customerEmail} konnte NICHT zugestellt werden` +
        (emailErrorMessage ? ` (${emailErrorMessage})` : '') +
        `. Bitte Link manuell teilen oder Versand erneut auslösen.`,
        { duration: 15000 }
      );
    } else {
      toast.info('Finales Angebot gespeichert (keine E-Mail-Adresse hinterlegt — Link manuell teilen)');
    }
  }, [saveOptions, createNewVersion, inquiryId, options, packagesProp, inquiry]);

  // =================================================================
  // COMPUTED
  // =================================================================
  const activeOptions = useMemo(() => options.filter(o => o.isActive), [options]);

  // Angebote sind immer bearbeitbar
  const isLocked = false;

  // =================================================================
  // RETURN
  // =================================================================
  // Flush pending save immediately (call before unmount/navigation)
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const currentJson = JSON.stringify(options);
    if (currentJson !== lastSavedJsonRef.current && !isLoading) {
      setSaveStatus('saving');
      (async () => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const currentUserEmail = userData.user?.email;
          await saveOptionsToDb(inquiryId, options, currentVersion);
          if (currentUserEmail) {
            await supabase.from('event_inquiries').update({ last_edited_by: currentUserEmail, last_edited_at: new Date().toISOString() }).eq('id', inquiryId);
          }
          lastSavedJsonRef.current = currentJson;
          setSaveStatus('idle');
        } catch (error) {
          console.error('[OfferBuilder] flushSave error:', error);
          setSaveStatus('idle');
        }
      })();
    }
  }, [options, inquiryId, currentVersion, isLoading]);

  // Zentralen SaveStatus-Context mit lokalem saveStatus synchronisieren.
  // Das AdminLayout zeigt dann EIN Badge fuer alle aktiven Editoren.
  useRegisterSaveStatus('offer-builder', saveStatus, flushSave);

  return {
    options,
    offerPhase,
    currentVersion,
    history,
    customerResponse,

    packageConfigs,
    menuItems,

    isLoading: isLoading || menuItemsQuery.isLoading,
    isSaving,
    saveStatus,

    flushSave,
    addOption,
    removeOption,
    importOptions,
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
