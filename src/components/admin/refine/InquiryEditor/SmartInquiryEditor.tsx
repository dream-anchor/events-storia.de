import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Loader2, FileText, Check, ListTodo, ExternalLink, ChevronDown, Plus, Users, Calendar, Euro, Building2, Eye, CreditCard, TestTube2, Ban, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { useEditorShortcuts } from "../CommandPalette";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EventDNACard } from "./EventDNACard";
import { LocationBlock } from "./LocationBlock";
import { OfferBuilder } from "./OfferBuilder";
import type { OfferBuilderHandle } from "./OfferBuilder";
import { OfferHistoryList } from "./OfferHistoryList";
import { CateringModules } from "./CateringModules";
import { ClientPreview } from "./ClientPreview";
import { StaffNote } from "./StaffNote";
import { TaskManager } from "@/components/admin/shared/TaskManager";
import { Timeline } from "@/components/admin/shared/Timeline";
import EventMailsTab from "./EventMailsTab";
import { MailClient } from "@/components/admin/shared/MailClient";
import { PaymentCard } from "./PaymentCard";
import { PaymentStatusStrip } from "./PaymentStatusStrip";
import { useDownloadLexOfficeDocument } from "@/hooks/useLexOfficeVouchers";
import { SendSuccessDialog, type SendSuccessInfo } from "./SendSuccessDialog";
import { InquiryPriority } from "@/types/refine";
import { ExtendedInquiry, Package, QuoteItem, SelectedPackage, EmailTemplate } from "./types";
import { MenuSelection } from "./MenuComposer";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import { useRegisterSaveStatus } from "@/components/admin/shared/SaveStatusContext";
import { fetchLatestInquiryDocument } from "@/lib/lexofficeDocument";
import { PrintMenu } from "@/components/admin/refine/print/PrintMenu";
import { CancellationDialog } from "@/components/admin/shared/CancellationDialog";
import { InviteCustomerAccountButton } from "@/components/admin/shared/InviteCustomerAccountButton";
import { OfferAcceptanceDrawer } from "./OfferAcceptanceDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomerLang } from "./CustomerLanguageSelector";
import { LanguageSwitchDialog, type TranslationScope } from "./LanguageSwitchDialog";
import { Languages as LanguagesIcon } from "lucide-react";

const HEADER_LANGS: { value: CustomerLang; flag: string; code: string; label: string }[] = [
  { value: "de", flag: "🇩🇪", code: "DE", label: "Deutsch" },
  { value: "en", flag: "🇬🇧", code: "EN", label: "Englisch" },
  { value: "it", flag: "🇮🇹", code: "IT", label: "Italienisch" },
  { value: "fr", flag: "🇫🇷", code: "FR", label: "Französisch" },
];

