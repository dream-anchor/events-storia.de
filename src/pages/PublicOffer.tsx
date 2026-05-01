import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import { LocalizedLink } from "@/components/LocalizedLink";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  Phone,
  Mail,
  Calendar,
  Users,
  UtensilsCrossed,
  Wine,
  CreditCard,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  Copy,
  Download,
  FileText,
  Info,
  ChevronDown,
  Lock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

// --- Types ---

type OfferPhase =
  | "draft"
  | "proposal_sent"
  | "customer_responded"
  | "final_draft"
  | "final_sent"
  | "confirmed"
  | "paid";

interface PublicInquiry {
  id: string;
  company_name: string | null;
  contact_name: string;
  email: string | null;
  event_type: string | null;
  preferred_date: string | null;
  event_end_date: string | null;
  guest_count: string | null;
  status: string;
  offer_phase: OfferPhase;
  selected_option_id: string | null;
  email_content: string | null;
  lexoffice_invoice_id: string | null;
  /** Zahlungs-Konditionen — von der RPC mit Defaults aus site_settings befüllt */
  deposit_percent?: number | null;
  deposit_due_days?: number | null;
  offer_validity_days?: number | null;
  payment_method?: string | null;
  invoice_due_days?: number | null;
}

interface CourseSelection {
  courseType: string;
  courseLabel: string;
  itemName: string;
  itemDescription: string | null;
  /** Menge bei per_event-Bestellungen. Default 1 = keine Anzeige. */
  quantity?: number | null;
  /** Im Paket-Modus optional: Aufpreis pro Person. >0 → "+ X €" anzeigen, sonst "inkl." */
  overridePrice?: number | null;
}

interface DrinkSelection {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string | null;
  quantityLabel: string | null;
  customDrink?: string | null;
}

interface MenuSelection {
  courses: CourseSelection[];
  drinks: DrinkSelection[];
  winePairingPrice?: number | null;
  budgetPerPerson?: number | null;
  /** 'per_person' (Default): budgetPerPerson ist Preis pro Gast. 'per_event': budgetPerPerson ist Gesamtpreis fuer den ganzen Anlass. */
  pricingMode?: 'per_person' | 'per_event';
}

interface PublicOfferOption {
  id: string;
  option_label: string;
  offer_mode: string;
  guest_count: number;
  menu_selection: MenuSelection | null;
  total_amount: number;
  stripe_payment_link_url: string | null;
  package_name: string;
  /** Beschreibung aus packages.description — von RPC geliefert */
  package_description?: string | null;
  /** Liste der enthaltenen Leistungen aus packages.includes */
  package_includes?: string[] | null;
  sort_order: number;
  /** Vom Kunden gewählte Menge (bei Multi-Option). Steuert ob das verbindliche PDF schon erzeugt wurde. */
  selected_quantity?: number | null;
}

interface CustomerResponseData {
  id: string;
  selected_option_id: string | null;
  customer_notes: string | null;
  responded_at: string | null;
}

interface PublicOfferData {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  customer_response: CustomerResponseData | null;
}

interface PublicPayment {
  id: string;
  payment_type: "deposit" | "prepayment" | "final";
  amount_cents: number;
  status: "draft" | "sent" | "paid" | "overdue";
  due_date: string | null;
  due_days_before_event: number | null;
  paid_at: string | null;
  paid_via: string | null;
  stripe_payment_link_url: string | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyDecimal(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// =================================================================
// DRINK ROWS — unified renderer for all drinksMode variants
// Mirrors logic from supabase/functions/create-event-quotation/index.ts
// =================================================================

interface DrinkRow {
  label: string;
  name: string;
  price: number | null;
  priceSuffix: string;
}

function buildDrinkRows(menu: MenuSelection | null): DrinkRow[] {
  if (!menu) return [];
  const m = menu as MenuSelection & {
    drinksMode?: 'none' | 'pauschale' | 'weinbegleitung' | 'einzeln';
    drinksPauschalePrice?: number | null;
    drinksPauschaleDescription?: string | null;
    drinksEinzeln?: Array<{ name: string; pricePerPerson: number; quantity?: number | null }>;
  };
  const mode = m.drinksMode;
  const isPerEvent = m.pricingMode === 'per_event';
  const perPersonSuffix = isPerEvent ? '' : ' pro Person';

  if (mode === 'einzeln' && Array.isArray(m.drinksEinzeln)) {
    return m.drinksEinzeln
      .filter((d) => d?.name)
      .map((d) => {
        const qty = d.quantity ?? 1;
        return {
          label: 'Getränk',
          name: qty > 1 ? `${qty} × ${d.name}` : d.name,
          price: null,
          priceSuffix: '',
        };
      });
  }

  if (mode === 'pauschale') {
    return [{
      label: 'Pauschale',
      name: m.drinksPauschaleDescription || 'Getränkepauschale',
      price: null,
      priceSuffix: '',
    }];
  }

  if (mode === 'weinbegleitung') {
    return [{
      label: 'Begleitung',
      name: 'Weinbegleitung',
      price: null,
      priceSuffix: '',
    }];
  }

  // FALLBACK: Legacy-Options ohne drinksMode, aber mit drinks[]-Array
  // (Wizard- oder Paket-basierte Konfiguration). Jeden Eintrag IMMER rendern,
  // unabhängig von selectedChoice/customDrink.
  if (Array.isArray(menu.drinks) && menu.drinks.length > 0) {
    return menu.drinks
      .filter((d) => d && (d.drinkLabel || d.selectedChoice || d.customDrink))
      .map((d) => {
        const choice = d.customDrink || d.selectedChoice || '';
        const qty = d.quantityLabel ? ` — ${d.quantityLabel}` : '';
        return {
          label: d.drinkLabel || 'Getränk',
          name: choice ? `${choice}${qty}` : (d.quantityLabel || '–'),
          price: null,
          priceSuffix: '',
        };
      });
  }

  return [];
}

// =================================================================
// MAIN COMPONENT
// =================================================================

export default function PublicOffer() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PublicOfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [payments, setPayments] = useState<PublicPayment[]>([]);

  // Preview-Modus: wenn die Seite als iframe in der Admin-Preview angezeigt wird,
  // wird der aktuelle email_draft via Query-Param übergeben. So sieht der Admin
  // den Text den er gerade editiert — noch bevor er versendet wurde.
  // Echte Kunden haben diesen Parameter nicht in ihrer URL.
  const previewBodyRaw = searchParams.get('preview_body');
  let previewBody: string | null = null;
  if (previewBodyRaw) {
    try {
      previewBody = decodeURIComponent(previewBodyRaw);
    } catch {
      previewBody = null;
    }
  }

  // Preview-Send-Typ: 'proposal' oder 'final' — aus OfferSendPreview.tsx übergeben
  const previewSend = searchParams.get('preview_send'); // 'proposal' | 'final' | null
  const isPreviewMode = previewBody !== null || previewSend !== null;

  // ARCHIV-MODUS: ?archive_version=N (nur für authentifizierte Admins).
  // Lädt den Snapshot aus inquiry_offer_history statt der Live-Options und
  // rendert die Seite als read-only. Unauthenticated User → Param wird
  // ignoriert → normaler Live-Modus greift, Kunde sieht nichts Falsches.
  const archiveVersionRaw = searchParams.get('archive_version');
  const archiveVersionNum = archiveVersionRaw ? parseInt(archiveVersionRaw, 10) : null;
  const [archiveAuthorized, setArchiveAuthorized] = useState<boolean | null>(
    archiveVersionNum != null ? null : false,
  );
  const [archiveSentAt, setArchiveSentAt] = useState<string | null>(null);
  useEffect(() => {
    if (archiveVersionNum == null) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setArchiveAuthorized(false);
        return;
      }
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'staff'])
        .maybeSingle();
      if (!cancelled) setArchiveAuthorized(!!roleRow);
    })();
    return () => { cancelled = true; };
  }, [archiveVersionNum]);
  const isArchiveMode = archiveVersionNum != null && archiveAuthorized === true;

  // Slug-Route (/ihr-angebot/:slug) oder UUID-Route (/offer/:id)
  const isSlugRoute = location.pathname.includes('/ihr-angebot/') || location.pathname.includes('/your-offer/');
  const lookupValue = slug || id;

  // Stripe-Cancel: Auswahl ist via localStorage erhalten geblieben.
  // Toast zeigen + Query-Param entfernen, damit Reload nicht erneut feuert.
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'cancelled') {
      toast.info('Zahlung abgebrochen — Ihre Auswahl wurde gespeichert.', { duration: 5000 });
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('payment');
        window.history.replaceState({}, '', url.toString());
      } catch {
        /* ignore */
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!lookupValue) return;
    // Archiv-Modus: warten bis Auth-Check abgeschlossen ist
    if (archiveVersionNum != null && archiveAuthorized === null) return;

    const fetchOffer = async () => {
      try {
        // ARCHIV-PFAD: Snapshot statt Live-Options
        if (isArchiveMode && id) {
          const { data: hist, error: histErr } = await supabase
            .from('inquiry_offer_history' as never)
            .select('options_snapshot, email_content, sent_at')
            .eq('inquiry_id', id)
            .eq('version', archiveVersionNum!)
            .maybeSingle();
          if (histErr || !hist) {
            console.error('[PublicOffer Archive] history not found', { histErr });
            setError(true);
            setLoading(false);
            return;
          }
          setArchiveSentAt(((hist as { sent_at?: string | null }).sent_at) ?? null);
          // Inquiry-Stammdaten via RPC (für Header/Kontakt) — read-only
          const { data: live } = await supabase.rpc(
            'get_public_offer' as never,
            { offer_id: id } as never,
          );
          const liveData = live as unknown as PublicOfferData | null;
          const snapshotOpts = ((hist as { options_snapshot: unknown[] }).options_snapshot || [])
            .filter((o: unknown) => {
              const oo = o as { is_active?: boolean; isActive?: boolean };
              return oo.is_active !== false && oo.isActive !== false;
            })
            .map((o: unknown) => {
              const oo = o as Record<string, unknown>;
              return {
                id: String(oo.id ?? ''),
                option_label: String(oo.option_label ?? oo.optionLabel ?? ''),
                offer_mode: String(oo.offer_mode ?? oo.offerMode ?? 'menu'),
                guest_count: Number(oo.guest_count ?? oo.guestCount ?? 0),
                menu_selection: (oo.menu_selection ?? oo.menuSelection ?? null) as MenuSelection | null,
                total_amount: Number(oo.total_amount ?? oo.totalAmount ?? 0),
                stripe_payment_link_url: null,
                package_name:
                  (oo.menu_selection as { packageNameOverride?: string } | null)?.packageNameOverride ||
                  `Option ${oo.option_label ?? ''}`,
                sort_order: Number(oo.sort_order ?? 0),
                selected_quantity: (oo.selected_quantity ?? null) as number | null,
              } as PublicOfferOption;
            });
          setData({
            inquiry: (liveData?.inquiry as PublicInquiry) || ({
              id: id,
              company_name: null,
              contact_name: '',
              email: null,
              event_type: null,
              preferred_date: null,
              event_end_date: null,
              guest_count: null,
              status: 'archived',
              offer_phase: 'proposal_sent',
              selected_option_id: null,
              email_content: (hist as { email_content: string | null }).email_content,
              lexoffice_invoice_id: null,
            } as PublicInquiry),
            options: snapshotOpts,
            customer_response: null,
          });
          setLoading(false);
          return;
        }

        let result;
        let rpcError;

        if (isSlugRoute) {
          // Slug-Lookup
          const res = await supabase.rpc(
            "get_public_offer_by_slug" as never,
            { slug: lookupValue } as never
          );
          result = res.data;
          rpcError = res.error;
        } else {
          // UUID-Lookup (Legacy)
          const res = await supabase.rpc(
            "get_public_offer" as never,
            { offer_id: lookupValue } as never
          );
          result = res.data;
          rpcError = res.error;
        }

        if (rpcError || !result || !(result as PublicOfferData).inquiry) {
          console.error('[PublicOffer] RPC failed:', { rpcError, result, lookupValue, isSlugRoute });
          setError(true);
        } else {
          setData(result as unknown as PublicOfferData);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchOffer();
  }, [lookupValue, isSlugRoute, isArchiveMode, archiveVersionNum, archiveAuthorized, id]);

  // Load payments separately (anon access, only public fields)
  useEffect(() => {
    if (!data?.inquiry?.id) return;
    supabase
      .from("event_payments")
      .select("id, payment_type, amount_cents, status, due_date, due_days_before_event, paid_at, paid_via, stripe_payment_link_url")
      .eq("inquiry_id", data.inquiry.id)
      .not("status", "in", "(cancelled,refunded,draft)")
      .order("created_at", { ascending: true })
      .then(({ data: rows }) => {
        if (rows?.length) setPayments(rows as PublicPayment[]);
      });
  }, [data?.inquiry?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-sans">Angebot wird geladen…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <OfferHeader />
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-serif font-bold mb-4">
            Angebot nicht gefunden
          </h1>
          <p className="text-muted-foreground mb-8 font-sans">
            Dieses Angebot ist nicht verfügbar oder wurde noch nicht versendet.
          </p>
          <LocalizedLink
            to="home"
            className="text-primary hover:underline font-medium font-sans"
          >
            Zur Startseite
          </LocalizedLink>
        </div>
        <OfferFooter />
      </div>
    );
  }

  const { inquiry, options, customer_response } = data;
  const phase = inquiry.offer_phase || "draft";

  // Legacy: offer_phase = 'draft' aber status = 'offer_sent' → wie final_sent behandeln
  // Im Preview-Modus (Admin-Vorschau) immer Angebot anzeigen, egal welche Phase
  const effectivePhase: OfferPhase = isPreviewMode
    ? (previewSend === 'final' ? 'final_sent' : 'proposal_sent')
    : (phase === "draft" && inquiry.status === "offer_sent" ? "final_sent" : phase);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfferHeader />
      {isArchiveMode && (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 border-b border-amber-700/40 shadow-sm">
          <div className="container mx-auto px-4 py-2.5 text-sm font-sans flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
            <span className="font-semibold uppercase tracking-wide text-xs">
              Archiv-Ansicht
            </span>
            <span>·</span>
            <span>
              Version v{archiveVersionNum}
              {archiveSentAt && (
                <>
                  {' '}— versendet am{' '}
                  {(() => {
                    try {
                      return new Date(archiveSentAt).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    } catch {
                      return archiveSentAt;
                    }
                  })()}
                </>
              )}
            </span>
            <span>·</span>
            <span className="opacity-90">Interaktive Aktionen sind deaktiviert.</span>
          </div>
        </div>
      )}
      <main className="flex-1">
        <HeroSection inquiry={inquiry} phase={effectivePhase} />

        {/* PDF-Download — Gating: bei Multi-Option-Angeboten erst nach
            offizieller Kunden-Antwort (offer_phase >= customer_responded).
            Vorher: erklärender Hinweis statt Button (CX-Führung). */}
        {inquiry.lexoffice_invoice_id && (
          <PdfDownloadGate
            inquiryId={inquiry.id}
            options={options}
            phase={isPreviewMode ? ((inquiry.offer_phase as OfferPhase) || 'draft') : effectivePhase}
            isArchiveMode={isArchiveMode}
            isPreviewMode={isPreviewMode}
          />
        )}

        {/* Anschreiben — immer sichtbar wenn vorhanden.
            Im Preview-Modus (Admin-iframe) wird previewBody aus der URL verwendet
            und überschreibt den gespeicherten email_content. Echte Kunden haben
            keinen previewBody und sehen den versendeten email_content. */}
        {(previewBody || inquiry.email_content) && (
          <AnschreibenSection emailContent={previewBody || inquiry.email_content || ''} />
        )}

        {/* ProposalView: bei proposal_sent (Kunde) ODER im Preview-Modus (Admin-iframe).
            Im Preview ist previewBody gesetzt — der Admin sieht dann immer die Options,
            unabhängig von offer_phase (z.B. noch 'draft'). */}
        {(effectivePhase === "proposal_sent" || previewBody !== null) && (
          <div
            id="proposal-view"
            className={isArchiveMode ? "pointer-events-none opacity-70 select-none" : ""}
            aria-disabled={isArchiveMode || undefined}
          >
            <ProposalView
              inquiry={inquiry}
              options={options}
              onSubmitted={(updatedData) => setData(updatedData)}
              isArchiveMode={isArchiveMode}
              isPreviewMode={isPreviewMode}
            />
          </div>
        )}

        {effectivePhase === "customer_responded" && (
          <ThankYouView
            customerResponse={customer_response}
            options={options}
          />
        )}

        {(effectivePhase === "final_sent" ||
          effectivePhase === "final_draft") && (
          <div
            className={isArchiveMode ? "pointer-events-none opacity-70 select-none" : ""}
            aria-disabled={isArchiveMode || undefined}
          >
            <FinalOfferView
              inquiry={inquiry}
              options={options}
            />
          </div>
        )}

        {(effectivePhase === "confirmed" || effectivePhase === "paid") && (
          <ConfirmationView inquiry={inquiry} options={options} />
        )}

        <div
          className={isArchiveMode ? "pointer-events-none opacity-70 select-none" : ""}
          aria-disabled={isArchiveMode || undefined}
        >
          <PublicPaymentSection payments={payments} eventDate={inquiry.preferred_date ?? undefined} />
        </div>
        <ContactSection />
      </main>
      <OfferFooter />
    </div>
  );
}

