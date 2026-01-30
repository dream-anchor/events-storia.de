import { useState, useCallback, useEffect } from "react";
import { OfferOption, OfferHistoryEntry, OPTION_LABELS, createEmptyOption, MenuSelectionType } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SelectedPackage {
  id: string;
  name?: string;
}

interface UseMultiOfferStateProps {
  inquiryId: string;
  guestCount: number;
  selectedPackages?: SelectedPackage[];
}

export function useMultiOfferState({ inquiryId, guestCount, selectedPackages }: UseMultiOfferStateProps) {
  const [options, setOptions] = useState<OfferOption[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [history, setHistory] = useState<OfferHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing options from database
  useEffect(() => {
    const loadOptions = async () => {
      if (!inquiryId) return;
      setIsLoading(true);

      try {
        // Fetch existing options
        const { data: optionsData, error: optionsError } = await supabase
          .from("inquiry_offer_options")
          .select("*")
          .eq("inquiry_id", inquiryId)
          .order("sort_order", { ascending: true });

        if (optionsError) throw optionsError;

        if (optionsData && optionsData.length > 0) {
          const mappedOptions: OfferOption[] = optionsData.map((opt) => ({
            id: opt.id,
            packageId: opt.package_id,
            packageName: '', // Will be populated from packages data
            optionLabel: opt.option_label,
            isActive: opt.is_active ?? true,
            guestCount: opt.guest_count,
            menuSelection: (opt.menu_selection as unknown as MenuSelectionType) || { courses: [], drinks: [] },
            totalAmount: Number(opt.total_amount),
            stripePaymentLinkId: opt.stripe_payment_link_id,
            stripePaymentLinkUrl: opt.stripe_payment_link_url,
            offerVersion: opt.offer_version,
            sortOrder: opt.sort_order || 0,
          }));
          setOptions(mappedOptions);
          setCurrentVersion(Math.max(...mappedOptions.map(o => o.offerVersion)));
        } else {
          // Create initial option A - pre-fill with customer's selected package if available
          const customerPackageId = selectedPackages?.[0]?.id || null;
          setOptions([{
            id: crypto.randomUUID(),
            ...createEmptyOption('A', guestCount),
            packageId: customerPackageId,
          }]);
        }

        // Fetch history
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
            optionsSnapshot: (h.options_snapshot as unknown as OfferOption[]) || [],
          })));
        }
      } catch (error) {
        console.error("Error loading offer options:", error);
        toast.error("Fehler beim Laden der Angebotsoptionen");
      } finally {
        setIsLoading(false);
      }
    };

    loadOptions();
  }, [inquiryId, guestCount]);

  // Add a new option
  const addOption = useCallback(() => {
    const usedLabels = options.map(o => o.optionLabel);
    const nextLabel = OPTION_LABELS.find(l => !usedLabels.includes(l));
    
    if (!nextLabel) {
      toast.warning("Maximale Anzahl an Optionen erreicht");
      return;
    }

    setOptions(prev => [...prev, {
      id: crypto.randomUUID(),
      ...createEmptyOption(nextLabel, guestCount),
    }]);
  }, [options, guestCount]);

  // Remove an option
  const removeOption = useCallback((optionId: string) => {
    setOptions(prev => prev.filter(o => o.id !== optionId));
  }, []);

  // Update an option
  const updateOption = useCallback((optionId: string, updates: Partial<OfferOption>) => {
    setOptions(prev => prev.map(o => 
      o.id === optionId ? { ...o, ...updates } : o
    ));
  }, []);

  // Toggle option active status
  const toggleOptionActive = useCallback((optionId: string) => {
    setOptions(prev => prev.map(o =>
      o.id === optionId ? { ...o, isActive: !o.isActive } : o
    ));
  }, []);

  // Save options to database
  const saveOptions = useCallback(async () => {
    setIsSaving(true);
    try {
      // Delete existing options for this inquiry
      await supabase
        .from("inquiry_offer_options")
        .delete()
        .eq("inquiry_id", inquiryId);

      // Insert updated options one by one to avoid type issues
      for (const opt of options) {
        await (supabase as any)
          .from("inquiry_offer_options")
          .insert({
            id: opt.id,
            inquiry_id: inquiryId,
            offer_version: currentVersion,
            package_id: opt.packageId,
            option_label: opt.optionLabel,
            guest_count: opt.guestCount,
            menu_selection: opt.menuSelection,
            total_amount: opt.totalAmount,
            stripe_payment_link_id: opt.stripePaymentLinkId,
            stripe_payment_link_url: opt.stripePaymentLinkUrl,
            is_active: opt.isActive,
            sort_order: opt.sortOrder,
          });
      }

      const error = null;

      if (error) throw error;

      toast.success("Optionen gespeichert");
    } catch (error) {
      console.error("Error saving options:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }, [inquiryId, options, currentVersion]);

  // Create a new version (increment and save history)
  const createNewVersion = useCallback(async (emailContent: string) => {
    const newVersion = currentVersion + 1;
    setCurrentVersion(newVersion);

    // Update all options to new version
    setOptions(prev => prev.map(o => ({ ...o, offerVersion: newVersion })));

    // Save history entry
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await (supabase as any).from("inquiry_offer_history").insert({
        inquiry_id: inquiryId,
        version: newVersion,
        sent_by: user?.email || null,
        email_content: emailContent,
        options_snapshot: options,
      });

      // Update inquiry with new version
      await supabase
        .from("event_inquiries")
        .update({ current_offer_version: newVersion })
        .eq("id", inquiryId);

    } catch (error) {
      console.error("Error creating version history:", error);
    }

    return newVersion;
  }, [currentVersion, inquiryId, options]);

  return {
    options,
    currentVersion,
    history,
    isLoading,
    isSaving,
    addOption,
    removeOption,
    updateOption,
    toggleOptionActive,
    saveOptions,
    createNewVersion,
    setOptions,
  };
}