export const SmartInquiryEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dedizierter Ref fuer den Init-Effect. Dieser Ref verhindert dass der
  // lokale State nach jedem DB-Refetch neu aus inquiry ueberschrieben wird.
  // Das eigentliche Auto-Save-/Send-Gate ist bewusst REAKTIV via State gelöst,
  // damit der Send-Trigger-Effect nach der Initialisierung erneut laufen kann.
  // — was zu Save-Endlosschleifen und blinkendem SaveStatusBadge fuehrte.
  const isInitializedFromDb = useRef(false);
  const latestValuesRef = useRef<Record<string, unknown>>({});
  // Snapshot der zuletzt erfolgreich gespeicherten Werte (als JSON-String).
  // Verhindert Auto-Save-Endlosschleifen: feuert nur wenn sich der serialisierte
  // State seit dem letzten Save tatsächlich verändert hat.
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const consecutiveSaveErrorsRef = useRef(0);
  const errorToastShownRef = useRef(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>();

  // Language-switch dialog
  const [langDialog, setLangDialog] = useState<{ open: boolean; target: CustomerLang }>({
    open: false,
    target: "de",
  });
  const [lastTranslatedLang, setLastTranslatedLang] = useState<CustomerLang | null>(null);

  // Zentralen SaveStatus-Context mit lokalem saveStatus synchronisieren
  useRegisterSaveStatus('smart-inquiry-editor', saveStatus);
  const [isDownloading, setIsDownloading] = useState(false);
  const [mailsSubView, setMailsSubView] = useState<"inbox" | "mapping">("inbox");
  const downloadDocument = useDownloadLexOfficeDocument();

  // Local state for editable fields
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [localInquiry, setLocalInquiry] = useState<Partial<ExtendedInquiry>>({});
  const [activeTab, setActiveTab] = useState('angebot');
  const [customerResponse, setCustomerResponse] = useState<{
    responded_at: string;
    selected_option_id: string | null;
    customer_notes: string | null;
  } | null>(null);
  const [menuSelection, setMenuSelection] = useState<MenuSelection>({ courses: [], drinks: [] });
  const offerBuilderRef = useRef<OfferBuilderHandle>(null);
  const [selectedOptionInfo, setSelectedOptionInfo] = useState<{ optionLabel: string; packageName: string } | null>(null);
  const [offerTotal, setOfferTotal] = useState<number | null>(null);
  const [sendSuccess, setSendSuccess] = useState<SendSuccessInfo | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showAcceptanceDrawer, setShowAcceptanceDrawer] = useState(false);
  const [customer, setCustomer] = useState<{ id?: string; account_invited_at?: string | null; account_activated_at?: string | null } | null>(null);

  const buildPersistableInquiryValues = useCallback((source: Record<string, unknown>) => {
    const {
      lexoffice_quotation_id: _lexofficeQuotationId,
      lexoffice_invoice_id: _lexofficeInvoiceId,
      lexoffice_document_type: _lexofficeDocumentType,
      lexoffice_contact_id: _lexofficeContactId,
      ...persistableValues
    } = source;
    return persistableValues;
  }, []);

  // Fetch inquiry data
  const inquiryQuery = useOne<ExtendedInquiry>({
    resource: "events",
    id: id!,
  });

  const inquiry = inquiryQuery.result;
  const isLoading = inquiryQuery.query.isLoading;

  // Fetch packages
  const packagesQuery = useList<Package>({
    resource: "packages" as never,
    pagination: { pageSize: 100 },
    filters: [{ field: "is_active", operator: "eq", value: true }],
    sorters: [{ field: "sort_order", order: "asc" }],
  });
  const packages = packagesQuery.result?.data || [];

  // Fetch email templates
  const templatesQuery = useList<EmailTemplate>({
    resource: "email_templates" as never,
    pagination: { pageSize: 50 },
    filters: [{ field: "is_active", operator: "eq", value: true }],
    sorters: [{ field: "sort_order", order: "asc" }],
  });
  const templates = templatesQuery.result?.data || [];

  // Update mutation
  const { mutate: updateInquiry } = useUpdate();

  // Kundenkonto-Status laden
  useEffect(() => {
    const email = inquiry?.email;
    if (!email) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("v2_customers")
        .select("id, account_invited_at, account_activated_at")
        .eq("email", email)
        .maybeSingle();
      if (data) setCustomer(data);
    })();
  }, [inquiry?.email]);

  const handleCancelInquiry = async (customerMessage?: string) => {
    if (!id) return;
    const { error } = await (supabase as any)
      .from("events")
      .update({
        status: "declined",
        internal_notes: customerMessage
          ? `${inquiry?.internal_notes ? inquiry.internal_notes + "\n\n" : ""}— Absage-Nachricht (${new Date().toLocaleString("de-DE")}) —\n${customerMessage}`
          : inquiry?.internal_notes,
      })
      .eq("id", id);
    if (error) {
      toast.error("Fehler beim Absagen", { description: error.message });
      throw error;
    }
    toast.success(customerMessage ? "Anfrage abgesagt – Nachricht protokolliert" : "Anfrage abgesagt");
    inquiryQuery.query.refetch();
  };

  // Reset-Effect: Wenn die URL-ID wechselt (Navigation zu anderer Anfrage),
  // muessen wir erlauben dass der lokale State aus der neuen Inquiry
  // initialisiert wird. Muss VOR dem Init-Effect stehen.
  useEffect(() => {
    isInitializedFromDb.current = false;
    setIsInitialized(false);
  }, [id]);

  // Initialize local state from inquiry
  // WICHTIG: nur einmal pro geladener Inquiry-ID ausfuehren. Ohne diesen
  // Guard wird der lokale State bei jedem Refine-Refetch (nach jedem Save)
  // ueberschrieben, was eine Auto-Save-Endlosschleife ausloest.
  useEffect(() => {
    if (inquiry && !isInitializedFromDb.current) {
      setLocalInquiry(buildPersistableInquiryValues(inquiry as unknown as Record<string, unknown>) as Partial<ExtendedInquiry>);
      setQuoteNotes(inquiry.quote_notes || "");
      setEmailDraft(inquiry.email_draft || "");

      try {
        if (inquiry.selected_packages && Array.isArray(inquiry.selected_packages)) {
          setSelectedPackages(inquiry.selected_packages);
        }
        if (inquiry.quote_items && Array.isArray(inquiry.quote_items)) {
          setQuoteItems(inquiry.quote_items);
        }
        const storedMenuSelection = (inquiry as any).menu_selection;
        if (storedMenuSelection && typeof storedMenuSelection === 'object') {
          setMenuSelection({
            courses: storedMenuSelection.courses || [],
            drinks: storedMenuSelection.drinks || [],
          });
        }
      } catch {
        // JSON-Felder konnten nicht geparsed werden — ignorieren
      }

      // Markiere als initialisiert, damit kuenftige Refetches den State
      // unveraendert lassen. Das verhindert die Auto-Save-Endlosschleife.
      isInitializedFromDb.current = true;
      // Snapshot des initial geladenen Zustands setzen — Auto-Save vergleicht
      // gegen diesen Snapshot und feuert nur bei echten User-Änderungen.
      const initialPersistable = buildPersistableInquiryValues(inquiry as unknown as Record<string, unknown>);
      lastSavedSnapshotRef.current = JSON.stringify({
        ...initialPersistable,
        selected_packages: Array.isArray(inquiry.selected_packages) ? inquiry.selected_packages : [],
        quote_items: Array.isArray(inquiry.quote_items) ? inquiry.quote_items : [],
        quote_notes: inquiry.quote_notes || "",
        email_draft: inquiry.email_draft || "",
        menu_selection: (inquiry as any).menu_selection || { courses: [], drinks: [] },
      });
    }
  }, [inquiry, buildPersistableInquiryValues]);

  // Merge local changes with inquiry
  const mergedInquiry = useMemo(() => ({
    ...inquiry,
    ...localInquiry,
    selected_packages: selectedPackages,
    quote_items: quoteItems,
    quote_notes: quoteNotes,
    email_draft: emailDraft,
    menu_selection: menuSelection,
  } as ExtendedInquiry), [inquiry, localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, menuSelection]);

  // Guest count as number
  const guestCount = parseInt(mergedInquiry?.guest_count || '1') || 1;

  // Determine inquiry type
  const inquiryType = mergedInquiry?.inquiry_type || 'event';

  // Get status info
  const getStatusInfo = () => {
    if (inquiry?.status === 'confirmed') return { label: 'Bestätigt', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
    if (inquiry?.status === 'offer_sent') return { label: 'Angebot gesendet', color: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100' };
    if (inquiry?.status === 'declined') return { label: 'Abgelehnt', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    if (inquiry?.last_edited_at) return { label: 'In Bearbeitung', color: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200' };
    return { label: 'Neu', color: 'bg-primary/10 text-primary' };
  };
  const statusInfo = getStatusInfo();

  // Handlers
  const handleLocalFieldChange = useCallback((field: keyof ExtendedInquiry, value: unknown) => {
    setLocalInquiry(prev => ({ ...prev, [field]: value }));
  }, []);

  // Sprache wechseln: öffnet Dialog, falls die Zielsprache von der aktuellen abweicht.
  const handleLanguageSelect = useCallback((target: CustomerLang) => {
    const current = ((inquiry?.customer_language as CustomerLang | null) || 'de');
    if (target === current) return;
    setLangDialog({ open: true, target });
  }, [inquiry?.customer_language]);

  const performLanguageSwitch = useCallback(async (scope: TranslationScope, translate: boolean) => {
    const target = langDialog.target;
    if (!id) return;

    // 1) Sprache lokal + remote setzen (Auto-Save übernimmt remote via handleLocalFieldChange).
    handleLocalFieldChange('customer_language', target);

    // 2) Wenn Zielsprache = de, keine Übersetzungen. Trotzdem last_translated_language updaten.
    try {
      await (supabase as any).from('v2_events').update({
        customer_language: target,
        last_translated_language: target,
      }).eq('id', id);
      setLastTranslatedLang(target);
    } catch (err) {
      console.warn('[lang-switch] persist failed', err);
    }

    if (!translate || target === 'de') {
      toast.success(`Sprache auf ${target.toUpperCase()} gewechselt.`);
      setLangDialog({ open: false, target });
      // Preview-Iframes informieren
      window.dispatchEvent(new CustomEvent('inquiry-language-changed', { detail: { inquiryId: id, language: target } }));
      return;
    }

    const targetLang = target as Exclude<CustomerLang, 'de'>;
    const tasks: Promise<unknown>[] = [];
    const labels: string[] = [];

    if (scope.coverLetter && (emailDraft || inquiry?.email_draft)) {
      labels.push('Anschreiben');
      tasks.push(
        supabase.functions.invoke('translate-offer-letter', {
          body: { inquiry_id: id, target_lang: targetLang, source_text: emailDraft || inquiry?.email_draft || '' },
        }).catch((e: unknown) => { console.warn('[lang-switch] cover-letter failed', e); throw e; })
      );
    }

    if (scope.packageDesc && selectedPackages.length > 0) {
      labels.push('Paket');
      for (const sp of selectedPackages) {
        const pkgId = (sp as { id?: string })?.id;
        if (!pkgId) continue;
        tasks.push(
          supabase.functions.invoke('translate-package-menu', {
            body: { package_id: pkgId, target_langs: [targetLang] },
          }).catch((e: unknown) => { console.warn('[lang-switch] package failed', e); })
        );
      }
    }

    if (scope.menu && quoteItems.length > 0) {
      labels.push('Menü');
      for (const it of quoteItems) {
        tasks.push(
          supabase.functions.invoke('translate-menu-text', {
            body: { texts: { name: it.name || '', description: it.description || '' }, sourceLang: 'de', targetLang },
          }).catch((e: unknown) => { console.warn('[lang-switch] menu item failed', e); })
        );
      }
    }

    if (scope.customerMessage) {
      labels.push('AI-Kundennachricht');
      // Hinweis: AI-Kundennachricht wird beim nächsten Generieren automatisch neu erstellt.
    }

    const toastId = toast.loading(`Übersetze ${labels.length} Inhalt${labels.length === 1 ? '' : 'e'} → ${targetLang.toUpperCase()}…`);
    try {
      await Promise.allSettled(tasks);
      toast.success(`Sprache auf ${targetLang.toUpperCase()} gewechselt. Übersetzt: ${labels.join(', ')}.`, { id: toastId });
    } catch (err) {
      toast.error('Übersetzung teilweise fehlgeschlagen — siehe Konsole.', { id: toastId });
    }

    setLangDialog({ open: false, target });
    window.dispatchEvent(new CustomEvent('inquiry-language-changed', { detail: { inquiryId: id, language: targetLang } }));

    // Aktivitätslog
    try {
      const fromLang = ((inquiry?.customer_language as string | null) || 'de').toUpperCase();
      await (supabase as any).from('activity_log').insert({
        inquiry_id: id,
        action: 'language_changed',
        details: `Kundensprache von ${fromLang} auf ${targetLang.toUpperCase()} geändert. Re-übersetzt: ${labels.join(', ') || '–'}`,
      });
    } catch { /* log table optional */ }
  }, [langDialog.target, id, handleLocalFieldChange, emailDraft, inquiry?.email_draft, inquiry?.customer_language, selectedPackages, quoteItems]);

  const handleItemAdd = useCallback((item: { id: string; name: string; description: string | null; price: number | null }) => {
    setQuoteItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price || 0,
        quantity: 1,
      }];
    });
  }, []);

  const handleItemQuantityChange = useCallback((itemId: string, quantity: number) => {
    setQuoteItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i));
  }, []);

  const handleItemRemove = useCallback((itemId: string) => {
    setQuoteItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  // Get current user email for assignee feature
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      setCurrentUserEmail(user?.email || undefined);
    });
    if (id) {
      (supabase as any)
        .from('v2_events')
        .select('last_translated_language')
        .eq('id', id)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data?.last_translated_language) {
            setLastTranslatedLang(data.last_translated_language as CustomerLang);
          }
        });
    }
    if (id) {
      supabase.from('offer_customer_responses' as never)
        .select('responded_at, selected_option_id, customer_notes')
        .eq('inquiry_id', id)
        .order('responded_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) {
            setCustomerResponse(data as typeof customerResponse);
            const response = data as { selected_option_id: string | null };
            if (response.selected_option_id) {
              supabase.from('offer_builder_options' as never)
                .select('option_label, package_name')
                .eq('id', response.selected_option_id)
                .maybeSingle()
                .then(({ data: optData }: any) => {
                  if (optData) {
                    const opt = optData as { option_label: string; package_name: string };
                    setSelectedOptionInfo({ optionLabel: opt.option_label, packageName: opt.package_name });
                  }
                });
            }
          }
        });

      // Angebotssumme aus aktiver Option laden (für Betrag-Schnellwahl)
      supabase.from('inquiry_offer_options')
        .select('total_amount')
        .eq('inquiry_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data?.total_amount) setOfferTotal(data.total_amount);
        });
    }
  }, []);

  // LexOffice document handling
  const lexofficeDocId = (inquiry as any)?.lexoffice_invoice_id || inquiry?.lexoffice_quotation_id;
  const lexofficeDocType = (inquiry as any)?.lexoffice_document_type ||
    (inquiry?.lexoffice_quotation_id ? 'quotation' : null);

  const handleDownloadDocument = async () => {
    setIsDownloading(true);
    try {
      const latestDoc = id ? await fetchLatestInquiryDocument(id) : null;
      const voucherId = latestDoc?.documentId || lexofficeDocId;
      const voucherType = latestDoc?.documentType || lexofficeDocType;
      if (!voucherId || !voucherType) {
        toast.error("Kein aktuelles Dokument verknüpft");
        return;
      }
      const result = await downloadDocument.mutateAsync({
        voucherId,
        voucherType,
      });
      if (result?.pdf) {
        const byteChars = atob(result.pdf);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        toast.error("PDF konnte nicht geladen werden");
      }
    } catch {
      toast.error("Fehler beim Laden des Dokuments");
    } finally {
      setIsDownloading(false);
    }
  };

  // Ref hält immer die aktuellsten Werte — performSave liest daraus
  useEffect(() => {
    latestValuesRef.current = {
      localInquiry,
      selectedPackages,
      quoteItems,
      quoteNotes,
      emailDraft,
      menuSelection,
    };
  }, [localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, menuSelection]);

  // Stabile Save-Funktion — ändert sich NIE, liest aus Ref
  const performSave = useCallback(async () => {
    if (!id || !isInitialized) return;

    // Retry-Stopp: nach 3 Fehlschlägen in Folge nicht mehr automatisch speichern
    if (consecutiveSaveErrorsRef.current >= 3) return;

    const vals = latestValuesRef.current;
    // Snapshot-Vergleich: Nur speichern wenn sich seit dem letzten Save
    // wirklich etwas geändert hat. Verhindert Auto-Save-Endlosschleifen
    // bei Refine-Refetches und unnötige PATCHes nach Mount.
    const persistableValues = buildPersistableInquiryValues(vals.localInquiry as Record<string, unknown>);
    const currentSnapshot = JSON.stringify({
      ...persistableValues,
      selected_packages: vals.selectedPackages,
      quote_items: vals.quoteItems,
      quote_notes: vals.quoteNotes,
      email_draft: vals.emailDraft,
      menu_selection: vals.menuSelection,
    });
    if (lastSavedSnapshotRef.current === currentSnapshot) {
      return;
    }
    setSaveStatus('saving');

    updateInquiry({
      resource: "events",
      id,
      values: {
        ...persistableValues,
        selected_packages: vals.selectedPackages,
        quote_items: vals.quoteItems,
        quote_notes: vals.quoteNotes,
        email_draft: vals.emailDraft,
        menu_selection: vals.menuSelection,
      },
    }, {
      onSuccess: () => {
        setSaveStatus('saved');
        lastSavedSnapshotRef.current = currentSnapshot;
        setTimeout(() => setSaveStatus('idle'), 2000);
        consecutiveSaveErrorsRef.current = 0;
        errorToastShownRef.current = false;
        // Bei Erfolg den persistenten Error-Toast dismiss'en falls vorhanden
        toast.dismiss('inquiry-save-error-permanent');
      },
      onError: (error: unknown) => {
        consecutiveSaveErrorsRef.current += 1;
        // Fehler-Details extrahieren für bessere UX
        let details = 'Unbekannter Fehler';
        if (error && typeof error === 'object') {
          const err = error as { message?: string; error?: string; details?: string };
          details = err.message || err.error || err.details || JSON.stringify(error).slice(0, 150);
        }
        console.error('[SmartInquiryEditor] Save error:', error);
        setSaveStatus('idle');

        // Nur EINMAL pro Fehler-Serie einen Toast anzeigen (kein Spam)
        if (!errorToastShownRef.current) {
          errorToastShownRef.current = true;
          if (consecutiveSaveErrorsRef.current >= 3) {
            toast.error(
              'Speichern dauerhaft fehlgeschlagen. Seite bitte neu laden.',
              { duration: Infinity, id: 'inquiry-save-error-permanent' }
            );
          } else {
            toast.error(`Fehler beim Speichern: ${details}`, { id: 'inquiry-save-error' });
          }
        }
      },
    });
  }, [buildPersistableInquiryValues, id, isInitialized, updateInquiry]);

  // Auto-save: Debounce auf 1.2s, performSave ist STABIL → kein Re-Trigger
  useEffect(() => {
    if (!isInitialized) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, menuSelection, performSave, isInitialized]);

  // Mark as initialized after first load
  useEffect(() => {
    if (inquiry && !isInitialized) {
      const timeoutId = setTimeout(() => {
        setIsInitialized(true);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [inquiry, isInitialized]);

  // --------------------------------------------------------------------
  // Preview-Rueckkehr: Send-Flow triggern wenn User auf "Jetzt senden"
  // in der Preview-Seite geklickt hat. URL-Query "?confirmed=1|test&send=proposal|final".
  //
  // Schutz gegen doppelten Trigger: Zwei Wege
  //   (a) sendTriggerHandledRef bleibt ueber Component-Lifetime true.
  //   (b) URL wird SYNCHRON bereinigt bevor irgendwas Asynchrones laeuft.
  // Ausserdem: sessionStorage-Schutz damit auch nach F5 nicht nochmal
  // gesendet wird (Ref ueberlebt Reload nicht).
  // --------------------------------------------------------------------
  const [searchParams, setSearchParams] = useSearchParams();
  const sendTriggerHandledRef = useRef(false);
  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    const sendType = searchParams.get('send');
    if (!confirmed || !sendType) return;
    if (!inquiry || !isInitialized) return;
    if (sendTriggerHandledRef.current) return;

    // F5-Schutz NUR fuer echten Versand (confirmed === '1').
    // Test-Mails laufen seit der Refactor direkt aus OfferSendPreview — dieser
    // Branch wird fuer Tests nur noch als Legacy-Fallback erreicht und darf
    // nicht durch sessionStorage-Guards blockiert werden.
    const triggerKey = `send-triggered:${inquiry.id}:${sendType}:${confirmed}`;
    if (confirmed === '1') {
      const lastTrigger = sessionStorage.getItem(triggerKey);
      if (lastTrigger && Date.now() - parseInt(lastTrigger, 10) < 10_000) {
        sendTriggerHandledRef.current = true;
        setSearchParams({}, { replace: true });
        return;
      }
    }

    sendTriggerHandledRef.current = true;

    // URL SOFORT bereinigen — synchron, vor jedem await.
    // Das verhindert dass bei einem Re-Render waehrend des async-Calls
    // der Effect nochmal triggert.
    setSearchParams({}, { replace: true });
    console.info('[SmartInquiryEditor] Send-Trigger aktiviert', {
      confirmed,
      sendType,
      inquiryId: inquiry.id,
    });

    (async () => {
      if (confirmed === 'test') {
        // Testmail: direkte Edge-Function-Call mit isTestPreview, KEINE Phase-Aenderung
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const { data, error } = await supabase.functions.invoke('send-offer-email', {
            body: {
              inquiryId: inquiry.id,
              emailContent: emailDraft || inquiry.email_draft || '',
              customerEmail: inquiry.email || user?.email || 'antoine@monot.com',
              customerName: inquiry.contact_name || '',
              senderEmail: user?.email,
              lexofficeQuotationId: inquiry.lexoffice_quotation_id,
              isTestPreview: true,
            },
          });
          if (error) throw error;
          // Edge-Function liefert die tatsaechlichen Empfaenger in response.recipients.
          // Wir zeigen diese Liste im Toast damit der User sieht was wirklich rausging.
          const recipients: string[] = Array.isArray(data?.recipients) ? data.recipients : [];
          const msgId = data?.messageId ? ` (Resend-ID ${String(data.messageId).slice(0, 8)}…)` : '';
          if (recipients.length > 0) {
            toast.success(`Vorschau-Mail gesendet an: ${recipients.join(', ')}${msgId}`, { duration: 8000 });
          } else {
            toast.success('Vorschau-Mail gesendet', { duration: 6000 });
          }
          sessionStorage.setItem(triggerKey, String(Date.now()));
          if (data && data.emailSent === false) {
            toast.error(`Resend meldet Fehler: ${data.errorMessage || 'Unbekannt'}`, { duration: 10000 });
          }
        } catch (err) {
          console.error('[SmartInquiryEditor] Test-mail failed:', err);
          toast.error(err instanceof Error ? err.message : 'Vorschau-Mail fehlgeschlagen');
        }
        return;
      }

      // =================================================================
      // ECHTER VERSAND — DIREKT GEGEN DIE DB (kein React-State / OfferBuilder).
      // Die DB ist die Wahrheit. So sind wir robust gegen Tab-Navigation,
      // Lazy-Loading und Hydration-Latenz.
      // =================================================================
      const draft = (emailDraft || inquiry.email_draft || '').trim();
      if (!draft) {
        toast.error(
          'Versand abgebrochen: Kein Anschreiben vorhanden. Bitte erst "KI generieren" oder eine Vorlage waehlen.',
          { duration: 10000 },
        );
        return;
      }

      toast.loading('Angebot wird versendet …', { id: 'offer-send-progress' });

      // Options DIRECT aus DB laden — umgeht React-State-Hydration
      const { data: dbOptions, error: optsError } = await supabase
        .from('inquiry_offer_options')
        .select('id, is_active, total_amount')
        .eq('inquiry_id', inquiry.id)
        .eq('is_active', true);

      if (optsError || !dbOptions || dbOptions.length === 0) {
        toast.dismiss('offer-send-progress');
        toast.error('Keine aktiven Optionen in der Datenbank gefunden. Bitte Seite neu laden und erneut versuchen.');
        return;
      }
      console.log('[Send] Step 1 — loaded options from DB:', dbOptions.length);

      // Aktuelle Version aus History
      const { data: historyRow } = await supabase
        .from('inquiry_offer_history')
        .select('version')
        .eq('inquiry_id', inquiry.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      const currentVersion = (historyRow as { version: number } | null)?.version || 0;
      const newVersion = currentVersion + 1;
      console.log('[Send] Step 2 — version:', { currentVersion, newVersion });

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const nowIso = new Date().toISOString();
        console.log('[Send] Step 3 — auth user:', user?.email);

        // 1. Snapshot der aktiven Options laden
        const { data: fullOptions } = await supabase
          .from('inquiry_offer_options')
          .select('*')
          .eq('inquiry_id', inquiry.id)
          .eq('is_active', true);

        // 2. KRITISCH: Inquiry zuerst updaten — bevor irgendeine Mail rausgeht.
        //    Wenn das fehlschlägt, brechen wir komplett ab (sonst sieht der Kunde
        //    eine leere Angebotsseite weil offer_phase noch 'draft' ist).
        const phaseTarget = sendType === 'final' ? 'final_sent' : 'proposal_sent';
        const updatePayload = {
          current_offer_version: newVersion,
          offer_sent_at: nowIso,
          offer_sent_by: user?.email || null,
          status: 'offer_sent',
          offer_phase: phaseTarget,
        };
        console.log('[Send] Step 4 — updating event_inquiries:', updatePayload);
        const { data: updData, error: updErr } = await supabase
          .from('event_inquiries')
          .update(updatePayload as Record<string, unknown>)
          .eq('id', inquiry.id)
          .select('id, offer_phase, status, current_offer_version, offer_sent_at');
        if (updErr) {
          console.error('[Send] Phase-Update fehlgeschlagen:', updErr);
          toast.dismiss('offer-send-progress');
          toast.error('Phase-Update fehlgeschlagen: ' + updErr.message + ' — Versand abgebrochen.', { duration: 15000 });
          return;
        }
        if (!updData || updData.length === 0) {
          console.error('[Send] Phase-Update returned 0 rows — RLS oder ID-Mismatch?', { inquiryId: inquiry.id });
          toast.dismiss('offer-send-progress');
          toast.error('Phase-Update lieferte 0 Zeilen — vermutlich Rechte-Problem. Versand abgebrochen.', { duration: 15000 });
          return;
        }
        console.log('[Send] Step 4 OK — DB confirms:', updData[0]);

        // 3. History-Eintrag anlegen (snapshot der aktiven Options)
        const { error: histErr } = await supabase.from('inquiry_offer_history').insert([{
          inquiry_id: inquiry.id,
          version: newVersion,
          sent_by: user?.email || null,
          email_content: draft,
          options_snapshot: fullOptions as unknown,
        }] as never);
        if (histErr) {
          console.error('[Send] History-Insert fehlgeschlagen (non-blocking):', histErr);
        } else {
          console.log('[Send] Step 5 — history version', newVersion, 'gespeichert');
        }

        // 4. LexOffice-Quotation (non-blocking) — nur beim Proposal
        let lexQuotationId: string | null = null;
        if (sendType === 'proposal' && !inquiry.lexoffice_quotation_id) {
          try {
            const { data: quotRes } = await supabase.functions.invoke('create-event-quotation', {
              body: { inquiryId: inquiry.id },
            });
            if (quotRes?.success && quotRes.quotationId) {
              lexQuotationId = quotRes.quotationId;
              await supabase.from('event_inquiries')
                .update({ lexoffice_quotation_id: lexQuotationId } as Record<string, unknown>)
                .eq('id', inquiry.id);
              console.log('[Send] Step 6 — LexOffice quotation:', lexQuotationId);
            }
          } catch (lexErr) {
            console.error('[Send] LexOffice error (non-blocking):', lexErr);
          }
        }

        // 5. Stripe-Links erstellen (nur bei final)
        if (sendType === 'final' && fullOptions) {
          for (const opt of fullOptions as Array<Record<string, unknown>>) {
            if (opt.stripe_payment_link_url || !opt.total_amount || Number(opt.total_amount) <= 0) continue;
            try {
              const { data: linkData } = await supabase.functions.invoke('create-offer-payment-link', {
                body: {
                  inquiryId: inquiry.id,
                  optionId: opt.id,
                  packageName: (opt.menu_selection as Record<string, unknown> | null)?.packageNameOverride || 'Angebot',
                  amount: Number(opt.total_amount),
                  customerEmail: inquiry.email || '',
                  customerName: inquiry.contact_name || '',
                  eventDate: inquiry.preferred_date || '',
                  guestCount: opt.guest_count,
                  companyName: inquiry.company_name || undefined,
                },
              });
              if (linkData?.paymentLinkUrl) {
                await supabase.from('inquiry_offer_options').update({
                  stripe_payment_link_url: linkData.paymentLinkUrl,
                  stripe_payment_link_id: linkData.paymentLinkId,
                }).eq('id', opt.id as string);
              }
            } catch (linkErr) {
              console.error('[Send] Stripe link error:', linkErr);
            }
          }
        }

        // 5. Email an Kunden senden
        let emailSent = false;
        let emailMessageId: string | null = null;
        if (inquiry.email) {
          const { guardRecipientEmail } = await import('@/lib/operatorEmailGuard');
          if (!guardRecipientEmail(inquiry.email)) {
            toast.dismiss('offer-send-progress');
            toast.warning(
              `Versand abgebrochen: Empfänger ${inquiry.email} ist eine Betreiber-Adresse. ` +
              `Bitte Kunden-Adresse korrigieren.`,
              { duration: 12000 }
            );
            return;
          }
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-offer-email', {
            body: {
              inquiryId: inquiry.id,
              emailContent: draft,
              customerEmail: inquiry.email,
              customerName: inquiry.contact_name || '',
              senderEmail: user?.email,
              lexofficeQuotationId: lexQuotationId,
              confirmedOperatorOverride: true,
            },
          });
          if (emailError || !emailResult?.emailSent) {
            toast.dismiss('offer-send-progress');
            toast.warning('Angebot gespeichert, aber Email-Versand fehlgeschlagen. Bitte Resend-Dashboard prüfen.', { duration: 15000 });
          } else {
            emailSent = true;
            emailMessageId = emailResult?.messageId ?? null;
            toast.dismiss('offer-send-progress');
            toast.success('Angebot erfolgreich an Kunde versendet');
          }
        } else {
          toast.dismiss('offer-send-progress');
          toast.info('Angebot gespeichert (keine E-Mail-Adresse hinterlegt)');
        }

        sessionStorage.setItem(triggerKey, String(Date.now()));

        // Erfolgs-Modal (nur Proposal — Final hat eigenen Flow)
        if (sendType !== 'final') {
          setSendSuccess({
            emailSent,
            recipient: inquiry.email ?? null,
            messageId: emailMessageId,
            sentAt: nowIso,
          });
        }
      } catch (err) {
        console.error('[SmartInquiryEditor] Direct send failed:', err, {
          inquiryId: inquiry.id,
          sendType,
        });
        toast.dismiss('offer-send-progress');
        toast.error(err instanceof Error ? err.message : 'Versand fehlgeschlagen');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inquiry?.id,
    inquiry?.email,
    inquiry?.contact_name,
    inquiry?.lexoffice_quotation_id,
    inquiry?.email_draft,
    searchParams,
    isInitialized,
    emailDraft,
    setSearchParams,
  ]);

  // Keyboard shortcuts
  useEditorShortcuts({
    onSave: () => {
      performSave();
      // Toast entfernt — zentrales SaveStatusBadge im Header zeigt den Status
    },
    onSendOffer: () => {},
    onGenerateEmail: () => {},
    onNextInquiry: () => toast.info("Tipp: Nutze ⌘K für schnelle Navigation"),
    onPreviousInquiry: () => toast.info("Tipp: Nutze ⌘K für schnelle Navigation"),
  });

  if (isLoading) {
    return (
      <AdminLayout activeTab="events">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!inquiry) {
    return (
      <AdminLayout activeTab="events">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Anfrage nicht gefunden</p>
          <Button variant="link" onClick={() => navigate('/admin/inquiries')}>
            Zurück zur Übersicht
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const isOfferSent = !!(inquiry as any)?.offer_phase && (inquiry as any).offer_phase !== 'draft';

  return (
    <AdminLayout activeTab="events">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-border/40 mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" onClick={() => navigate('/admin/inquiries')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-semibold text-sm shrink-0">
                {(inquiry.contact_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight truncate max-w-[160px] sm:max-w-none">
                    {inquiry.contact_name || 'Unbekannt'}
                  </h1>
                  <Badge className={cn("text-[10px] sm:text-xs", statusInfo.color)}>
                    {statusInfo.label}
                  </Badge>
                  <Select
                    value={(inquiry.customer_language as CustomerLang | null) || 'de'}
                    onValueChange={(v) => handleLocalFieldChange('customer_language', v as CustomerLang)}
                  >
                    <SelectTrigger
                      className="h-7 w-auto gap-1.5 px-2 py-0 text-xs font-medium bg-muted/40 border-border/60 rounded-md"
                      aria-label="Kundensprache"
                    >
                      <SelectValue>
                        {(() => {
                          const cur = ((inquiry.customer_language as CustomerLang | null) || 'de');
                          const m = HEADER_LANGS.find((l) => l.value === cur)!;
                          return (
                            <span className="flex items-center gap-1.5">
                              <span className="text-sm leading-none">{m.flag}</span>
                              <span>{m.code}</span>
                            </span>
                          );
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      {HEADER_LANGS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{l.flag}</span>
                            <span>{l.label}</span>
                            <span className="text-muted-foreground text-xs">({l.code})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block truncate">
                  {inquiry.company_name && <><Building2 className="h-3 w-3 inline mr-1" />{inquiry.company_name} · </>}
                  {inquiry.preferred_date && <><Calendar className="h-3 w-3 inline mr-1" />{(() => { try { return format(parseISO(inquiry.preferred_date), 'dd.MM.yyyy', { locale: de }); } catch { return inquiry.preferred_date; } })()} · </>}
                  {inquiry.guest_count && <><Users className="h-3 w-3 inline mr-1" />{inquiry.guest_count} Gäste</>}
                </p>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <PrintMenu inquiryId={inquiry.id} />
            {/* Save Status — unsichtbar (speichert automatisch im Hintergrund) */}

            {/* LexOffice Document Button — nur fuer Rechnungen.
                Der frühere "Angebot PDF"-Button wurde entfernt
                (LexOffice-Quotation ist über die Sende-Vorschau erreichbar). */}
            {isOfferSent && lexofficeDocId && lexofficeDocType === 'invoice' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950 px-2 sm:px-3"
                onClick={handleDownloadDocument}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  Rechnung PDF
                </span>
              </Button>
            )}

          </div>
        </div>

        {/* Mobile meta chips row */}
        <div className="sm:hidden mt-2 flex gap-2 overflow-x-auto scrollbar-hide -mx-3 px-3 text-[11px] text-muted-foreground">
          {inquiry.company_name && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap bg-muted/60 rounded-full px-2 py-1">
              <Building2 className="h-3 w-3" />{inquiry.company_name}
            </span>
          )}
          {inquiry.preferred_date && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap bg-muted/60 rounded-full px-2 py-1">
              <Calendar className="h-3 w-3" />{(() => { try { return format(parseISO(inquiry.preferred_date), 'dd.MM.yyyy', { locale: de }); } catch { return inquiry.preferred_date; } })()}
            </span>
          )}
          {inquiry.guest_count && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap bg-muted/60 rounded-full px-2 py-1">
              <Users className="h-3 w-3" />{inquiry.guest_count} Gäste
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions + TEST Badge */}
      <div className="flex items-center gap-2 flex-wrap mb-4 -mt-2">
        {(inquiry as any).is_test && (
          <Badge className="bg-amber-500 text-white text-xs">
            <TestTube2 className="h-3 w-3 mr-1" />
            TEST
          </Badge>
        )}
        <div className="flex-1" />
        {inquiry.email && (
          <InviteCustomerAccountButton
            customerEmail={inquiry.email}
            customerName={inquiry.contact_name || undefined}
            customerId={customer?.id}
            invitedAt={customer?.account_invited_at}
            activatedAt={customer?.account_activated_at}
            onInvited={async () => {
              const { data } = await (supabase as any)
                .from("v2_customers")
                .select("id, account_invited_at, account_activated_at")
                .eq("email", inquiry.email)
                .maybeSingle();
              if (data) setCustomer(data);
            }}
          />
        )}
        {inquiry.status !== "declined" && inquiry.status !== "confirmed" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive"
            onClick={() => setShowCancelDialog(true)}
          >
            <Ban className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Anfrage absagen</span>
          </Button>
        )}
        {isOfferSent &&
          !(inquiry as any)?.order_confirmed_at &&
          inquiry.status !== "declined" &&
          inquiry.status !== "confirmed" && (
            <Button
              size="sm"
              className="gap-1.5 text-xs h-8 bg-foreground text-background hover:bg-foreground/90"
              onClick={() => setShowAcceptanceDrawer(true)}
              title="Angebot wurde angenommen — online oder telefonisch"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Angebot annehmen</span>
            </Button>
          )}
        {isOfferSent && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => window.open(`/offer/${id}`, '_blank')}
            title="Öffnet das Angebot in der Kunden-Ansicht (neuer Tab)"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kunden-Ansicht</span>
          </Button>
        )}
      </div>

      <CancellationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        context="inquiry"
        customerName={inquiry.contact_name || ""}
        orderNumber={`Anfrage #${(inquiry.id || "").slice(0, 8)}`}
        eventDate={inquiry.preferred_date || undefined}
        onConfirm={(msg) => handleCancelInquiry(msg)}
        title="Anfrage absagen"
        confirmLabel="Absagen & Nachricht protokollieren"
      />

      <OfferAcceptanceDrawer
        open={showAcceptanceDrawer}
        onClose={() => setShowAcceptanceDrawer(false)}
        inquiryId={id!}
        customerName={inquiry.contact_name}
        preferredDate={inquiry.preferred_date}
        onConfirmed={() => {
          inquiryQuery.query.refetch();
        }}
      />

      {/* Main Content — Tab-Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="relative">
        <TabsList className="w-full justify-start bg-muted/30 rounded-xl p-1 h-auto overflow-x-auto scrollbar-hide flex">
          <TabsTrigger value="angebot" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Angebot</TabsTrigger>
          <TabsTrigger value="mails" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Nachrichten</TabsTrigger>
          <TabsTrigger value="aufgaben" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Aufgaben</TabsTrigger>
          <TabsTrigger value="details" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Details</TabsTrigger>
        </TabsList>
        {/* Mobile scroll hint — gradient fade on right edge */}
        <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent rounded-r-xl" />
        </div>

        {/* Tab: Angebot */}
        <TabsContent value="angebot" className="mt-6 space-y-6">
          {/* Payment-Status Strip — kompakt, klickbar → Details-Tab */}
          <PaymentStatusStrip
            inquiryId={id!}
            onNavigateToDetails={() => setActiveTab('details')}
          />

          {/* Multi-Package Offer Section */}
          {inquiryType === 'event' ? (
            <OfferBuilder
              ref={offerBuilderRef}
              inquiry={mergedInquiry}
              packages={packages}
              templates={templates}
              onSave={performSave}
              onFieldChange={handleLocalFieldChange}
              onEmailContentChange={setEmailDraft}
            />
          ) : (
            /* Catering inquiries use existing flow */
            <CateringModules
              inquiry={mergedInquiry}
              selectedItems={quoteItems}
              onItemAdd={handleItemAdd}
              onItemQuantityChange={handleItemQuantityChange}
              onItemRemove={handleItemRemove}
              onDeliveryChange={(field, value) => handleLocalFieldChange(field, value)}
            />
          )}

          {/* Versionsverlauf der versendeten Angebote — bleibt für event & catering */}
          {id && <OfferHistoryList inquiryId={id} />}

        </TabsContent>

        {/* Tab: Nachrichten — Mail-Client-Ansicht (Sidebar + Reading Pane) */}
        <TabsContent value="mails" className="mt-6">
          {id && (
            <Tabs value={mailsSubView} onValueChange={(v) => setMailsSubView(v as "inbox" | "mapping")} className="w-full">
              <TabsList className="rounded-lg bg-muted/40 p-1 mb-4">
                <TabsTrigger value="inbox" className="rounded-md text-sm px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Posteingang</TabsTrigger>
                <TabsTrigger value="mapping" className="rounded-md text-sm px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Mails zuordnen</TabsTrigger>
              </TabsList>
              <TabsContent value="inbox" className="mt-0">
                <MailClient
                  inquiryId={id}
                  customerEmail={inquiry.email || undefined}
                  onSendReply={async ({ to, cc, bcc, subject, html, text }) => {
                    const { error } = await supabase.functions.invoke("send-offer-email", {
                      body: {
                        inquiryId: id,
                        to,
                        cc: cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                        bcc: bcc ? bcc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                        emailSubject: subject,
                        emailHtml: html,
                        emailText: text,
                        isReply: true,
                      },
                    });
                    if (error) throw error;
                  }}
                />
              </TabsContent>
              <TabsContent value="mapping" className="mt-0">
                <EventMailsTab
                  eventId={id}
                  contactEmail={inquiry.email || undefined}
                  contactName={inquiry.contact_name || undefined}
                  eventName={inquiry.event_type || undefined}
                />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* Tab: Aufgaben */}
        <TabsContent value="aufgaben" className="mt-6 space-y-6">
          <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" />
                Aufgaben & Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskManager
                inquiryId={id!}
                currentUserEmail={currentUserEmail}
              />
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Interne Notiz
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StaffNote
                note={inquiry.internal_notes || ''}
                onNoteChange={(note) => handleLocalFieldChange('internal_notes', note)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Details */}
        <TabsContent value="details" className="mt-6 space-y-6">
          {/* Event DNA + Location (slot) + Kontakt & Firma + Assignee + Originale Kundenanfrage */}
          <EventDNACard
            inquiry={mergedInquiry}
            onFieldChange={handleLocalFieldChange}
            isReadOnly={inquiry.status === 'confirmed'}
            currentUserEmail={currentUserEmail}
            onAssigneeChange={(email) => handleLocalFieldChange('assigned_to', email)}
            onPriorityChange={(priority) => handleLocalFieldChange('priority', priority)}
            locationSlot={
              <LocationBlock
                inquiry={mergedInquiry}
                onFieldChange={handleLocalFieldChange}
                isReadOnly={inquiry.status === 'confirmed'}
              />
            }
          />
          {/* Client Preview */}
          <ClientPreview
            inquiryId={id!}
            version={inquiry.current_offer_version || 1}
          />
          {/* Zahlungen */}
          <div data-payment-card>
            <PaymentCard
              inquiryId={id!}
              preferredDate={inquiry.preferred_date}
              offerTotal={offerTotal}
              isTest={!!inquiry.is_test}
            />
          </div>
          {/* Timeline */}
          <Timeline entityType="event_inquiry" entityId={id!} />
        </TabsContent>

      </Tabs>

      <SendSuccessDialog
        open={!!sendSuccess}
        info={sendSuccess}
        onClose={() => setSendSuccess(null)}
        onGoToList={() => { setSendSuccess(null); navigate('/admin/inquiries'); }}
        onGoToOffer={() => { setSendSuccess(null); if (inquiry?.id) window.open(`/offer/${inquiry.id}`, '_blank', 'noopener,noreferrer'); }}
      />

    </AdminLayout>
  );
};