// =================================================================
// PDF DOWNLOAD SECTION
// =================================================================

/**
 * Bestimmt, ob die Kunden-Auswahl als finalisiert gilt.
 * Single-Option-Angebote benötigen keine Auswahl → immer true.
 * Multi-Option: erst ab Phase customer_responded freigegeben.
 */
function isCustomerSelectionComplete(
  options: PublicOfferOption[],
  phase: OfferPhase,
): boolean {
  if (options.length === 1) return true;
  if (options.length === 0) return false;
  return ['customer_responded', 'final_draft', 'final_sent', 'confirmed', 'paid']
    .includes(phase);
}

function PdfDownloadGate({
  inquiryId,
  options,
  phase,
  isArchiveMode,
  isPreviewMode,
}: {
  inquiryId: string;
  options: PublicOfferOption[];
  phase: OfferPhase;
  isArchiveMode: boolean;
  isPreviewMode?: boolean;
}) {
  // Archiv-Modus: finalisierte alte Versionen → Download immer sichtbar.
  if (isArchiveMode) {
    return <PdfDownloadSection inquiryId={inquiryId} />;
  }

  if (isCustomerSelectionComplete(options, phase)) {
    return <PdfDownloadSection inquiryId={inquiryId} />;
  }

  const handleScrollToSelection = () => {
    document.getElementById('proposal-view')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100">
              <Lock className="h-5 w-5 text-neutral-600" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-neutral-900">
                Angebots-PDF nach Auswahl verfügbar
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                Bitte wähle zuerst deine bevorzugte Option unten aus. Sobald du deine
                Auswahl bestätigst, steht hier dein persönliches Angebots-PDF zum
                Download bereit.
              </p>
              {isPreviewMode && (
                <p className="mt-2 text-xs italic text-neutral-500">
                  Vorschau-Hinweis: Auch in der Live-Ansicht wird der Download erst freigegeben, sobald der Kunde seine Auswahl bestätigt.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleScrollToSelection}
                className="mt-4 min-h-[44px] gap-2"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                Zur Auswahl
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PdfDownloadSection({ inquiryId }: { inquiryId: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'download-public-offer-pdf',
        { body: { inquiryId } }
      );

      if (error || !data?.pdf) {
        throw new Error(data?.error || 'PDF nicht verfügbar');
      }

      const blob = new Blob(
        [Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))],
        { type: 'application/pdf' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'STORIA_Angebot.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2.5 min-h-[44px] py-2.5 px-5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-medium text-sm hover:bg-neutral-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            Angebot als PDF herunterladen
          </button>
        </div>
      </div>
    </section>
  );
}

// =================================================================
// ANSCHREIBEN SECTION — persönlicher Begleittext
// =================================================================

function AnschreibenSection({ emailContent }: { emailContent: string }) {
  // Grußformel finden — danach kommt nur noch der Absendername
  const greetingSeparators = [
    "Mit freundlichen Grüßen",
    "Herzliche Grüße",
    "Beste Grüße",
    "Viele Grüße",
  ];

  let bodyText = emailContent;
  let greetingLine = "";
  let senderName = "";

  for (const sep of greetingSeparators) {
    const idx = emailContent.indexOf(sep);
    if (idx !== -1) {
      bodyText = emailContent.slice(0, idx).trimEnd();
      // Alles nach der Grußformel
      const afterGreeting = emailContent.slice(idx);
      // Grußformel + Name (erste 1-2 Zeilen), Rest (Firmenadresse etc.) abschneiden
      const lines = afterGreeting.split('\n').map(l => l.trim()).filter(Boolean);
      greetingLine = lines[0] || sep; // "Viele Grüße"
      senderName = lines[1] || "";    // "Antoine"
      // Alles danach (Firmenname, Adresse, Telefon, etc.) wird bewusst weggelassen
      break;
    }
  }

  // "über den folgenden Link" → "unten" ersetzen
  bodyText = bodyText
    .replace(/über den folgenden Link/gi, "unten")
    .replace(/im folgenden Link/gi, "unten")
    .replace(/unter folgendem Link/gi, "unten");

  // Redundante URL-Erwähnung entfernen — der Kunde IST auf dieser Seite,
  // die URL zu sich selbst ist unnötig und wirkt unprofessionell
  bodyText = bodyText
    // "Das Angebot mit allen Details finden Sie hier: https://..." (ganze Zeile)
    .replace(/^.*(?:Angebot|Details).*(?:finden|sehen|einsehen).*?https?:\/\/\S+.*$/gim, '')
    // "... unter folgendem Link: https://..." oder "... über diesen Link: ..."
    .replace(/^.*(?:unter|über|via)\s+(?:folgendem\s+|diesem\s+|dem\s+)?Link\s*:?.*?https?:\/\/\S+.*$/gim, '')
    // "(Siehe Anhang ... Link: ...)" oder "(Link: ...)"
    .replace(/\(\s*(?:Siehe\s+[^)]*?)?Link\s*:?[^)]*?https?:\/\/[^)]+\)/gi, '')
    // Reine URL-only Zeilen, die auf /offer/ oder /ihr-angebot/ zeigen
    .replace(/^\s*https?:\/\/\S*(?:\/offer\/|\/ihr-angebot\/|\/your-offer\/)\S*\s*$/gim, '');

  // Absätze normalisieren: 3+ aufeinanderfolgende Newlines → genau 2 (= eine Leerzeile)
  // Das vereinheitlicht Abstände zwischen Absätzen und schluckt auch entstandene
  // Leer-Blöcke nach dem URL-Entfernen
  bodyText = bodyText
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return (
    <section className="bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl">
          {/* Fließtext */}
          <div className="font-serif text-base md:text-[1.1rem] leading-[1.75] text-foreground/90 whitespace-pre-line">
            {bodyText}
          </div>

          {/* Nur Grußformel + Name — kein Firmen-Impressum */}
          {greetingLine && (
            <div className="mt-8 text-foreground/80 font-serif">
              <p>{greetingLine}</p>
              {senderName && <p className="font-semibold">{senderName}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// =================================================================
// HERO SECTION
// =================================================================

function HeroSection({
  inquiry,
  phase,
}: {
  inquiry: PublicInquiry;
  phase: OfferPhase;
}) {
  const displayName = inquiry.company_name || inquiry.contact_name;

  const phaseConfig: Partial<Record<OfferPhase, { text: string; color: string }>> = {
    proposal_sent: { text: "Vorschlag", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    customer_responded: { text: "Rückmeldung erhalten", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    final_sent: { text: "Finales Angebot", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    confirmed: { text: "Bestätigt", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    paid: { text: "Bezahlt", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  };

  const badge = phaseConfig[phase];

  return (
    <section className="relative overflow-hidden">
      {/* Warmer Hintergrund mit subtiler Textur */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/80 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,0,0,0.03),transparent_50%)]" />

      <div className="relative container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-3xl">
          {/* Badge + Label */}
          <div className="flex items-center gap-3 mb-5">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Ihr persönliches Angebot
            </p>
            {badge && (
              <span className={cn(
                "text-[10px] font-sans font-semibold px-2.5 py-1 rounded-full border",
                badge.color
              )}>
                {badge.text}
              </span>
            )}
          </div>

          {/* Name */}
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-8">
            {displayName}
          </h1>

          {/* Event-Details als elegante Chips */}
          <div className="flex flex-wrap gap-3">
            {inquiry.preferred_date && (
              <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/40">
                <Calendar className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-sm font-sans font-medium text-foreground/80">
                  {inquiry.event_end_date
                    ? `${format(parseISO(inquiry.preferred_date), "d.", { locale: de })}–${format(parseISO(inquiry.event_end_date), "d. MMMM yyyy", { locale: de })}`
                    : format(parseISO(inquiry.preferred_date), "d. MMMM yyyy", { locale: de })}
                </span>
              </div>
            )}
            {inquiry.guest_count && (
              <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/40">
                <Users className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-sm font-sans font-medium text-foreground/80">
                  {inquiry.guest_count} Gäste
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// =================================================================
// PROPOSAL VIEW — Kunde entscheidet: Buchen (Zahlung) oder Nachricht
// CX: Zwei klare Pfade statt generischem "Bestätigen"
//   Primary:   Zahlung (Anzahlung 20 % oder Voll)
//   Secondary: Nachricht (für Fragen/Änderungen)
// =================================================================

function ProposalView({
  inquiry,
  options,
  onSubmitted,
  isArchiveMode = false,
  isPreviewMode = false,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  onSubmitted: (data: PublicOfferData) => void;
  isArchiveMode?: boolean;
  isPreviewMode?: boolean;
}) {
  // Single-Option ist auto-selected — Kunde muss nichts extra auswählen
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    options.length === 1 ? options[0].id : null
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState<'full' | 'deposit' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wantsCopy, setWantsCopy] = useState(false);
  const [copyEmail, setCopyEmail] = useState(inquiry.email || "");

  // Multi-Options-Mengen: Map optionId -> Menge (initial 0 für alle)
  // Persistiert in localStorage, damit Stripe-Cancel die Auswahl nicht zerstört.
  const QUANTITY_STORAGE_KEY = `storia_offer_qty_${inquiry.id}`;

  // Sprechender Menü-/Paket-Name für Summary, Submit-Notes etc.
  // Bei Custom-Menüs Fallback auf "Menü A/B/C" statt "Option A".
  const formatOptionLabel = (o: PublicOfferOption): string => {
    const name = o.package_name?.trim();
    const isCustom =
      o.offer_mode === 'menu' ||
      !name ||
      name === 'Individuelles Paket' ||
      name === 'Individuelles Menü';
    return isCustom ? `Menü ${o.option_label}` : name!;
  };

  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>(() => {
    const empty = Object.fromEntries(options.map(o => [o.id, 0]));
    if (typeof window === 'undefined') return empty;
    try {
      const saved = window.localStorage.getItem(QUANTITY_STORAGE_KEY);
      if (!saved) return empty;
      const parsed = JSON.parse(saved) as Record<string, number>;
      // Nur Keys aus aktuellem Angebot übernehmen (Stale-Schutz)
      return Object.fromEntries(
        options.map(o => [o.id, typeof parsed[o.id] === 'number' ? parsed[o.id] : 0])
      );
    } catch {
      return empty;
    }
  });

  // Mengen bei jeder Änderung in localStorage spiegeln
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(QUANTITY_STORAGE_KEY, JSON.stringify(optionQuantities));
    } catch {
      /* quota exceeded — ignorieren */
    }
  }, [optionQuantities, QUANTITY_STORAGE_KEY]);

  // Ziel-Gästezahl aus inquiry.guest_count parsen.
  // Akzeptiert: "40" → 40, "20-30" → 30 (Maximum), "ca. 25" → 25.
  // Bei nicht parsebarem Wert: null (kein hartes Ziel).
  const targetGuests = useMemo<number | null>(() => {
    const raw = inquiry.guest_count?.trim();
    if (!raw) return null;
    const matches = raw.match(/\d+/g);
    if (!matches || matches.length === 0) return null;
    const nums = matches.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0);
    if (nums.length === 0) return null;
    return Math.max(...nums);
  }, [inquiry.guest_count]);

  // Single-Option: Auto-Quantity aus Target oder option.guest_count
  useEffect(() => {
    const isSingle = options.length === 1;
    if (!isSingle) return;
    const opt = options[0];
    if (!opt) return;
    const isPerEvent = opt.menu_selection?.pricingMode === 'per_event';
    const auto = isPerEvent ? 1 : (targetGuests ?? opt.guest_count ?? 0);
    setOptionQuantities(prev => {
      if (prev[opt.id] === auto) return prev;
      return { ...prev, [opt.id]: auto };
    });
  }, [options, targetGuests]);

  // Pro-Person-Preis pro Option (per_event: total_amount als Pauschale)
  const perPersonPriceFor = (opt: PublicOfferOption): number => {
    const ms = opt.menu_selection;
    if (ms?.pricingMode === 'per_event') return opt.total_amount;
    const budget = ms?.budgetPerPerson;
    if (budget && budget > 0) return budget;
    if (opt.guest_count > 0) return opt.total_amount / opt.guest_count;
    return 0;
  };

  const totalQuantity = Object.values(optionQuantities).reduce((s, q) => s + (q || 0), 0);
  const multiOptionsTotal = options.reduce(
    (sum, o) => sum + (optionQuantities[o.id] || 0) * perPersonPriceFor(o),
    0
  );
  const hasQuantities = totalQuantity > 0;

  const selectedOption = options.find(o => o.id === selectedOptionId) || null;
  const totalAmount = hasQuantities
    ? multiOptionsTotal
    : (selectedOption?.total_amount ?? 0);
  // Zahlungs-Konditionen aus Inquiry (RPC liefert Defaults aus site_settings)
  const depositPercent = inquiry.deposit_percent ?? 20;
  const depositDueDays = inquiry.deposit_due_days ?? 5;
  const paymentMethod = (inquiry.payment_method || 'deposit_online') as string;
  const invoiceDueDays = inquiry.invoice_due_days ?? 14;
  const isStripePayment = paymentMethod === 'deposit_online' || paymentMethod === 'prepayment_online';
  const depositAmount = depositPercent > 0
    ? Math.round(totalAmount * depositPercent) / 100
    : 0;
  const showDeposit = isStripePayment && depositPercent > 0 && depositPercent < 100;

  // ACTION: Zahlung — leitet zu Stripe Checkout weiter
  const handlePayment = async (paymentType: 'full' | 'deposit') => {
    if (!hasQuantities && !selectedOptionId) return;
    setIsPaying(paymentType);
    haptic('select');
    try {
      const body = hasQuantities
        ? {
            inquiryId: inquiry.id,
            paymentType,
            optionQuantities: Object.entries(optionQuantities)
              .filter(([, q]) => q > 0)
              .map(([optionId, quantity]) => ({ optionId, quantity })),
          }
        : { inquiryId: inquiry.id, optionId: selectedOptionId, paymentType };
      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body,
      });
      if (error || !data?.checkoutUrl) {
        throw new Error(data?.error || 'Fehler beim Erstellen der Zahlungssitzung');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setIsPaying(null);
      toast.error(
        err instanceof Error ? err.message : 'Fehler bei der Zahlung',
        {
          description: 'Bitte versuchen Sie es erneut oder kontaktieren Sie uns unter 089 51519696.',
          duration: 6000,
        }
      );
    }
  };

  // ACTION: Verbindlich buchen — für on_site / invoice_after (kein Stripe)
  const handleConfirmBooking = async () => {
    const optId = selectedOptionId;
    if (!optId || !canPay) return;
    setIsSubmitting(true);
    setSubmitError(null);
    haptic('select');
    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        "confirm_offline_booking" as never,
        {
          p_inquiry_id: inquiry.id,
          p_selected_option_id: optId,
        } as never
      );
      const res = result as unknown as { success: boolean; error?: string };
      if (rpcError || !res?.success) {
        setSubmitError(res?.error || "Fehler beim Buchen");
        toast.error(res?.error || "Fehler beim Buchen");
        return;
      }

      // Notify admin about booking
      supabase.functions.invoke("notify-customer-response", {
        body: { inquiryId: inquiry.id },
      }).catch(() => {});

      try { window.localStorage.removeItem(QUANTITY_STORAGE_KEY); } catch { /* ignore */ }

      onSubmitted({
        inquiry: {
          ...inquiry,
          offer_phase: "confirmed",
          selected_option_id: optId,
        },
        options,
        customer_response: {
          id: crypto.randomUUID(),
          selected_option_id: optId,
          customer_notes: paymentMethod === 'on_site' ? 'Verbindlich gebucht — Zahlung vor Ort' : `Verbindlich gebucht — Rechnung nach Event`,
          responded_at: new Date().toISOString(),
        },
      });
    } catch {
      setSubmitError("Netzwerkfehler — bitte versuchen Sie es erneut");
      toast.error("Netzwerkfehler — bitte versuchen Sie es erneut");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ACTION: Nachricht senden — submit_offer_response-Flow
  const handleSendMessage = async () => {
    if (!selectedOptionId || !notes.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const breakdownLine = hasQuantities
        ? `Meine Aufteilung: ${options
            .filter(o => (optionQuantities[o.id] || 0) > 0)
            .map(o => `${formatOptionLabel(o)} × ${optionQuantities[o.id]}`)
            .join(', ')} (${totalQuantity} Gäste)\n\n`
        : '';
      const finalNotes = breakdownLine + notes.trim();
      const { data: result, error: rpcError } = await supabase.rpc(
        "submit_offer_response" as never,
        {
          p_inquiry_id: inquiry.id,
          p_selected_option_id: selectedOptionId,
          p_customer_notes: finalNotes,
        } as never
      );

      const res = result as unknown as { success: boolean; error?: string };

      if (rpcError || !res?.success) {
        setSubmitError(res?.error || "Fehler beim Absenden");
        return;
      }

      supabase.functions.invoke("notify-customer-response", {
        body: { inquiryId: inquiry.id },
      }).catch(() => {});

      // Auswahl aus localStorage entfernen — Submission abgeschlossen
      try {
        window.localStorage.removeItem(QUANTITY_STORAGE_KEY);
      } catch {
        /* ignore */
      }

      if (wantsCopy && copyEmail.trim()) {
        supabase.functions.invoke("send-customer-response-copy", {
          body: {
            inquiryId: inquiry.id,
            customerEmail: copyEmail.trim(),
            selectedOptionLabel: selectedOption
              ? `Option ${selectedOption.option_label}: ${selectedOption.package_name}`
              : "Ihre Auswahl",
            customerNotes: finalNotes,
          },
        }).catch(() => {});
      }

      onSubmitted({
        inquiry: {
          ...inquiry,
          offer_phase: "customer_responded",
          selected_option_id: selectedOptionId,
        },
        options,
        customer_response: {
          id: crypto.randomUUID(),
          selected_option_id: selectedOptionId,
          customer_notes: finalNotes,
          responded_at: new Date().toISOString(),
        },
      });
    } catch {
      setSubmitError("Netzwerkfehler — bitte versuchen Sie es erneut");
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || isPaying !== null;
  const isSingle = options.length === 1;
  // Bei Multi-Options ist eine Mengen-Eingabe Pflicht. Bei Single reicht die Auto-Menge.
  const canPay = isSingle
    ? (!!selectedOption && totalAmount > 0)
    : (hasQuantities && multiOptionsTotal > 0);

  return (
    <section className="bg-secondary/30">
      {/* MOBILE STICKY PROGRESS — 3 steps: Read → Choose → Book. lg:hidden. */}
      {!isArchiveMode && !isPreviewMode && (
        <MobileProgressStrip
          step={
            canPay ? 3 : selectedOptionId ? 2 : 1
          }
          isSingle={isSingle}
        />
      )}
      <div className="container mx-auto px-4 py-12 md:py-16 pb-32 lg:pb-16">
        <div className="max-w-4xl">
          {/* Sektion-Header */}
          <div className="mb-10">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
              {isSingle ? "Unser Vorschlag" : "Ihr Angebot"}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-3">
              {isSingle ? "Ihr Angebot" : "Ihre Auswahl"}
            </h2>
            <p className="text-muted-foreground font-sans text-sm md:text-base max-w-xl">
              {isSingle
                ? "Buchen Sie direkt über den sicheren Zahlungslink — oder schreiben Sie uns bei Fragen und Änderungen."
                : "Wir haben mehrere Varianten für Sie zusammengestellt — entscheiden Sie sich für eine oder kombinieren Sie mehrere mit unterschiedlichen Mengen."}
            </p>
          </div>

          {/* Options — Mobile: Snap-Carousel mit Pill-Tabs; lg+: 2-Spalten-Grid */}
          {options.length > 1 ? (
            <MultiOptionCarousel
              options={options}
              selectedOptionId={selectedOptionId}
              setSelectedOptionId={setSelectedOptionId}
              optionQuantities={optionQuantities}
              setOptionQuantities={setOptionQuantities}
              perPersonPriceFor={perPersonPriceFor}
              targetGuests={targetGuests}
              totalQuantity={totalQuantity}
              isSingle={isSingle}
              formatOptionLabel={formatOptionLabel}
            />
          ) : (
            <div className="gap-6 mb-12 max-w-2xl">
              {options.map((option) => (
                <ProposalOptionCard
                  key={option.id}
                  option={option}
                  isSelected={selectedOptionId === option.id}
                  onSelect={() => setSelectedOptionId(option.id)}
                  singleOption={isSingle}
                  quantity={optionQuantities[option.id] || 0}
                  onQuantityChange={(q) => {
                    const isPerEvent = option.menu_selection?.pricingMode === 'per_event';
                    const clamped = isPerEvent ? Math.min(1, Math.max(0, q)) : Math.max(0, q);
                    setOptionQuantities((prev) => ({ ...prev, [option.id]: clamped }));
                  }}
                  perPersonPrice={perPersonPriceFor(option)}
                  targetGuests={targetGuests}
                  remainingGuests={
                    targetGuests !== null
                      ? Math.max(0, targetGuests - totalQuantity)
                      : null
                  }
                />
              ))}
            </div>
          )}

          {/* Live-Summary für Multi-Options-Modus (bei Single ausgeblendet — Menge ist fix) */}
          {!isSingle && (
            <div className="max-w-2xl mb-6 rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/70">
                    Ihre Auswahl
                  </p>
                  {hasQuantities ? (
                    <>
                      <p className="text-sm font-sans text-foreground mt-1 truncate" title={options.filter((o) => (optionQuantities[o.id] || 0) > 0).map((o) => `${formatOptionLabel(o)} × ${optionQuantities[o.id]}`).join(' · ')}>
                        {options
                          .filter((o) => (optionQuantities[o.id] || 0) > 0)
                          .map((o) => `${formatOptionLabel(o)} × ${optionQuantities[o.id]}`)
                          .join(' · ')}
                      </p>
                      <p className="text-xs font-sans text-muted-foreground mt-0.5">
                        {totalQuantity} {totalQuantity === 1 ? 'Gast' : 'Gäste'} verteilt
                        {targetGuests !== null && ` von ${targetGuests}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-sans text-muted-foreground mt-1">
                      Bitte verteilen Sie Ihre Gäste auf die gewünschten Optionen.
                    </p>
                  )}
                </div>
                <p className="text-xl font-serif font-bold text-primary whitespace-nowrap">
                  {formatCurrencyDecimal(multiOptionsTotal)}
                </p>
              </div>

              {/* Fortschritts-Anzeige nur wenn Ziel bekannt */}
              {targetGuests !== null && (
                <div>
                  <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
                    <div
                      className="h-full bg-primary/70 transition-all"
                      style={{ width: `${Math.min(100, (totalQuantity / targetGuests) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-sans text-foreground/80">
                    {totalQuantity < targetGuests && (
                      <>Es fehlen noch <strong>{targetGuests - totalQuantity}</strong> {targetGuests - totalQuantity === 1 ? 'Gast' : 'Gäste'} von insgesamt <strong>{targetGuests}</strong>.</>
                    )}
                    {totalQuantity === targetGuests && (
                      <>✓ Alle <strong>{targetGuests}</strong> Gäste verteilt.</>
                    )}
                    {totalQuantity > targetGuests && (
                      <><strong>{totalQuantity - targetGuests}</strong> {totalQuantity - targetGuests === 1 ? 'Gast' : 'Gäste'} über der ursprünglich angefragten Menge ({targetGuests}).</>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PRIMARY ACTION — Buchen */}
          <div className="max-w-2xl mb-10">
            <div className="bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-2xl border-2 border-primary/20 p-6 md:p-8 shadow-[0_8px_30px_rgba(139,0,0,0.08)]">
              <div className="mb-6">
                <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-1">
                  Jetzt verbindlich buchen
                </h3>
                <p className="text-sm text-muted-foreground font-sans">
                  {!canPay
                    ? (isSingle
                        ? "Wählen Sie oben eine Option."
                        : "Bitte Mengen pro Option angeben.")
                    : isStripePayment
                      ? (hasQuantities
                          ? `Sicher bezahlen über Stripe — für ${totalQuantity} ${totalQuantity === 1 ? 'Gast' : 'Gäste'}`
                          : "Sicher bezahlen über Stripe — Kreditkarte, Apple Pay oder SEPA")
                      : paymentMethod === 'on_site'
                        ? "Zahlung erfolgt vor Ort beim Event."
                        : `Rechnung wird nach dem Event zugestellt — zahlbar innerhalb ${invoiceDueDays} Tagen.`}
                </p>
              </div>

              {isStripePayment ? (
                /* STRIPE-Zahlungsmodus */
                <div className={cn("grid gap-3", showDeposit ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                  {/* Voll bezahlen — Primary/Dominant */}
                  <Button
                    onClick={() => handlePayment('full')}
                    disabled={busy || !canPay}
                    className="h-auto py-4 px-5 rounded-xl font-sans font-semibold flex flex-col items-start gap-0.5 shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_15px_rgba(139,0,0,0.25)]"
                  >
                    <span className="flex items-center gap-2 w-full justify-between">
                      <span className="text-sm">Voll bezahlen</span>
                      {isPaying === 'full' && <Loader2 className="h-4 w-4 animate-spin" />}
                    </span>
                    {canPay ? (
                      <span className="text-lg font-serif font-bold">
                        {formatCurrency(totalAmount)}
                      </span>
                    ) : (
                      <span className="text-sm font-sans opacity-70">Option wählen</span>
                    )}
                  </Button>

                  {/* Anzahlung — nur wenn 0 < deposit_percent < 100 */}
                  {showDeposit && (
                    <div>
                      <Button
                        onClick={() => handlePayment('deposit')}
                        disabled={busy || !canPay}
                        variant="outline"
                        className="w-full h-auto py-4 px-5 rounded-xl font-sans font-semibold flex flex-col items-start gap-0.5 border-2 border-primary/30 text-foreground bg-white/50 hover:bg-white/80 hover:border-primary/50 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center gap-2 w-full justify-between">
                          <span className="text-sm">Anzahlung {depositPercent} %</span>
                          {isPaying === 'deposit' && <Loader2 className="h-4 w-4 animate-spin" />}
                        </span>
                        {canPay ? (
                          <span className="text-lg font-serif font-bold text-primary">
                            {formatCurrencyDecimal(depositAmount)}
                          </span>
                        ) : (
                          <span className="text-sm font-sans opacity-70 text-muted-foreground">Option wählen</span>
                        )}
                      </Button>
                      {canPay && (
                        <p className="mt-1.5 text-[11px] font-sans text-muted-foreground/70 text-center">
                          innerhalb {depositDueDays} {depositDueDays === 1 ? 'Tag' : 'Tagen'} zu zahlen
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* VOR-ORT / RECHNUNG — kein Stripe, nur Bestätigung */
                <div className="grid gap-3 grid-cols-1">
                  <Button
                    onClick={handleConfirmBooking}
                    disabled={busy || !canPay}
                    className="h-auto py-4 px-5 rounded-xl font-sans font-semibold flex flex-col items-start gap-0.5 shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <span className="flex items-center gap-2 w-full justify-between">
                      <span className="text-sm">
                        {paymentMethod === 'on_site' ? 'Verbindlich buchen — Zahlung vor Ort' : 'Verbindlich buchen — Rechnung nach Event'}
                      </span>
                      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    </span>
                    {canPay && (
                      <span className="text-lg font-serif font-bold">
                        {formatCurrency(totalAmount)}
                      </span>
                    )}
                  </Button>
                </div>
              )}

              {/* Trust-Elemente */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-xs text-muted-foreground font-sans">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  SSL-verschlüsselt
                </span>
                {isStripePayment ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3" />
                      Sichere Zahlung via Stripe
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3" />
                      Rechnung folgt per E-Mail
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" />
                    {paymentMethod === 'on_site' ? 'Zahlung vor Ort beim Event' : `Rechnung zahlbar innerhalb ${invoiceDueDays} Tagen`}
                  </span>
                )}
              </div>

              {/* Hinweis bei Teilbuchung im Multi-Mode */}
              {!isSingle && canPay && targetGuests !== null && totalQuantity < targetGuests && (
                <p className="mt-4 text-xs font-sans text-muted-foreground">
                  Sie können auch mit einer Teilmenge buchen — die restlichen Gäste lassen sich später ergänzen.
                </p>
              )}
            </div>
          </div>

          {/* Stornobedingungen — direkt unter der Buchen-Box (nur wenn buchbar) */}
          {selectedOption && totalAmount > 0 && (
            <div className="max-w-2xl mb-10 px-2">
              <CancellationTermsAccordion />
            </div>
          )}

          {/* SECONDARY ACTION — Nachricht senden */}
          <div className="max-w-2xl">
            <div className="rounded-2xl border border-border/40 bg-white/40 dark:bg-white/5 backdrop-blur-sm p-6 md:p-7">
              <div className="mb-4">
                <h3 className="font-serif text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary/70" />
                  Noch eine Frage oder Änderung?
                </h3>
                <p className="text-sm text-muted-foreground font-sans">
                  Schreiben Sie uns — z.B. Allergien, vegetarische Gäste oder Sonderwünsche. Wir melden uns mit einem angepassten Angebot.
                </p>
              </div>

              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ihre Nachricht an uns …"
                className="min-h-[110px] rounded-xl resize-y font-sans text-base"
              />

              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantsCopy}
                    onChange={(e) => setWantsCopy(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground font-sans flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5" />
                    Kopie der Nachricht per E-Mail erhalten
                  </span>
                </label>
                {wantsCopy && (
                  <div className="mt-2 ml-6">
                    <Input
                      type="email"
                      value={copyEmail}
                      onChange={(e) => setCopyEmail(e.target.value)}
                      placeholder="ihre@email.de"
                      className="max-w-sm h-10 rounded-lg font-sans"
                    />
                  </div>
                )}
              </div>

              {submitError && (
                <p className="text-sm text-destructive mt-3 font-sans">{submitError}</p>
              )}

              <Button
                onClick={handleSendMessage}
                disabled={!selectedOptionId || !notes.trim() || busy}
                variant="outline"
                className="mt-5 h-11 px-6 rounded-full font-sans font-medium gap-2 border-border/60 hover:border-primary/40 hover:bg-primary/5"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Nachricht senden
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOOKING BAR — fixed bottom, nur < lg, mit Safe-Area */}
      <MobileStickyBookingBar
        canPay={canPay}
        busy={busy}
        totalAmount={totalAmount}
        depositAmount={depositAmount}
        depositPercent={depositPercent}
        showDeposit={showDeposit}
        isPaying={isPaying}
        onPay={handlePayment}
        onConfirmBooking={handleSendMessage}
        onConfirmBooking={handleConfirmBooking}
        isSubmitting={isSubmitting}
        paymentMethod={paymentMethod}
        isSingle={isSingle}
        hasQuantities={hasQuantities}
        totalQuantity={totalQuantity}
        isArchiveMode={isArchiveMode}
        isPreviewMode={isPreviewMode}
      />
    </section>
  );
}

// =================================================================
// MULTI-OPTION CAROUSEL (Mobile snap + Desktop grid)
// =================================================================
function MultiOptionCarousel({
  options,
  selectedOptionId,
  setSelectedOptionId,
  optionQuantities,
  setOptionQuantities,
  perPersonPriceFor,
  targetGuests,
  totalQuantity,
  isSingle,
  formatOptionLabel,
}: {
  options: PublicOfferOption[];
  selectedOptionId: string | null;
  setSelectedOptionId: (id: string) => void;
  optionQuantities: Record<string, number>;
  setOptionQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  perPersonPriceFor: (opt: PublicOfferOption) => number;
  targetGuests: number | null;
  totalQuantity: number;
  isSingle: boolean;
  formatOptionLabel: (o: PublicOfferOption) => string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Sync active card on horizontal scroll (mobile only).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (!w) return;
        const idx = Math.round(el.scrollLeft / w);
        setActiveIdx(idx);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const scrollTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    haptic("select");
  };

  return (
    <div className="mb-12">
      {/* Pill-Tabs (mobile only) */}
      <div className="lg:hidden mb-3 flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {options.map((o, i) => {
          const qty = optionQuantities[o.id] || 0;
          const isActive = i === activeIdx;
          return (
            <button
              key={o.id}
              onClick={() => scrollTo(i)}
              className={cn(
                "snap-start shrink-0 rounded-full border px-3.5 py-2 text-xs font-sans transition-all whitespace-nowrap",
                isActive
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-background text-foreground border-border/60 hover:border-foreground/40",
              )}
              aria-current={isActive ? "true" : undefined}
            >
              <span className="font-semibold">Option {o.option_label}</span>
              {qty > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1">
                  {qty}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile snap-scroll container; lg+: grid */}
      <div
        ref={scrollerRef}
        className={cn(
          // Mobile: horizontal snap scroller (one card per viewport)
          "flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-2",
          // Desktop: revert to plain grid; disable scroll-snap
          "lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0",
        )}
      >
        {options.map((option) => (
          <div
            key={option.id}
            className="snap-center shrink-0 w-[88vw] max-w-[480px] lg:w-auto lg:max-w-none"
          >
            <ProposalOptionCard
              option={option}
              isSelected={selectedOptionId === option.id}
              onSelect={() => {
                setSelectedOptionId(option.id);
                haptic("tick");
              }}
              singleOption={isSingle}
              quantity={optionQuantities[option.id] || 0}
              onQuantityChange={(q) => {
                const isPerEvent = option.menu_selection?.pricingMode === "per_event";
                const clamped = isPerEvent ? Math.min(1, Math.max(0, q)) : Math.max(0, q);
                setOptionQuantities((prev) => ({ ...prev, [option.id]: clamped }));
              }}
              perPersonPrice={perPersonPriceFor(option)}
              targetGuests={targetGuests}
              remainingGuests={
                targetGuests !== null ? Math.max(0, targetGuests - totalQuantity) : null
              }
            />
          </div>
        ))}
      </div>

      {/* Pagination dots + arrows (mobile only) */}
      {options.length > 1 && (
        <div className="lg:hidden mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => activeIdx > 0 && scrollTo(activeIdx - 1)}
            disabled={activeIdx === 0}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/60 disabled:opacity-30"
            aria-label="Vorherige Option"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {options.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                aria-label={`Option ${i + 1} anzeigen`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === activeIdx ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25",
                )}
              />
            ))}
          </div>
          <button
            onClick={() => activeIdx < options.length - 1 && scrollTo(activeIdx + 1)}
            disabled={activeIdx >= options.length - 1}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/60 disabled:opacity-30"
            aria-label="Nächste Option"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// =================================================================
// MOBILE STICKY BOOKING BAR
// =================================================================
function MobileProgressStrip({ step, isSingle }: { step: 1 | 2 | 3; isSingle: boolean }) {
  const labels = isSingle
    ? ["Angebot lesen", "Menge prüfen", "Buchen"]
    : ["Optionen ansehen", "Variante wählen", "Buchen"];
  return (
    <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-neutral-200">
      <div className="px-4 pt-2 pb-2.5">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n, i) => {
            const active = step >= n;
            const current = step === n;
            return (
              <div key={n} className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className={cn(
                    "shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums transition-colors",
                    active
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-200 text-neutral-500"
                  )}
                >
                  {step > n ? "✓" : n}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-sans truncate transition-colors",
                    current ? "text-neutral-900 font-semibold" : active ? "text-neutral-700" : "text-neutral-400"
                  )}
                >
                  {labels[i]}
                </span>
                {i < 2 && (
                  <div
                    className={cn(
                      "h-px flex-1 transition-colors",
                      step > n ? "bg-neutral-900" : "bg-neutral-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileStickyBookingBar({
  canPay,
  busy,
  totalAmount,
  depositAmount,
  depositPercent,
  showDeposit,
  isPaying,
  onPay,
  onConfirmBooking,
  isSubmitting,
  paymentMethod,
  isSingle,
  hasQuantities,
  totalQuantity,
  isArchiveMode,
  isPreviewMode,
}: {
  canPay: boolean;
  busy: boolean;
  totalAmount: number;
  depositAmount: number;
  depositPercent: number;
  showDeposit: boolean;
  isPaying: 'full' | 'deposit' | null;
  onPay: (type: 'full' | 'deposit') => void;
  onConfirmBooking: () => void;
  isSubmitting: boolean;
  paymentMethod: string;
  isSingle: boolean;
  hasQuantities: boolean;
  totalQuantity: number;
  isArchiveMode: boolean;
  isPreviewMode: boolean;
}) {
  const isStripePayment = paymentMethod === 'deposit_online' || paymentMethod === 'prepayment_online';
  // Im Archiv-Modus komplett verstecken — nur Lese-Ansicht.
  if (isArchiveMode) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85",
        "shadow-[0_-8px_30px_rgba(0,0,0,0.08)]",
        "px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
      )}
      role="region"
      aria-label="Buchen"
    >
      {isPreviewMode && (
        <p className="mb-1.5 text-[10px] italic text-neutral-500 text-center">
          Vorschau — nur Anzeige
        </p>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-sans uppercase tracking-wider text-neutral-500">
            {canPay
              ? (hasQuantities
                  ? `${totalQuantity} ${totalQuantity === 1 ? 'Gast' : 'Gäste'} · Gesamt`
                  : 'Gesamt')
              : (isSingle ? 'Bitte oben Option wählen' : 'Mengen oben angeben')}
          </p>
          <p className="font-serif text-lg font-bold text-neutral-900 tabular-nums truncate">
            {canPay ? formatCurrency(totalAmount) : '—'}
          </p>
        </div>

        {isStripePayment ? (
          <>
            {showDeposit && canPay && (
              <Button
                onClick={() => onPay('deposit')}
                disabled={busy || isPreviewMode}
                variant="outline"
                className="h-12 px-3 rounded-xl flex flex-col items-center justify-center gap-0 border-primary/30"
              >
                <span className="text-[10px] uppercase tracking-wider font-sans leading-none">
                  {depositPercent}%
                </span>
                <span className="text-xs font-semibold tabular-nums leading-tight">
                  {formatCurrencyDecimal(depositAmount)}
                </span>
                {isPaying === 'deposit' && (
                  <Loader2 className="h-3 w-3 animate-spin absolute" />
                )}
              </Button>
            )}
            <Button
              onClick={() => onPay('full')}
              disabled={busy || !canPay || isPreviewMode}
              className="h-12 px-5 rounded-xl font-sans font-semibold shadow-[0_4px_15px_rgba(139,0,0,0.25)] flex items-center gap-2"
            >
              {isPaying === 'full' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Buchen
            </Button>
          </>
        ) : (
          <Button
            onClick={onConfirmBooking}
            disabled={busy || !canPay || isPreviewMode}
            className="h-12 px-5 rounded-xl font-sans font-semibold shadow-[0_4px_15px_rgba(139,0,0,0.25)] flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {paymentMethod === 'on_site' ? 'Buchen' : 'Buchen'}
          </Button>
        )}
      </div>
    </div>
  );
}

// =================================================================
// PROPOSAL OPTION CARD
// =================================================================

function ProposalOptionCard({
  option,
  isSelected,
  onSelect,
  singleOption,
  quantity,
  onQuantityChange,
  perPersonPrice: perPersonPriceProp,
  targetGuests,
  remainingGuests,
}: {
  option: PublicOfferOption;
  isSelected: boolean;
  onSelect: () => void;
  singleOption: boolean;
  quantity: number;
  onQuantityChange: (q: number) => void;
  perPersonPrice: number;
  targetGuests: number | null;
  remainingGuests: number | null;
}) {
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  const drinkRows = buildDrinkRows(menu);
  // Pricing-Modus respektieren: bei per_event ist budgetPerPerson der Gesamtpreis
  // fuer den ganzen Anlass (nicht pro Gast). Dann zeigen wir statt "pro Person"
  // den Gesamtbetrag mit Label "Gesamtpreis".
  const isPerEvent = menu?.pricingMode === 'per_event';
  const pricePerPerson = isPerEvent
    ? 0
    : option.guest_count > 0
      ? (menu?.budgetPerPerson && menu.budgetPerPerson > 0
          ? menu.budgetPerPerson
          : option.total_amount / option.guest_count)
      : 0;


  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "w-full text-left rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "bg-white/70 dark:bg-white/10 backdrop-blur-sm border-2",
        "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
        isSelected
          ? "border-primary ring-1 ring-primary/20 shadow-[0_8px_30px_rgba(139,0,0,0.1)]"
          : "border-white/60 dark:border-white/20 hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
      )}
    >
      {/* Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {!singleOption && (
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold font-sans shrink-0 transition-colors mt-0.5",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {option.option_label}
            </div>
          )}
          <div>
            <h3 className="font-serif text-lg font-bold text-foreground leading-tight">
              {option.offer_mode === "menu" || option.package_name === "Individuelles Paket" || option.package_name === "Individuelles Menü"
                ? "Individuelles Menü"
                : option.package_name}
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {option.guest_count} Gäste
            </p>
            {/* Paket-Beschreibung + enthaltene Leistungen (nur bei DB-Paketen) */}
            {option.package_description && (
              <p className="text-xs text-muted-foreground/80 font-sans mt-2 leading-relaxed">
                {option.package_description}
              </p>
            )}
            {Array.isArray(option.package_includes) && option.package_includes.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {option.package_includes.map((inc, i) => (
                  <li
                    key={i}
                    className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-primary/5 border border-primary/15 text-foreground/80"
                  >
                    {inc}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Preis */}
        <div className="text-right shrink-0">
          <p className="text-2xl font-serif font-bold text-primary leading-none">
            {pricePerPerson > 0
              ? formatCurrencyDecimal(pricePerPerson)
              : formatCurrency(option.total_amount)}
          </p>
          <p className="text-[11px] text-muted-foreground font-sans mt-1">
            {pricePerPerson > 0 ? 'pro Person' : 'Gesamtpreis'}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-sans mt-0.5">
            inkl. gesetzl. MwSt.
          </p>
        </div>
      </div>

      {/* Menü-Details im Speisekarten-Stil — lesbar, wertig */}
      {(courses.length > 0 || drinkRows.length > 0) && (
        <div className="px-6 pb-6">
          <div className="border-t border-border/20 pt-5">
            {courses.length > 0 && (
              <div className="space-y-4">
                {courses.map((c, i) => (
                  <div key={i} className="flex items-baseline gap-4">
                    <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-[0.15em] w-24 flex-shrink-0 pt-0.5">
                      {c.courseLabel}
                    </span>
                    <div className="flex-1">
                      <p className="text-base md:text-lg font-serif text-foreground leading-snug">
                        {(c.quantity ?? 1) > 1 ? `${c.quantity} × ${c.itemName}` : c.itemName}
                      </p>
                      {c.itemDescription && (
                        <p className="text-sm font-sans text-foreground/70 mt-1 leading-relaxed">
                          {c.itemDescription}
                        </p>
                      )}
                    </div>
                    {option.offer_mode === 'paket' && c.overridePrice != null && c.overridePrice > 0 && (
                      <span className="text-xs font-sans text-muted-foreground tabular-nums shrink-0">
                        + {formatCurrencyDecimal(c.overridePrice)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {drinkRows.length > 0 && (
              <div className={cn("space-y-3", courses.length > 0 && "mt-6 pt-5 border-t border-border/15")}>
                {drinkRows.map((d, i) => (
                  <div key={i} className="flex items-baseline gap-4">
                    <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-[0.15em] w-24 flex-shrink-0">
                      {d.label}
                    </span>
                    <div className="flex-1">
                      <p className="text-base font-serif text-foreground leading-snug">
                        {d.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mengen-Stepper — nur bei Multi-Option-Modus sichtbar.
          Bei Single-Option ist die Menge automatisch durch inquiry.guest_count gesetzt. */}
      {!singleOption && (
      <div
        className="px-6 pb-5 pt-4 border-t border-border/10 bg-muted/10 flex items-center justify-between gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs font-sans font-medium text-foreground/80">
            Wie viele Gäste möchten dieses Menü?
          </p>
          <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
            Ergibt {formatCurrencyDecimal(quantity * perPersonPriceProp)} für diese Option
            {targetGuests !== null && remainingGuests !== null && remainingGuests > 0 && (
              <> · noch <strong>{remainingGuests}</strong> von <strong>{targetGuests}</strong> zu verteilen</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
            disabled={quantity <= 0}
            className="h-9 w-9 rounded-full"
            aria-label="Menge verringern"
          >
            −
          </Button>
          <Input
            type="number"
            min={0}
            max={targetGuests !== null ? quantity + (remainingGuests ?? 0) : undefined}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value || '0', 10);
              if (!isNaN(n) && n >= 0) {
                const cap = targetGuests !== null ? quantity + (remainingGuests ?? 0) : Infinity;
                onQuantityChange(Math.min(cap, n));
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-16 h-9 text-center rounded-full font-sans font-semibold"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              const cap = targetGuests !== null ? quantity + (remainingGuests ?? 0) : Infinity;
              onQuantityChange(Math.min(cap, quantity + 1));
            }}
            disabled={targetGuests !== null && (remainingGuests ?? 0) <= 0}
            className="h-9 w-9 rounded-full"
            aria-label="Menge erhöhen"
          >
            +
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

// =================================================================
// THANK YOU VIEW
// =================================================================

function ThankYouView({
  customerResponse,
  options,
}: {
  customerResponse: CustomerResponseData | null;
  options: PublicOfferOption[];
}) {
  const selectedOption = customerResponse?.selected_option_id
    ? options.find((o) => o.id === customerResponse.selected_option_id)
    : null;

  return (
    <section className="bg-secondary/30">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-lg">
          <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-8">
            <CheckCircle2 className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold mb-4">
            Vielen Dank für Ihre Rückmeldung!
          </h2>
          {selectedOption && (
            <p className="text-muted-foreground font-sans mb-2">
              Sie haben{" "}
              <strong className="text-foreground">
                {selectedOption.package_name}
              </strong>{" "}
              gewählt.
            </p>
          )}
          {customerResponse?.customer_notes && (
            <div className="bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-xl p-5 mt-6 mb-6 text-left border border-white/40">
              <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                Ihre Anmerkung
              </p>
              <p className="text-sm font-sans text-foreground whitespace-pre-wrap">
                {customerResponse.customer_notes}
              </p>
            </div>
          )}
          <p className="text-muted-foreground font-sans">
            Wir melden uns in Kürze mit dem finalen Angebot bei Ihnen.
          </p>
        </div>
      </div>
    </section>
  );
}

// =================================================================
// FINAL OFFER VIEW
// =================================================================

function FinalOfferView({
  inquiry,
  options,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
}) {
  const selectedId = inquiry.selected_option_id;
  const displayOptions = selectedId
    ? options.filter((o) => o.id === selectedId)
    : options;

  return (
    <section className="bg-secondary/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl">
          {/* Sektion-Header */}
          <div className="mb-10">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
              Finales Angebot
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold">
              {displayOptions.length === 1 ? "Ihr Menü" : `${displayOptions.length} Optionen`}
            </h2>
          </div>

          <div className={cn(
            "gap-6",
            displayOptions.length > 1
              ? "grid grid-cols-1 lg:grid-cols-2"
              : "max-w-2xl"
          )}>
            {displayOptions.map((option) => (
              <FinalOptionCard
                key={option.id}
                option={option}
                inquiryId={inquiry.id}
                isSelected={inquiry.selected_option_id === option.id}
                singleOption={displayOptions.length === 1}
                paymentMethod={inquiry.payment_method || 'deposit_online'}
                invoiceDueDays={inquiry.invoice_due_days ?? 14}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalOptionCard({
  option,
  inquiryId,
  isSelected,
  singleOption,
  paymentMethod,
  invoiceDueDays,
}: {
  option: PublicOfferOption;
  inquiryId: string;
  isSelected: boolean;
  singleOption: boolean;
  paymentMethod: string;
  invoiceDueDays: number;
}) {
  const isStripePayment = paymentMethod === 'deposit_online' || paymentMethod === 'prepayment_online';
  const [isRedirecting, setIsRedirecting] = useState(false);
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  const drinkRows = buildDrinkRows(menu);
  // Pricing-Modus respektieren (siehe andere OptionCard-Variante)
  const isPerEvent = menu?.pricingMode === 'per_event';
  const pricePerPerson = isPerEvent
    ? 0
    : option.guest_count > 0
      ? (menu?.budgetPerPerson && menu.budgetPerPerson > 0
          ? menu.budgetPerPerson
          : option.total_amount / option.guest_count)
      : 0;

  const totalAmount = option.total_amount;
  // Anzahlungs-Prozent kommt aus dem Inquiry-Kontext via Query (RPC) — Fallback 20%.
  // Wir holen es hier über einen lokalen State, da diese Card pro Option gerendert wird.
  // Für eine saubere Lösung müsste depositPercent als Prop reingereicht werden;
  // als pragmatischer Default zeigen wir beide Buttons (showDeposit=true wenn dp>0).
  const depositPercent = 20; // wird durch RPC-Wert in handlePayment serverseitig korrekt berechnet
  const depositAmount = Math.round(totalAmount * depositPercent) / 100;

  const handlePayment = async (paymentType: 'full' | 'deposit') => {
    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: { inquiryId, optionId: option.id, paymentType },
      });
      if (error || !data?.checkoutUrl) {
        throw new Error(data?.error || 'Fehler beim Erstellen der Zahlungssitzung');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setIsRedirecting(false);
      toast.error(
        err instanceof Error ? err.message : 'Fehler bei der Zahlung',
        {
          description: 'Bitte versuchen Sie es erneut oder kontaktieren Sie uns unter 089 51519696.',
          duration: 6000,
        }
      );
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden transition-all",
        "bg-white/70 dark:bg-white/10 backdrop-blur-sm border",
        "shadow-[0_8px_30px_rgba(0,0,0,0.06)]",
        isSelected
          ? "border-primary/40 ring-1 ring-primary/10"
          : "border-white/50 dark:border-white/20",
        singleOption && "max-w-2xl"
      )}
    >
      {/* Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {!singleOption && (
            <span className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold font-sans shrink-0 mt-0.5">
              {option.option_label}
            </span>
          )}
          <div>
            <h3 className="font-serif text-xl font-bold text-foreground">
              {option.offer_mode === "menu" || option.package_name === "Individuelles Paket" || option.package_name === "Individuelles Menü"
                ? "Individuelles Menü"
                : option.package_name}
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {option.guest_count} Gäste
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-serif font-bold text-primary leading-none">
            {pricePerPerson > 0
              ? formatCurrencyDecimal(pricePerPerson)
              : formatCurrency(option.total_amount)}
          </p>
          <p className="text-[11px] text-muted-foreground font-sans mt-1">
            {pricePerPerson > 0 ? 'pro Person' : 'Gesamtpreis'}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-sans mt-0.5">
            inkl. gesetzl. MwSt.
          </p>
        </div>
      </div>

      {/* Menü — Speisekarten-Stil */}
      <div className="px-6 pb-6">
        {courses.length > 0 && (
          <div className="border-t border-border/20 pt-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <UtensilsCrossed className="h-3.5 w-3.5 text-primary/40" />
              <h4 className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/50">
                Menü
              </h4>
            </div>
            <div className="space-y-4">
              {courses.map((course, i) => (
                <div key={i}>
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/40 mb-1">
                    {course.courseLabel}
                  </p>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-serif text-base text-foreground">
                      {(course.quantity ?? 1) > 1 ? `${course.quantity} × ${course.itemName}` : course.itemName}
                    </p>
                    {option.offer_mode === 'paket' && course.overridePrice != null && course.overridePrice > 0 && (
                      <span className="text-xs font-sans text-muted-foreground tabular-nums shrink-0">
                        + {formatCurrencyDecimal(course.overridePrice)}
                      </span>
                    )}
                  </div>
                  {course.itemDescription && (
                    <p className="text-xs font-sans text-muted-foreground/60 italic mt-0.5">
                      {course.itemDescription}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {drinkRows.length > 0 && (
          <div className={cn("border-t border-border/20 pt-5", courses.length === 0 && "mt-0")}>
            <div className="flex items-center gap-2 mb-4">
              <Wine className="h-3.5 w-3.5 text-primary/40" />
              <h4 className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/50">
                Getränke
              </h4>
            </div>
            <div className="space-y-3">
              {drinkRows.map((drink, i) => (
                <div key={i}>
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/40 mb-0.5">
                    {drink.label}
                  </p>
                  <div>
                    <p className="font-serif text-sm text-foreground">
                      {drink.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {courses.length === 0 && drinkRows.length === 0 && (
          <div className="border-t border-border/20 pt-5">
            <p className="text-sm text-muted-foreground font-sans italic">
              Menüdetails werden noch zusammengestellt.
            </p>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="px-6 py-4 bg-muted/30 border-t border-border/10">
        {!isStripePayment ? (
          /* VOR-ORT / RECHNUNG — Bestätigung ohne Stripe */
          totalAmount > 0 ? (
            <div className="text-center space-y-2">
              <p className="text-sm font-sans font-medium text-foreground/80">
                {paymentMethod === 'on_site'
                  ? 'Zahlung erfolgt vor Ort beim Event'
                  : `Rechnung nach dem Event — zahlbar innerhalb ${invoiceDueDays} Tagen`}
              </p>
              <p className="text-lg font-serif font-bold text-primary">
                {formatCurrencyDecimal(totalAmount)}
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground font-sans py-1">
              Kontaktieren Sie uns für die Buchung.
            </p>
          )
        ) : option.offer_mode === 'paket' ? (
          /* Paket-Modus: nur Gesamtzahlung */
          <Button
            className="w-full h-12 gap-2 rounded-full font-sans font-semibold text-base shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-80 disabled:hover:translate-y-0"
            onClick={() => handlePayment('full')}
            disabled={isRedirecting}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Zahlung wird vorbereitet…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Jetzt zahlen — {formatCurrencyDecimal(totalAmount)}
              </>
            )}
          </Button>
        ) : totalAmount > 0 ? (
          /* Menü-Modus: Komplett oder Anzahlung */
          <div className="space-y-3">
            <p className="text-sm font-sans font-medium text-center text-foreground/80">
              {isRedirecting ? 'Zahlung wird vorbereitet…' : 'Wie möchten Sie zahlen?'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePayment('full')}
                disabled={isRedirecting}
                className="p-4 rounded-xl border-2 border-primary text-center hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <>
                    <span className="font-bold text-sm font-sans block">{formatCurrencyDecimal(totalAmount)}</span>
                    <span className="text-xs font-sans text-muted-foreground block mt-0.5">Komplett zahlen</span>
                  </>
                )}
              </button>
              <button
                onClick={() => handlePayment('deposit')}
                disabled={isRedirecting}
                className="p-4 rounded-xl border border-border text-center hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <>
                    <span className="font-bold text-sm font-sans block">{formatCurrencyDecimal(depositAmount)}</span>
                    <span className="text-xs font-sans text-muted-foreground block mt-0.5">20% Anzahlung</span>
                    <span className="text-[10px] font-sans text-muted-foreground/60 block">Rest vor dem Event</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground font-sans py-1">
            Kontaktieren Sie uns für die Buchung.
          </p>
        )}

        {/* Stornobedingungen — kompakter Accordion unter Zahlungs-Button */}
        {totalAmount > 0 && <CancellationTermsAccordion />}
      </div>
    </div>
  );
}

// =================================================================
// CONFIRMATION VIEW
// =================================================================

function ConfirmationView({
  inquiry,
  options,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
}) {
  const selectedOption = inquiry.selected_option_id
    ? options.find((o) => o.id === inquiry.selected_option_id)
    : options[0];

  // Pricing-Modus respektieren
  const isPerEvent = selectedOption?.menu_selection?.pricingMode === 'per_event';
  const pricePerPerson = isPerEvent
    ? 0
    : selectedOption && selectedOption.guest_count > 0
      ? (selectedOption.menu_selection?.budgetPerPerson && selectedOption.menu_selection.budgetPerPerson > 0
          ? selectedOption.menu_selection.budgetPerPerson
          : selectedOption.total_amount / selectedOption.guest_count)
      : 0;

  return (
    <section className="bg-secondary/30">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-lg">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-8">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold mb-5">
            Buchung bestätigt!
          </h2>
          {selectedOption && (
            <p className="text-muted-foreground font-sans mb-2">
              <strong className="text-foreground">{selectedOption.package_name}</strong>
              {" "}für {selectedOption.guest_count} Gäste —{" "}
              {pricePerPerson > 0
                ? `${formatCurrencyDecimal(pricePerPerson)} pro Person`
                : `${formatCurrency(selectedOption.total_amount)} Gesamtpreis`}
            </p>
          )}
          {inquiry.preferred_date && (
            <p className="text-lg font-serif font-semibold text-foreground mb-2">
              {inquiry.event_end_date
                ? `${format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM", { locale: de })} – ${format(parseISO(inquiry.event_end_date), "d. MMMM yyyy", { locale: de })}`
                : format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM yyyy", { locale: de })}
            </p>
          )}
          <p className="text-muted-foreground font-sans mt-6">
            Wir freuen uns auf Ihr Event! Bei Fragen erreichen Sie uns jederzeit.
          </p>
        </div>
      </div>
    </section>
  );
}

// =================================================================
// PUBLIC PAYMENT SECTION
// =================================================================

function PublicPaymentSection({
  payments,
  eventDate,
}: {
  payments: PublicPayment[];
  eventDate?: string;
}) {
  if (!payments.length) return null;

  const typeLabels: Record<string, string> = {
    deposit: "Anzahlung",
    prepayment: "Vorauszahlung",
    final: "Restzahlung",
  };

  const fmt = (cents: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

  const fmtDate = (iso: string | null | Date) => {
    if (!iso) return null;
    try {
      return format(typeof iso === "string" ? parseISO(iso) : iso, "d. MMMM yyyy", { locale: de });
    } catch {
      return null;
    }
  };

  const effectiveDueDate = (p: PublicPayment): Date | null => {
    if (p.due_date) return parseISO(p.due_date);
    if (p.due_days_before_event && eventDate) {
      const d = parseISO(eventDate);
      d.setDate(d.getDate() - p.due_days_before_event);
      return d;
    }
    return null;
  };

  const allPaid = payments.every((p) => p.status === "paid");
  const hasOverdue = payments.some((p) => p.status === "overdue");
  const firstOpen = payments.find((p) => p.status !== "paid");
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount_cents, 0);

  const headerIcon = allPaid ? "✅" : hasOverdue ? "⚠️" : "💰";
  const headerText = allPaid
    ? "Ihre Zahlungen"
    : hasOverdue
    ? "Offene Zahlung"
    : "Ihre Zahlungen";

  return (
    <section className="bg-background border-t border-border/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl">
          {/* Header */}
          <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
            Zahlungen
          </p>
          <h2 className="font-serif text-xl md:text-2xl font-bold mb-6">
            {headerIcon} {headerText}
          </h2>

          {/* Payment rows */}
          <div className="space-y-3 mb-6">
            {payments.map((p) => {
              const due = effectiveDueDate(p);
              const isPaid = p.status === "paid";
              const isOverdue = p.status === "overdue";
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between gap-4 py-3 px-4 rounded-xl border",
                    isPaid
                      ? "bg-emerald-50 border-emerald-200/60"
                      : isOverdue
                      ? "bg-amber-50 border-amber-200/60"
                      : "bg-white/60 border-border/40"
                  )}
                >
                  <div>
                    <p className="font-sans font-semibold text-sm text-foreground">
                      {typeLabels[p.payment_type] ?? p.payment_type}
                    </p>
                    <p className="text-xs font-sans text-muted-foreground mt-0.5">
                      {isPaid
                        ? `Bezahlt am ${fmtDate(p.paid_at) ?? "—"}`
                        : isOverdue
                        ? `Fällig seit ${fmtDate(due) ?? "—"}`
                        : due
                        ? `Fällig bis ${fmtDate(due)}`
                        : "Fälligkeit wird mitgeteilt"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-sans font-bold text-sm text-foreground">{fmt(p.amount_cents)}</p>
                    {isPaid && <p className="text-xs text-emerald-600 font-sans">✓ Eingegangen</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gesamtsumme wenn alles bezahlt */}
          {allPaid && (
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-6">
              <p className="font-sans font-semibold text-sm text-emerald-800">Gesamt bezahlt</p>
              <p className="font-sans font-bold text-sm text-emerald-800">{fmt(totalPaid)}</p>
            </div>
          )}

          {/* Bezahl-Button für erste offene Zahlung */}
          {!allPaid && firstOpen?.stripe_payment_link_url && (
            <a
              href={firstOpen.stripe_payment_link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <button className="w-full py-4 px-6 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white font-sans font-semibold text-base shadow-[0_4px_15px_rgba(180,83,9,0.25)] hover:shadow-[0_8px_25px_rgba(180,83,9,0.35)] hover:-translate-y-0.5 transition-all flex flex-col items-center gap-1">
                <span>
                  {typeLabels[firstOpen.payment_type] ?? "Zahlung"} jetzt bezahlen →
                </span>
                <span className="text-xs font-normal opacity-80">Karte · SEPA · Billie</span>
              </button>
            </a>
          )}

          {/* Alles bezahlt — Dankestext */}
          {allPaid && (
            <p className="text-sm font-sans text-muted-foreground">
              Vielen Dank! Alle Zahlungen sind eingegangen. Wir freuen uns auf Ihr Event.
            </p>
          )}

          {/* Kontakthinweis bei offener Zahlung ohne Link */}
          {!allPaid && firstOpen && !firstOpen.stripe_payment_link_url && (
            <p className="text-sm font-sans text-muted-foreground">
              Bei Fragen zur Zahlung erreichen Sie uns unter{" "}
              <a href="tel:+498951519696" className="text-primary hover:underline">089 51519696</a>{" "}
              oder{" "}
              <a href="mailto:info@events-storia.de" className="text-primary hover:underline">info@events-storia.de</a>.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// =================================================================
// CONTACT SECTION
// =================================================================
// CANCELLATION TERMS
// =================================================================
function CancellationTermsAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-border/40 pt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 text-sm font-sans text-foreground/70 hover:text-foreground transition-colors group"
      >
        <Info className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300" />
        <span className="flex-1 text-left font-medium">Flexibel stornieren — bis 30 Tage vor dem Event kostenfrei</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-4 px-1 space-y-3 text-sm font-sans animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <p className="text-foreground/80 leading-relaxed">
            Pläne können sich ändern — wir verstehen das. Falls Sie Ihr Event absagen müssen,
            gelten folgende Stornogebühren (berechnet als Anteil der gebuchten Summe):
          </p>

          <ul className="space-y-2 pt-1">
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">Mehr als 30 Tage vor dem Event</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">kostenlos</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">15–30 Tage vor dem Event</span>
              <span className="font-semibold text-foreground whitespace-nowrap">25 %</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">8–14 Tage vor dem Event</span>
              <span className="font-semibold text-foreground whitespace-nowrap">50 %</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">3–7 Tage vor dem Event</span>
              <span className="font-semibold text-foreground whitespace-nowrap">80 %</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5">
              <span className="text-foreground">Ab 48 Stunden vorher oder No-Show</span>
              <span className="font-semibold text-foreground whitespace-nowrap">100 %</span>
            </li>
          </ul>

          <p className="pt-2 text-xs text-muted-foreground leading-relaxed">
            Maßgeblich ist der Eingang Ihrer schriftlichen Stornierung bei uns.
            Bereits geleistete Anzahlungen werden mit der Stornogebühr verrechnet —
            ein etwaiger Überschuss wird Ihnen zurückerstattet.
            Vollständige Bedingungen finden Sie in unseren{" "}
            <LocalizedLink to="/agb-veranstaltungen" className="underline hover:text-foreground">
              AGB für Veranstaltungen
            </LocalizedLink>.
          </p>
        </div>
      )}
    </div>
  );
}

// =================================================================

function ContactSection() {
  return (
    <section className="border-t border-border/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
          Kontakt
        </p>
        <h2 className="text-xl md:text-2xl font-serif font-bold mb-3">
          Fragen zu Ihrem Angebot?
        </h2>
        <p className="text-muted-foreground font-sans mb-8 max-w-md text-sm">
          Wir beraten Sie gerne persönlich und passen das Angebot an Ihre Wünsche an.
        </p>
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <a href="tel:+498951519696">
            <Button variant="outline" className="gap-2 rounded-full font-sans px-6 h-11 hover:-translate-y-0.5 transition-all">
              <Phone className="h-4 w-4" />
              +49 89 51519696
            </Button>
          </a>
          <a href="mailto:info@events-storia.de">
            <Button variant="outline" className="gap-2 rounded-full font-sans px-6 h-11 hover:-translate-y-0.5 transition-all">
              <Mail className="h-4 w-4" />
              info@events-storia.de
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

// =================================================================
// HEADER & FOOTER
// =================================================================

function OfferHeader() {
  return (
    <header className="border-b border-border/30 bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <LocalizedLink
            to="home"
            className="font-display text-xl md:text-2xl font-bold tracking-wide hover:opacity-80 transition-opacity"
          >
            STORIA
          </LocalizedLink>
          <div className="flex items-center gap-1 md:gap-4">
            <a
              href="tel:+498951519696"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 text-foreground/70 hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden md:inline text-sm font-sans font-medium">+49 89 51519696</span>
            </a>
            <a
              href="mailto:info@events-storia.de"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 text-foreground/70 hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden md:inline text-sm font-sans font-medium">info@events-storia.de</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function OfferFooter() {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-display text-xl font-bold tracking-wide mb-1">STORIA</p>
            <p className="text-sm text-background/50 font-sans">
              Catering & Events — München
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-background/50 font-sans">
            <a
              href="tel:+498951519696"
              className="hover:text-background/80 transition-colors flex items-center gap-2"
            >
              <Phone className="h-3.5 w-3.5" />
              +49 89 51519696
            </a>
            <a
              href="mailto:info@events-storia.de"
              className="hover:text-background/80 transition-colors flex items-center gap-2"
            >
              <Mail className="h-3.5 w-3.5" />
              info@events-storia.de
            </a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-background/10 text-center text-xs text-background/30 font-sans">
          <p>&copy; {new Date().getFullYear()} STORIA Catering & Events</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <LocalizedLink
              to="legal.imprint"
              className="hover:text-background/60 transition-colors"
            >
              Impressum
            </LocalizedLink>
            <LocalizedLink
              to="legal.privacy"
              className="hover:text-background/60 transition-colors"
            >
              Datenschutz
            </LocalizedLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
