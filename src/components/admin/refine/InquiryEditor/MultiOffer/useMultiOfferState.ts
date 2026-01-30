import { useState, useCallback, useEffect, useRef } from "react";
import { OfferOption, OfferHistoryEntry, OPTION_LABELS, createEmptyOption, MenuSelectionType } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Helper to log activity
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          const customerPackage = selectedPackages?.[0];
          const customerPackageId = customerPackage?.id || null;
          
          // Calculate initial total if package is selected
          let initialTotal = 0;
          let initialPackageName = '';
          
          if (customerPackage) {
            // Try to get price info from selected_packages data
            // The selected_packages array contains full package info from cart
            const pkgData = customerPackage as { 
              id: string; 
              name?: string; 
              price?: number; 
              pricePerPerson?: boolean;
            };
            
            initialPackageName = pkgData.name || '';
            if (pkgData.price) {
              initialTotal = pkgData.pricePerPerson 
                ? pkgData.price * guestCount 
                : pkgData.price;
            }
          }
          
          setOptions([{
            id: crypto.randomUUID(),
            ...createEmptyOption('A', guestCount),
            packageId: customerPackageId,
            packageName: initialPackageName,
            totalAmount: initialTotal,
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
  }, [inquiryId, guestCount, selectedPackages]);

  // Auto-save options when they change (debounced)
  useEffect(() => {
    // Skip auto-save during initial load
    if (isLoading || isInitialLoad.current) {
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 800ms
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Get current user for editor tracking - use email for human-readable display
        const { data: userData } = await supabase.auth.getUser();
        const currentUserEmail = userData.user?.email;

        // Delete existing options for this inquiry
        await supabase
          .from("inquiry_offer_options")
          .delete()
          .eq("inquiry_id", inquiryId);

        // Insert updated options
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

        // Update editor tracking on the inquiry - store email for display
        if (currentUserEmail) {
          await supabase
            .from("event_inquiries")
            .update({
              last_edited_by: currentUserEmail,
              last_edited_at: new Date().toISOString(),
            })
            .eq("id", inquiryId);
        }

        // Log the activity with details about what changed
        const activeOptions = options.filter(o => o.isActive);
        const optionSummary = activeOptions.map(o => 
          `Option ${o.optionLabel}: ${o.packageName || 'Kein Paket'} (${o.guestCount} Gäste, ${o.totalAmount.toFixed(2)} €)`
        ).join(', ');
        
        await logActivity(inquiryId, 'offer_updated', {
          optionCount: activeOptions.length,
          summary: optionSummary,
          version: currentVersion,
        });

        setSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error("Auto-save error:", error);
        setSaveStatus('idle');
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [options, inquiryId, currentVersion, isLoading]);

  // Mark initial load as complete after first load
  useEffect(() => {
    if (!isLoading && isInitialLoad.current) {
      // Small delay to ensure state is settled
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    }
  }, [isLoading]);

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
      createdInVersion: currentVersion, // Track which version this option was created in
    }]);
  }, [options, guestCount, currentVersion]);

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

  // Create a new version (increment and save history) - called when SENDING
  const createNewVersion = useCallback(async (emailContent: string) => {
    const newVersion = currentVersion + 1;
    setCurrentVersion(newVersion);

    // Update all options to new version
    setOptions(prev => prev.map(o => ({ ...o, offerVersion: newVersion })));

    // Save history entry
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

      // Update inquiry with new version AND offer_sent tracking - store email for display
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

  // Unlock for new version - resets offer_sent_at to null, allowing edits
  // IMPORTANT: Status stays 'offer_sent' - once sent, always in that category
  const unlockForNewVersion = useCallback(async () => {
    try {
      const newVersion = currentVersion + 1;
      
      // Reset offer_sent_at to unlock editing, but keep status as 'offer_sent'
      // The status is the source of truth for categorization, not offer_sent_at
      await supabase
        .from("event_inquiries")
        .update({ 
          offer_sent_at: null,
          offer_sent_by: null,
          current_offer_version: newVersion,
          status: 'offer_sent', // Explicitly keep status as offer_sent
        })
        .eq("id", inquiryId);
      
      setCurrentVersion(newVersion);
      
      // Update all options to new version
      setOptions(prev => prev.map(o => ({ ...o, offerVersion: newVersion })));
      
      // Log activity
      await logActivity(inquiryId, 'offer_unlocked_for_revision', {
        newVersion,
      });
      
      toast.success(`Version ${newVersion} erstellt – Angebot kann bearbeitet werden`);
      
      return newVersion;
    } catch (error) {
      console.error("Error unlocking for new version:", error);
      toast.error("Fehler beim Entsperren");
      return currentVersion;
    }
  }, [currentVersion, inquiryId]);

  return {
    options,
    currentVersion,
    history,
    isLoading,
    isSaving,
    saveStatus,
    addOption,
    removeOption,
    updateOption,
    toggleOptionActive,
    saveOptions,
    createNewVersion,
    unlockForNewVersion,
    setOptions,
  };
}
