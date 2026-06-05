import { useEffect, useState } from "react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import { LocalizedLink } from "@/components/LocalizedLink";
import { supabase } from "@/integrations/supabase/client";
import { createPaymentSession } from "@/lib/createPaymentSession";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { pickLang, isValidOfferLang, type OfferLang } from "@/lib/offerLang";
import { OrderConfirmationDialog } from "@/pages/public-offer/OrderConfirmationDialog";
import { RestaurantGallery } from "@/pages/public-offer/RestaurantGallery";
import { tOffer, dateFnsLocale, currencyLocale } from "@/pages/public-offer/i18n";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { buildDrinkRows } from "@/pages/public-offer/types";

// --- Types ---

type OfferPhase =
  | "draft"
  | "proposal_sent"
  | "customer_responded"
  | "final_draft"
  | "final_sent"
  | "order_confirmed"
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
  lexoffice_quotation_id: string | null;
  lexoffice_invoice_id: string | null;
  deposit_amount?: number | null;
  deposit_percent?: number | null;
  deposit_due_days?: number | null;
  payment_method?: string | null;
  customer_language?: 'de' | 'en' | 'it' | 'fr' | null;
}

interface CourseSelection {
  courseType: string;
  courseLabel: string;
  courseLabel_en?: string | null;
  courseLabel_it?: string | null;
  courseLabel_fr?: string | null;
  itemName: string;
  itemName_en?: string | null;
  itemName_it?: string | null;
  itemName_fr?: string | null;
  itemDescription: string | null;
  itemDescription_en?: string | null;
  itemDescription_it?: string | null;
  itemDescription_fr?: string | null;
  /** Menge bei per_event-Bestellungen. Default 1 = keine Anzeige. */
  quantity?: number | null;
}

interface DrinkSelection {
  drinkGroup: string;
  drinkLabel: string;
  drinkLabel_en?: string | null;
  drinkLabel_it?: string | null;
  drinkLabel_fr?: string | null;
  selectedChoice: string | null;
  selectedChoice_translations?: Partial<Record<'en' | 'it' | 'fr', string>> | null;
  quantityLabel: string | null;
  quantityLabel_en?: string | null;
  quantityLabel_it?: string | null;
  quantityLabel_fr?: string | null;
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
  sort_order: number;
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

function formatCurrency(amount: number, lang: OfferLang = 'de') {
  return new Intl.NumberFormat(currencyLocale(lang), {
    style: "currency",
    currency: "EUR",
    // Beträge IMMER mit 2 Nachkommastellen anzeigen — Maestro-Preise
    // niemals auf volle Euro runden (z. B. 1.053,99 € bleibt 1.053,99 €).
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCurrencyDecimal(amount: number, lang: OfferLang = 'de') {
  return new Intl.NumberFormat(currencyLocale(lang), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Berechnet die Anzahlung (deposit) auf Basis des Inquiry-Settings:
 *   - deposit_amount > 0  → fixer Eurobetrag (gecappt auf totalAmount)
 *   - sonst Prozentsatz   → totalAmount * deposit_percent / 100
 * Liefert {amount, label, show}. show=false wenn 0 oder ≥ totalAmount.
 */
function computeDeposit(
  inquiry: Pick<PublicInquiry, "deposit_amount" | "deposit_percent" | "payment_method">,
  totalAmount: number,
): { amount: number; label: string; show: boolean } {
  // Bei Offline-Zahlung (vor Ort / Rechnung) gibt es konzeptionell keine Anzahlung
  const pm = (inquiry.payment_method ?? '').toLowerCase();
  if (pm === 'on_site' || pm === 'pay_on_site' || pm === 'invoice_after' || pm === 'invoice_after_event' || pm === 'invoice_before' || pm === 'invoice_before_event') {
    return { amount: 0, label: 'Anzahlung', show: false };
  }
  const fixed = inquiry.deposit_amount && inquiry.deposit_amount > 0 ? inquiry.deposit_amount : null;
  if (fixed != null) {
    const amount = Math.min(fixed, totalAmount);
    return {
      // Maestro-Anzahlung 1:1 übernehmen, niemals runden.
      amount,
      label: "Anzahlung",
      show: amount > 0 && amount < totalAmount,
    };
  }
  // Sicherer Default nur, wenn auch wirklich Online-Anzahlungsmodus
  const fallbackPct = pm === 'deposit_online' ? 20 : 0;
  const pct = inquiry.deposit_percent ?? fallbackPct;
  if (pct <= 0) return { amount: 0, label: "Anzahlung", show: false };
  // Keine Cent-Rundung — exakter Betrag wird auf 2 Nachkommastellen formatiert.
  const amount = (totalAmount * pct) / 100;
  return {
    amount,
    label: `Anzahlung ${pct} %`,
    show: amount > 0 && amount < totalAmount,
  };
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
  const [letterTranslations, setLetterTranslations] = useState<Record<string, string>>({});

  // Sprache: standardmäßig die im Admin gewählte `customer_language` der Anfrage.
  // `?lang=` darf das überschreiben (z.B. für interne Vorschauen).
  const langParam = searchParams.get('lang');
  const customerLang = data?.inquiry?.customer_language;
  const defaultLang: OfferLang = isValidOfferLang(customerLang) ? customerLang : 'de';
  const [lang, setLang] = useState<OfferLang>(
    isValidOfferLang(langParam) ? langParam : defaultLang,
  );
  useEffect(() => {
    if (isValidOfferLang(langParam)) {
      if (langParam !== lang) setLang(langParam);
      return;
    }
    if (isValidOfferLang(customerLang) && customerLang !== lang) {
      setLang(customerLang);
    }
  }, [langParam, customerLang, lang]);

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

  // Preview-Phase-Override: nur im Admin-iframe gesetzt. Zwingt PublicOffer dazu,
  // die ProposalView/FinalOfferView zu rendern, auch wenn die DB-Phase noch 'draft' ist.
  const previewSend = searchParams.get('preview_send');

  // Slug-Route (/ihr-angebot/:slug) oder UUID-Route (/offer/:id)
  const isSlugRoute = location.pathname.includes('/ihr-angebot/') || location.pathname.includes('/your-offer/');
  const lookupValue = slug || id;

  // Archiv-Modus: ?archive_version=N rendert die Snapshot-Version aus
  // inquiry_offer_history (immutable), statt das aktuelle Live-Angebot.
  // Wird vom Admin-Archiv-Preview als iframe-src verwendet.
  const archiveVersionRaw = searchParams.get('archive_version');
  const archiveVersion = archiveVersionRaw ? parseInt(archiveVersionRaw, 10) : null;
  const isArchive = archiveVersion != null && !Number.isNaN(archiveVersion);

  useEffect(() => {
    if (!lookupValue) return;

    const fetchOffer = async () => {
      try {
        // ARCHIV: Snapshot aus inquiry_offer_history laden
        if (isArchive && id) {
          const [histRes, inqRes] = await Promise.all([
            supabase
              .from('inquiry_offer_history' as never)
              .select('options_snapshot, email_content')
              .eq('inquiry_id', id)
              .eq('version', archiveVersion!)
              .maybeSingle(),
            supabase
              .from('event_inquiries' as never)
              .select('id, company_name, contact_name, email, event_type, preferred_date, event_end_date, guest_count, lexoffice_quotation_id, lexoffice_invoice_id, deposit_amount, deposit_percent, deposit_due_days, payment_method, offer_slug')
              .eq('id', id)
              .maybeSingle(),
          ]);
          const hist = (histRes.data as unknown) as { options_snapshot: unknown; email_content: string | null } | null;
          const inq = (inqRes.data as unknown) as Record<string, unknown> | null;
          if (!hist || !inq) {
            setError(true);
            return;
          }
          const snapOptions = Array.isArray(hist.options_snapshot)
            ? (hist.options_snapshot as Array<Record<string, unknown>>)
            : [];
          // Aktiv-Filter: archivierte Snapshots können auch deaktivierte enthalten
          const activeSnaps = snapOptions.filter(o => (o as { is_active?: boolean }).is_active !== false);

          // Paketnamen für package_id auflösen (analog zur RPC)
          const packageIds = Array.from(new Set(
            activeSnaps.map(o => (o as { package_id?: string | null }).package_id).filter((x): x is string => !!x)
          ));
          let packageNames: Record<string, string> = {};
          if (packageIds.length) {
            const { data: pkgRows } = await supabase
              .from('packages' as never)
              .select('id, name')
              .in('id', packageIds);
            if (Array.isArray(pkgRows)) {
              packageNames = Object.fromEntries(
                (pkgRows as Array<{ id: string; name: string }>).map(p => [p.id, p.name])
              );
            }
          }

          const options: PublicOfferOption[] = activeSnaps
            .map((o, idx) => {
              const offerMode = (o.offer_mode as string | null) || 'fest_menu';
              const menuSel = o.menu_selection as Record<string, unknown> | null;
              const override = menuSel && typeof menuSel.packageNameOverride === 'string'
                ? menuSel.packageNameOverride.trim()
                : '';
              const pkgId = (o.package_id as string | null) || null;
              const packageName =
                offerMode === 'menu'
                  ? 'Individuelles Menü'
                  : override
                  ? override
                  : (pkgId && packageNames[pkgId]) || 'Individuelles Paket';
              return {
                id: String(o.id ?? `snap-${idx}`),
                option_label: String(o.option_label ?? String.fromCharCode(65 + idx)),
                offer_mode: offerMode,
                guest_count: Number(o.guest_count ?? 0),
                menu_selection: menuSel as MenuSelection | null,
                total_amount: Number(o.total_amount ?? 0),
                stripe_payment_link_url: (o.stripe_payment_link_url as string | null) ?? null,
                package_name: packageName,
                sort_order: Number(o.sort_order ?? idx),
              } as PublicOfferOption;
            })
            .sort((a, b) => a.sort_order - b.sort_order);

          const archiveData: PublicOfferData = {
            inquiry: {
              id: String(inq.id),
              company_name: (inq.company_name as string | null) ?? null,
              contact_name: String(inq.contact_name ?? ''),
              email: (inq.email as string | null) ?? null,
              event_type: (inq.event_type as string | null) ?? null,
              preferred_date: (inq.preferred_date as string | null) ?? null,
              event_end_date: (inq.event_end_date as string | null) ?? null,
              guest_count: (inq.guest_count as string | null) ?? null,
              status: 'offer_sent',
              // Archiv → immer ProposalView mit Menü + 2 Zahlbuttons
              offer_phase: 'proposal_sent',
              selected_option_id: null,
              email_content: hist.email_content ?? null,
              lexoffice_quotation_id: (inq.lexoffice_quotation_id as string | null) ?? null,
              lexoffice_invoice_id: (inq.lexoffice_invoice_id as string | null) ?? null,
              deposit_amount: (inq.deposit_amount as number | null) ?? null,
              deposit_percent: (inq.deposit_percent as number | null) ?? null,
              deposit_due_days: (inq.deposit_due_days as number | null) ?? null,
              payment_method: (inq.payment_method as string | null) ?? null,
            },
            options,
            customer_response: null,
          };
          setData(archiveData);
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
  }, [lookupValue, isSlugRoute, isArchive, archiveVersion, id]);

  // Load payments separately (anon access, only public fields)
  useEffect(() => {
    if (!data?.inquiry?.id || isArchive) return;
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

  // Cached Anschreiben-Übersetzungen (en/it/fr) laden — nur Cache, kein AI-Call hier.
  useEffect(() => {
    if (!data?.inquiry?.id || isArchive) return;
    supabase
      .from("v2_events")
      .select("email_content_translations")
      .eq("id", data.inquiry.id)
      .maybeSingle()
      .then(({ data: row }) => {
        const t = (row?.email_content_translations ?? {}) as Record<string, string>;
        if (t && typeof t === 'object') setLetterTranslations(t);
      });
  }, [data?.inquiry?.id, isArchive]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-sans">{tOffer(lang, 'loadingOffer')}</p>
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
            {tOffer(lang, 'offerNotFoundTitle')}
          </h1>
          <p className="text-muted-foreground mb-8 font-sans">
            {tOffer(lang, 'offerNotFoundBody')}
          </p>
          <LocalizedLink
            to="home"
            className="text-primary hover:underline font-medium font-sans"
          >
            {tOffer(lang, 'backHome')}
          </LocalizedLink>
        </div>
        <OfferFooter lang={lang} />
      </div>
    );
  }

  const { inquiry, options, customer_response } = data;
  const phase = inquiry.offer_phase || "draft";

  // Legacy: offer_phase = 'draft' aber status = 'offer_sent' → wie final_sent behandeln
  const effectivePhase: OfferPhase =
    phase === "draft" && inquiry.status === "offer_sent" ? "final_sent" : phase;

  // Preview-Override (Admin-iframe): preview_send forciert die View-Phase
  const previewPhase: OfferPhase | null =
    previewSend === 'proposal' ? 'proposal_sent'
    : previewSend === 'final'  ? 'final_sent'
    : null;
  const renderPhase: OfferPhase = previewPhase ?? effectivePhase;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfferHeader />
      <main className="flex-1">
        <HeroSection inquiry={inquiry} phase={renderPhase} lang={lang} />

        <RestaurantGallery lang={lang} />

        {/* Anschreiben — immer sichtbar wenn vorhanden.
            Im Preview-Modus (Admin-iframe) wird previewBody aus der URL verwendet
            und überschreibt den gespeicherten email_content. Echte Kunden haben
            keinen previewBody und sehen den versendeten email_content. */}
        {(previewBody || inquiry.email_content) && (
          <AnschreibenSection
            emailContent={previewBody || inquiry.email_content || ''}
            inquiryId={inquiry.id}
            lang={lang}
            translations={letterTranslations}
          />
        )}

        {renderPhase === "proposal_sent" && (
          <ProposalView
            inquiry={inquiry}
            options={options}
            lang={lang}
            onSubmitted={(updatedData) => setData(updatedData)}
          />
        )}

        {renderPhase === "customer_responded" && (
          <ThankYouView
            customerResponse={customer_response}
            options={options}
            lang={lang}
          />
        )}

        {(renderPhase === "final_sent" ||
          renderPhase === "final_draft") && (
          <FinalOfferView
            inquiry={inquiry}
            options={options}
            lang={lang}
          />
        )}

        {(renderPhase === "confirmed" ||
          renderPhase === "paid" ||
          renderPhase === "order_confirmed") && (
          <ConfirmationView inquiry={inquiry} options={options} lang={lang} />
        )}

        <PdfDownloadSection inquiryId={inquiry.id} lang={lang} />

        <PublicPaymentSection payments={payments} eventDate={inquiry.preferred_date ?? undefined} lang={lang} />
        <ContactSection lang={lang} />
      </main>
      <OfferFooter lang={lang} />
    </div>
  );
}

// =================================================================
// PDF DOWNLOAD SECTION
// =================================================================

function PdfDownloadSection({ inquiryId, lang = 'de' }: { inquiryId: string; lang?: OfferLang }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'download-public-offer-pdf',
        { body: { inquiryId, lang } }
      );

      if (error || !data?.pdf) {
        throw new Error(data?.error || tOffer(lang, 'pdfUnavailable'));
      }

      const blob = new Blob(
        [Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))],
        { type: 'application/pdf' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'STORIA_Angebot.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
    } catch (err) {
      console.error('PDF download failed:', err);
      toast.error(tOffer(lang, 'pdfUnavailable'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="border-t border-border/20 bg-background/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-center">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="underline underline-offset-2">{tOffer(lang, 'pdfDownload')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// =================================================================
// ANSCHREIBEN SECTION — persönlicher Begleittext
// =================================================================

function AnschreibenSection({
  emailContent,
  inquiryId,
  lang = 'de',
  translations,
}: {
  emailContent: string;
  inquiryId?: string;
  lang?: OfferLang;
  translations?: Record<string, string>;
}) {
  const [translated, setTranslated] = useState<string | null>(
    lang !== 'de' && translations?.[lang] ? translations[lang] : null,
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (lang === 'de') { setTranslated(null); return; }
    if (translations?.[lang]) { setTranslated(translations[lang]); return; }
    if (!inquiryId || !emailContent) return;
    let cancelled = false;
    setLoading(true);
    setTranslated(null);
    supabase.functions.invoke('translate-offer-letter', {
      body: { inquiry_id: inquiryId, target_lang: lang, source_text: emailContent },
    })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.translated) { setFailed(true); setTranslated(null); }
        else setTranslated(data.translated as string);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lang, inquiryId, emailContent, translations]);

  const sourceText = translated ?? emailContent;
  const greetingSeparators = [
    "Mit freundlichen Grüßen",
    "Herzliche Grüße",
    "Beste Grüße",
    "Viele Grüße",
    "Kind regards",
    "Best regards",
    "Sincerely",
    "Cordialmente",
    "Cordiali saluti",
    "Cordialement",
    "Sincères salutations",
    "Bien cordialement",
  ];

  let bodyText = sourceText;
  let greetingLine = "";
  let senderName = "";

  for (const sep of greetingSeparators) {
    const idx = sourceText.indexOf(sep);
    if (idx !== -1) {
      bodyText = sourceText.slice(0, idx).trimEnd();
      // Alles nach der Grußformel
      const afterGreeting = sourceText.slice(idx);
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
          {loading && (
            <div className="mb-4 text-xs font-sans uppercase tracking-widest text-muted-foreground/70">
              {tOffer(lang, 'translatingLetter')}
            </div>
          )}
          {failed && lang !== 'de' && (
            <div className="mb-4 text-xs font-sans text-muted-foreground/70 italic">
              {tOffer(lang, 'translationFailed')}
            </div>
          )}
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
  lang,
}: {
  inquiry: PublicInquiry;
  phase: OfferPhase;
  lang: OfferLang;
}) {
  const rawCompany = (inquiry.company_name ?? '').trim();
  const isPlaceholderCompany =
    !rawCompany || rawCompany.toLowerCase() === 'private';
  const displayName = isPlaceholderCompany ? inquiry.contact_name : rawCompany;

  const phaseConfig: Partial<Record<OfferPhase, { text: string; color: string }>> = {
    proposal_sent: { text: tOffer(lang, 'phaseProposal'), color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    customer_responded: { text: tOffer(lang, 'phaseResponded'), color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    final_sent: { text: tOffer(lang, 'phaseFinal'), color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    confirmed: { text: tOffer(lang, 'phaseConfirmed'), color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    paid: { text: tOffer(lang, 'phasePaid'), color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
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
              {tOffer(lang, 'heroEyebrow')}
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
                    ? `${format(parseISO(inquiry.preferred_date), "d.", { locale: dateFnsLocale(lang) })}–${format(parseISO(inquiry.event_end_date), "d. MMMM yyyy", { locale: dateFnsLocale(lang) })}`
                    : format(parseISO(inquiry.preferred_date), "d. MMMM yyyy", { locale: dateFnsLocale(lang) })}
                </span>
              </div>
            )}
            {inquiry.guest_count && (
              <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/40">
                <Users className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-sm font-sans font-medium text-foreground/80">
                  {inquiry.guest_count} {tOffer(lang, 'guests')}
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
  lang,
  onSubmitted,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  lang: OfferLang;
  onSubmitted: (data: PublicOfferData) => void;
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedOption = options.find(o => o.id === selectedOptionId) || null;
  const totalAmount = selectedOption?.total_amount ?? 0;
  const deposit = computeDeposit(inquiry, totalAmount);
  const depositAmount = deposit.amount;

  // ACTION: Zahlung — leitet zu Stripe Checkout weiter
  const handlePayment = async (paymentType: 'full' | 'deposit') => {
    if (!selectedOptionId) return;
    setIsPaying(paymentType);
    try {
      const { checkoutUrl } = await createPaymentSession({
        inquiryId: inquiry.id,
        optionId: selectedOptionId,
        paymentType,
      });
      trackEvent("offer_payment_initiated", {
        payment_type: paymentType,
        value: paymentType === 'full' ? totalAmount : depositAmount,
        currency: "EUR",
      });
      window.location.href = checkoutUrl;
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

  // ACTION: Nachricht senden — submit_offer_response-Flow
  const handleSendMessage = async () => {
    if (!selectedOptionId || !notes.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        "submit_offer_response" as never,
        {
          p_inquiry_id: inquiry.id,
          p_selected_option_id: selectedOptionId,
          p_customer_notes: notes.trim(),
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

      if (wantsCopy && copyEmail.trim()) {
        supabase.functions.invoke("send-customer-response-copy", {
          body: {
            inquiryId: inquiry.id,
            customerEmail: copyEmail.trim(),
            selectedOptionLabel: selectedOption
              ? `Option ${selectedOption.option_label}: ${selectedOption.package_name}`
              : "Ihre Auswahl",
            customerNotes: notes.trim(),
          },
        }).catch(() => {});
      }

      trackEvent("generate_lead", {
        method: "offer_response",
        value: selectedOption?.total_amount ?? 0,
        currency: "EUR",
      });
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
          customer_notes: notes.trim(),
          responded_at: new Date().toISOString(),
        },
      });
    } catch {
      setSubmitError("Netzwerkfehler — bitte versuchen Sie es erneut");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSingle = options.length === 1;
  const busy = isSubmitting || isPaying !== null;

  // Payment-Method bestimmt, ob "verbindlich buchen ohne Online-Zahlung" angeboten wird
  const pm = inquiry.payment_method ?? '';
  const offlineTiming: 'on_site' | 'after_event' | 'transfer_prepay' | null =
    pm === 'on_site' || pm === 'pay_on_site' ? 'on_site'
    : pm === 'invoice_after' || pm === 'invoice_after_event' ? 'after_event'
    : pm === 'invoice_before' || pm === 'invoice_before_event' ? 'after_event'
    : pm === 'bank_transfer_prepay' ? 'transfer_prepay'
    : null;

  return (
    <section className="bg-secondary/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl">
          {/* Sektion-Header */}
          <div className="mb-10">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
              {isSingle ? tOffer(lang, 'ourProposal') : tOffer(lang, 'optionsCount').replace('{n}', String(options.length))}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-3">
              {isSingle ? tOffer(lang, 'yourOffer') : tOffer(lang, 'pickFavourite')}
            </h2>
            <p className="text-muted-foreground font-sans text-sm md:text-base max-w-xl">
              {isSingle ? tOffer(lang, 'intro_single') : tOffer(lang, 'intro_multi')}
            </p>
          </div>

          {/* Options */}
          <div className={cn(
            "gap-6 mb-12",
            options.length > 1 ? "grid grid-cols-1 lg:grid-cols-2" : "max-w-2xl"
          )}>
            {options.map((option) => (
              <ProposalOptionCard
                key={option.id}
                option={option}
                isSelected={selectedOptionId === option.id}
                onSelect={() => setSelectedOptionId(option.id)}
                singleOption={isSingle}
                lang={lang}
              />
            ))}
          </div>

          {/* PRIMARY ACTION — Buchen über Stripe (nur wenn Online-Zahlung & Betrag) */}
          {selectedOption && totalAmount > 0 && !offlineTiming && (
            <div className="max-w-2xl mb-10">
              <div className="bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-2xl border-2 border-primary/20 p-6 md:p-8 shadow-[0_8px_30px_rgba(139,0,0,0.08)]">
                <div className="mb-6">
                  <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-1">
                    {tOffer(lang, 'bookNowBinding')}
                  </h3>
                  <p className="text-sm text-muted-foreground font-sans">
                    {tOffer(lang, 'securePayStripe')}
                  </p>
                </div>

                <div className={cn(
                  "grid grid-cols-1 gap-3",
                  deposit.show && "md:grid-cols-2"
                )}>
                  {/* Voll bezahlen — Primary/Dominant */}
                  <Button
                    onClick={() => handlePayment('full')}
                    disabled={busy}
                    className="h-auto py-4 px-5 rounded-xl font-sans font-semibold flex flex-col items-start gap-0.5 shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all"
                  >
                    <span className="flex items-center gap-2 w-full justify-between">
                      <span className="text-sm">{tOffer(lang, 'payFull')}</span>
                      {isPaying === 'full' && <Loader2 className="h-4 w-4 animate-spin" />}
                    </span>
                    <span className="text-lg font-serif font-bold">
                      {formatCurrency(totalAmount, lang)}
                    </span>
                  </Button>

                  {/* Anzahlung — nur wenn vom Admin konfiguriert (0 % < x < 100 %) */}
                  {deposit.show && (
                  <Button
                    onClick={() => handlePayment('deposit')}
                    disabled={busy}
                    variant="outline"
                    className="h-auto py-4 px-5 rounded-xl font-sans font-semibold flex flex-col items-start gap-0.5 border-2 border-primary/30 text-foreground bg-white/50 hover:bg-white/80 hover:border-primary/50 hover:-translate-y-0.5 transition-all"
                  >
                    <span className="flex items-center gap-2 w-full justify-between">
                      <span className="text-sm">{deposit.label}</span>
                      {isPaying === 'deposit' && <Loader2 className="h-4 w-4 animate-spin" />}
                    </span>
                    <span className="text-lg font-serif font-bold text-primary">
                      {formatCurrencyDecimal(depositAmount, lang)}
                    </span>
                  </Button>
                  )}
                </div>

                {/* Trust-Elemente */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-xs text-muted-foreground font-sans">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    {tOffer(lang, 'sslSecured')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" />
                    {tOffer(lang, 'secureViaStripe')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    {tOffer(lang, 'invoiceFollows')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Stornobedingungen — direkt unter der Buchen-Box (nur wenn buchbar) */}
          {selectedOption && totalAmount > 0 && (
            <div className="max-w-2xl mb-10 px-2">
              <CancellationTermsAccordion />
            </div>
          )}

          {/* ALTERNATIVE: Verbindlich buchen ohne Online-Zahlung (z.B. Zahlung vor Ort / nach Event) */}
          {selectedOption && offlineTiming && (
            <div className="max-w-2xl mb-10">
              <div className="rounded-2xl border border-border/40 bg-white/40 dark:bg-white/5 backdrop-blur-sm p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="font-serif text-base md:text-lg font-semibold mb-1">
                    {tOffer(lang, 'preferOffline')}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground font-sans">
                    {tOffer(lang, 'preferOfflineIntro')}{' '}
                    {offlineTiming === 'on_site' && tOffer(lang, 'offlineTimingOnSiteSentence')}
                    {offlineTiming === 'after_event' && tOffer(lang, 'offlineTimingAfterEventSentence')}
                    {offlineTiming === 'transfer_prepay' && tOffer(lang, 'offlineTimingTransferSentence')}
                  </p>
                </div>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  variant="outline"
                  className="rounded-full font-sans border-2 border-primary/40 hover:border-primary"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {tOffer(lang, 'bookBinding')}
                </Button>
              </div>
            </div>
          )}

          {selectedOption && offlineTiming && (
            <OrderConfirmationDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              inquiryId={inquiry.id}
              selectedOptionId={selectedOption.id}
              totalAmount={totalAmount}
              paymentTiming={offlineTiming}
              lang={lang}
              onConfirmed={() => {
                onSubmitted({
                  inquiry: { ...inquiry, offer_phase: 'order_confirmed', selected_option_id: selectedOption.id },
                  options,
                  customer_response: null,
                });
              }}
            />
          )}

          {/* SECONDARY ACTION — Nachricht senden */}
          <div className="max-w-2xl">
            <div className="rounded-2xl border border-border/40 bg-white/40 dark:bg-white/5 backdrop-blur-sm p-6 md:p-7">
              <div className="mb-4">
                <h3 className="font-serif text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary/70" />
                  {tOffer(lang, 'questionOrChange')}
                </h3>
                <p className="text-sm text-muted-foreground font-sans">
                  {tOffer(lang, 'questionHelp')}
                </p>
              </div>

              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tOffer(lang, 'messagePlaceholder')}
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
                    {tOffer(lang, 'copyToEmail')}
                  </span>
                </label>
                {wantsCopy && (
                  <div className="mt-2 ml-6">
                    <Input
                      type="email"
                      value={copyEmail}
                      onChange={(e) => setCopyEmail(e.target.value)}
                      placeholder={tOffer(lang, 'copyEmailPlaceholder')}
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
                {tOffer(lang, 'sendMessage')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
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
  lang,
}: {
  option: PublicOfferOption;
  isSelected: boolean;
  onSelect: () => void;
  singleOption: boolean;
  lang: OfferLang;
}) {
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  // Filter: Drinks mit Inhalt ODER "inkl."-Einträge (Wasser/Kaffee) mit quantityLabel
  const _drinksLegacy = menu?.drinks?.filter((d) =>
    d.selectedChoice || d.customDrink || d.quantityLabel
  ) || [];
  const _drinksEinzeln: DrinkSelection[] = ((menu as any)?.drinksEinzeln || [])
    .filter((d: { name: string }) => d.name)
    .map((d: { name: string; quantity?: number | null }) => ({
      drinkGroup: 'custom' as const,
      drinkLabel: (d.quantity ?? 1) > 1 ? `${d.quantity} × ${d.name}` : d.name,
      selectedChoice: null,
      customDrink: null,
      quantityLabel: null,
    }));
  const _drinksExtra: DrinkSelection[] = (menu as any)?.drinksMode === 'pauschale' && (menu as any)?.drinksPauschaleDescription
    ? [{ drinkGroup: 'custom' as const, drinkLabel: (menu as any).drinksPauschaleDescription as string, selectedChoice: null, customDrink: null, quantityLabel: null }]
    : (menu as any)?.drinksMode === 'weinbegleitung' && (menu as any)?.winePairingPrice
    ? [{ drinkGroup: 'main_drink' as const, drinkLabel: 'Weinbegleitung', selectedChoice: null, customDrink: null, quantityLabel: null }]
    : [];
  const drinks: DrinkSelection[] = _drinksLegacy.length > 0 ? _drinksLegacy : [..._drinksEinzeln, ..._drinksExtra];
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
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-2xl overflow-hidden transition-all duration-200",
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
                ? tOffer(lang, 'customMenu')
                : option.package_name}
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {option.guest_count} {tOffer(lang, 'guests')}
            </p>
          </div>
        </div>

        {/* Preis */}
        <div className="text-right shrink-0">
          <p className="text-2xl font-serif font-bold text-primary leading-none">
            {pricePerPerson > 0
              ? formatCurrencyDecimal(pricePerPerson, lang)
              : formatCurrency(option.total_amount, lang)}
          </p>
          <p className="text-[11px] text-muted-foreground font-sans mt-1">
            {pricePerPerson > 0 ? tOffer(lang, 'perPersonShort') : tOffer(lang, 'totalPriceLabel')}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-sans mt-0.5">
            {tOffer(lang, 'inclVat')}
          </p>
        </div>
      </div>

      {/* Menü-Details im Speisekarten-Stil — lesbar, wertig */}
      {(courses.length > 0 || drinks.length > 0) && (
        <div className="px-6 pb-6">
          <div className="border-t border-border/20 pt-5">
            {courses.length > 0 && (
              <div className="space-y-4">
                {courses.map((c, i) => (
                  <div key={i} className="flex items-baseline gap-4">
                    <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-[0.15em] w-24 flex-shrink-0 pt-0.5">
                      {pickLang(c, 'courseLabel', lang) || c.courseLabel}
                    </span>
                    <div className="flex-1">
                      <p className="text-base md:text-lg font-serif text-foreground leading-snug">
                        {(() => {
                          const name = pickLang(c, 'itemName', lang) || c.itemName;
                          return (c.quantity ?? 1) > 1 ? `${c.quantity} × ${name}` : name;
                        })()}
                      </p>
                      {(pickLang(c, 'itemDescription', lang) || c.itemDescription) && (
                        <p className="text-sm font-sans text-foreground/70 mt-1 leading-relaxed">
                          {pickLang(c, 'itemDescription', lang) || c.itemDescription}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {drinks.length > 0 && (
              <div className={cn("space-y-3", courses.length > 0 && "mt-6 pt-5 border-t border-border/15")}>
                {drinks.map((d, i) => {
                  const choiceLocalized = lang !== 'de' && d.selectedChoice
                    ? d.selectedChoice_translations?.[lang] || d.selectedChoice
                    : d.selectedChoice;
                  const hasContent = d.customDrink || choiceLocalized;
                  const qtyLabel = pickLang(d, 'quantityLabel', lang) || d.quantityLabel;
                  const drinkLabelLoc = pickLang(d, 'drinkLabel', lang) || d.drinkLabel;
                  // quantityLabel nur zeigen wenn es keine Redundanz zu "inklusive" ist
                  const qtyIsRedundant = qtyLabel && /^\s*(inklusive|inkl\.?|included|incluso|inclus)\s*$/i.test(qtyLabel);
                  return (
                    <div key={i} className="flex items-baseline gap-4">
                      <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-[0.15em] w-24 flex-shrink-0">
                        {drinkLabelLoc === 'Zusatzgetränk' ? 'Getränk' : drinkLabelLoc}
                      </span>
                      <p className="text-base font-serif text-foreground leading-snug">
                        {hasContent ? (d.customDrink || choiceLocalized) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-sans text-sm font-semibold uppercase tracking-wider">
                            {tOffer(lang, 'included')}
                          </span>
                        )}
                        {qtyLabel && !qtyIsRedundant && (
                          <span className="text-sm text-muted-foreground ml-2 font-sans">
                            ({qtyLabel})
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </button>
  );
}

// =================================================================
// THANK YOU VIEW
// =================================================================

function ThankYouView({
  customerResponse,
  options,
  lang,
}: {
  customerResponse: CustomerResponseData | null;
  options: PublicOfferOption[];
  lang: OfferLang;
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
            {tOffer(lang, 'thankTitle')}
          </h2>
          {selectedOption && (
            <p className="text-muted-foreground font-sans mb-2">
              {tOffer(lang, 'thankChose')}{" "}
              <strong className="text-foreground">
                {selectedOption.package_name}
              </strong>{" "}
              {tOffer(lang, 'thankChoseSuffix')}
            </p>
          )}
          {customerResponse?.customer_notes && (
            <div className="bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-xl p-5 mt-6 mb-6 text-left border border-white/40">
              <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                {tOffer(lang, 'thankNote')}
              </p>
              <p className="text-sm font-sans text-foreground whitespace-pre-wrap">
                {customerResponse.customer_notes}
              </p>
            </div>
          )}
          <p className="text-muted-foreground font-sans">
            {tOffer(lang, 'thankFollowUp')}
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
  lang,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  lang: OfferLang;
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
              {tOffer(lang, 'finalOfferEyebrow')}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold">
              {displayOptions.length === 1 ? tOffer(lang, 'yourMenu') : tOffer(lang, 'optionsCount').replace('{n}', String(displayOptions.length))}
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
                inquiry={inquiry}
                isSelected={inquiry.selected_option_id === option.id}
                singleOption={displayOptions.length === 1}
                lang={lang}
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
  inquiry,
  isSelected,
  singleOption,
  lang,
}: {
  option: PublicOfferOption;
  inquiryId: string;
  inquiry: PublicInquiry;
  isSelected: boolean;
  singleOption: boolean;
  lang: OfferLang;
}) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  // Filter: Drinks mit Inhalt ODER "inkl."-Einträge (Wasser/Kaffee) mit quantityLabel
  const _drinksLegacy = menu?.drinks?.filter((d) =>
    d.selectedChoice || d.customDrink || d.quantityLabel
  ) || [];
  const _drinksEinzeln: DrinkSelection[] = ((menu as any)?.drinksEinzeln || [])
    .filter((d: { name: string }) => d.name)
    .map((d: { name: string; quantity?: number | null }) => ({
      drinkGroup: 'custom' as const,
      drinkLabel: (d.quantity ?? 1) > 1 ? `${d.quantity} × ${d.name}` : d.name,
      selectedChoice: null,
      customDrink: null,
      quantityLabel: null,
    }));
  const _drinksExtra: DrinkSelection[] = (menu as any)?.drinksMode === 'pauschale' && (menu as any)?.drinksPauschaleDescription
    ? [{ drinkGroup: 'custom' as const, drinkLabel: (menu as any).drinksPauschaleDescription as string, selectedChoice: null, customDrink: null, quantityLabel: null }]
    : (menu as any)?.drinksMode === 'weinbegleitung' && (menu as any)?.winePairingPrice
    ? [{ drinkGroup: 'main_drink' as const, drinkLabel: 'Weinbegleitung', selectedChoice: null, customDrink: null, quantityLabel: null }]
    : [];
  const drinks: DrinkSelection[] = _drinksLegacy.length > 0 ? _drinksLegacy : [..._drinksEinzeln, ..._drinksExtra];
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
  const deposit = computeDeposit(inquiry, totalAmount);
  const depositAmount = deposit.amount;

  const pm = inquiry.payment_method ?? '';
  const offlineTiming: 'on_site' | 'after_event' | 'transfer_prepay' | null =
    pm === 'on_site' || pm === 'pay_on_site' ? 'on_site'
    : pm === 'invoice_after' || pm === 'invoice_after_event' ? 'after_event'
    : pm === 'invoice_before' || pm === 'invoice_before_event' ? 'after_event'
    : pm === 'bank_transfer_prepay' ? 'transfer_prepay'
    : null;

  const handlePayment = async (paymentType: 'full' | 'deposit') => {
    setIsRedirecting(true);
    try {
      const { checkoutUrl } = await createPaymentSession({
        inquiryId,
        optionId: option.id,
        paymentType,
      });
      window.location.href = checkoutUrl;
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
                ? tOffer(lang, 'customMenu')
                : option.package_name}
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {option.guest_count} {tOffer(lang, 'guests')}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-serif font-bold text-primary leading-none">
            {pricePerPerson > 0
              ? formatCurrencyDecimal(pricePerPerson, lang)
              : formatCurrency(option.total_amount, lang)}
          </p>
          <p className="text-[11px] text-muted-foreground font-sans mt-1">
            {pricePerPerson > 0 ? tOffer(lang, 'perPersonShort') : tOffer(lang, 'totalPriceLabel')}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-sans mt-0.5">
            {tOffer(lang, 'inclVat')}
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
                {tOffer(lang, 'menuLabel')}
              </h4>
            </div>
            <div className="space-y-4">
              {courses.map((course, i) => (
                <div key={i}>
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/40 mb-1">
                    {pickLang(course, 'courseLabel', lang) || course.courseLabel}
                  </p>
                  <p className="font-serif text-base text-foreground">
                    {(() => {
                      const name = pickLang(course, 'itemName', lang) || course.itemName;
                      return (course.quantity ?? 1) > 1 ? `${course.quantity} × ${name}` : name;
                    })()}
                  </p>
                  {(pickLang(course, 'itemDescription', lang) || course.itemDescription) && (
                    <p className="text-xs font-sans text-muted-foreground/60 italic mt-0.5">
                      {pickLang(course, 'itemDescription', lang) || course.itemDescription}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {drinks.length > 0 && (
          <div className={cn("border-t border-border/20 pt-5", courses.length === 0 && "mt-0")}>
            <div className="flex items-center gap-2 mb-4">
              <Wine className="h-3.5 w-3.5 text-primary/40" />
              <h4 className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/50">
                {tOffer(lang, 'drinksLabel')}
              </h4>
            </div>
            <div className="space-y-2.5">
              {drinks.map((drink, i) => {
                const choiceLocalized = lang !== 'de' && drink.selectedChoice
                  ? drink.selectedChoice_translations?.[lang] || drink.selectedChoice
                  : drink.selectedChoice;
                const hasContent = drink.customDrink || choiceLocalized;
                const qtyLabel = pickLang(drink, 'quantityLabel', lang) || drink.quantityLabel;
                const drinkLabelLoc = pickLang(drink, 'drinkLabel', lang) || drink.drinkLabel;
                const qtyIsRedundant = qtyLabel && /^\s*(inklusive|inkl\.?|included|incluso|inclus)\s*$/i.test(qtyLabel);
                return (
                  <div key={i}>
                    <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/40 mb-0.5">
                      {drinkLabelLoc === 'Zusatzgetränk' ? 'Getränk' : drinkLabelLoc}
                    </p>
                    <p className="font-serif text-sm text-foreground">
                      {hasContent ? (drink.customDrink || choiceLocalized) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-sans text-xs font-semibold uppercase tracking-wider">
                          {tOffer(lang, 'included')}
                        </span>
                      )}
                      {qtyLabel && !qtyIsRedundant && (
                        <span className="text-muted-foreground/50 ml-1">
                          ({qtyLabel})
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {courses.length === 0 && drinks.length === 0 && (
          <div className="border-t border-border/20 pt-5">
            <p className="text-sm text-muted-foreground font-sans italic">
              {tOffer(lang, 'menuComingSoon')}
            </p>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="px-6 py-4 bg-muted/30 border-t border-border/10">
        {option.offer_mode === 'paket' ? (
          /* Paket-Modus: nur Gesamtzahlung */
          <Button
            className="w-full h-12 gap-2 rounded-full font-sans font-semibold text-base shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-80 disabled:hover:translate-y-0"
            onClick={() => handlePayment('full')}
            disabled={isRedirecting}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tOffer(lang, 'preparingPayment')}
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                {tOffer(lang, 'payNowAmount')} — {formatCurrencyDecimal(totalAmount, lang)}
              </>
            )}
          </Button>
        ) : totalAmount > 0 ? (
          /* Menü-Modus: Komplett oder Anzahlung */
          <div className="space-y-3">
            <p className="text-sm font-sans font-medium text-center text-foreground/80">
              {isRedirecting ? tOffer(lang, 'preparingPayment') : tOffer(lang, 'howToPay')}
            </p>
            <div className={cn("grid gap-3", deposit.show ? "grid-cols-2" : "grid-cols-1")}>
              <button
                onClick={() => handlePayment('full')}
                disabled={isRedirecting}
                className="p-4 rounded-xl border-2 border-primary text-center hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <>
                    <span className="font-bold text-sm font-sans block">{formatCurrencyDecimal(totalAmount, lang)}</span>
                    <span className="text-xs font-sans text-muted-foreground block mt-0.5">{tOffer(lang, 'payFullShort')}</span>
                  </>
                )}
              </button>
              {deposit.show && (
              <button
                onClick={() => handlePayment('deposit')}
                disabled={isRedirecting}
                className="p-4 rounded-xl border border-border text-center hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <>
                    <span className="font-bold text-sm font-sans block">{formatCurrencyDecimal(depositAmount, lang)}</span>
                    <span className="text-xs font-sans text-muted-foreground block mt-0.5">{deposit.label}</span>
                    <span className="text-[10px] font-sans text-muted-foreground/60 block">{tOffer(lang, 'restBeforeEvent')}</span>
                  </>
                )}
              </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground font-sans py-1">
            {tOffer(lang, 'contactForBooking')}
          </p>
        )}

        {/* Stornobedingungen — kompakter Accordion unter Zahlungs-Button */}
        {totalAmount > 0 && <CancellationTermsAccordion />}

        {offlineTiming && totalAmount > 0 && (
          <div className="mt-4 pt-4 border-t border-border/20">
            <Button
              onClick={() => setConfirmOpen(true)}
              variant="outline"
              className="w-full rounded-full font-sans border-2 border-primary/40 hover:border-primary"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              {tOffer(lang, 'bookBindingNoOnline')}
            </Button>
            <p className="text-[11px] text-muted-foreground/70 text-center mt-2">
              {offlineTiming === 'on_site' && tOffer(lang, 'offlineTimingOnSiteShort')}
              {offlineTiming === 'after_event' && tOffer(lang, 'offlineTimingAfterEventShort')}
              {offlineTiming === 'transfer_prepay' && tOffer(lang, 'offlineTimingTransferShort')}
            </p>
          </div>
        )}

        {offlineTiming && (
          <OrderConfirmationDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            inquiryId={inquiryId}
            selectedOptionId={option.id}
            totalAmount={totalAmount}
            paymentTiming={offlineTiming}
            lang={lang}
            onConfirmed={() => {
              window.location.reload();
            }}
          />
        )}
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
  lang,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  lang: OfferLang;
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
            {tOffer(lang, 'bookingConfirmed')}
          </h2>
          {selectedOption && (
            <p className="text-muted-foreground font-sans mb-2">
              <strong className="text-foreground">{selectedOption.package_name}</strong>
              {" "}{tOffer(lang, 'forGuests').replace('{n}', String(selectedOption.guest_count))} —{" "}
              {pricePerPerson > 0
                ? `${formatCurrencyDecimal(pricePerPerson, lang)} ${tOffer(lang, 'perPersonSuffix')}`
                : `${formatCurrency(selectedOption.total_amount, lang)} ${tOffer(lang, 'totalSuffix')}`}
            </p>
          )}
          {inquiry.preferred_date && (
            <p className="text-lg font-serif font-semibold text-foreground mb-2">
              {inquiry.event_end_date
                ? `${format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM", { locale: dateFnsLocale(lang) })} – ${format(parseISO(inquiry.event_end_date), "d. MMMM yyyy", { locale: dateFnsLocale(lang) })}`
                : format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM yyyy", { locale: dateFnsLocale(lang) })}
            </p>
          )}
          <p className="text-muted-foreground font-sans mt-6">
            {tOffer(lang, 'weLookForward')}
          </p>
        </div>

        {/* Menü-Details — auch nach Bestätigung sichtbar */}
        {selectedOption && (() => {
          const menu = selectedOption.menu_selection;
          const courses = menu?.courses?.filter((c) => c.itemName) || [];
          const drinkRows = buildDrinkRows(menu);
          if (courses.length === 0 && drinkRows.length === 0) return null;
          return (
            <div className="max-w-2xl mt-12">
              <div className="bg-white/70 dark:bg-white/10 backdrop-blur-sm border border-white/60 dark:border-white/20 rounded-2xl px-6 py-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <h3 className="font-serif text-lg font-bold text-foreground mb-5">
                  {tOffer(lang, 'yourSelectedMenu')}
                </h3>
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
                        <p className="flex-1 text-sm md:text-base font-serif text-foreground leading-snug">
                          {d.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
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
  lang,
}: {
  payments: PublicPayment[];
  eventDate?: string;
  lang: OfferLang;
}) {
  if (!payments.length) return null;

  const typeLabels: Record<string, string> = {
    deposit: tOffer(lang, 'paymentsTypeDeposit'),
    prepayment: tOffer(lang, 'paymentsTypePrepayment'),
    final: tOffer(lang, 'paymentsTypeFinal'),
  };

  const fmt = (cents: number) =>
    new Intl.NumberFormat(currencyLocale(lang), { style: "currency", currency: "EUR" }).format(cents / 100);

  const fmtDate = (iso: string | null | Date) => {
    if (!iso) return null;
    try {
      return format(typeof iso === "string" ? parseISO(iso) : iso, "d. MMMM yyyy", { locale: dateFnsLocale(lang) });
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
    ? tOffer(lang, 'paymentsHeadingPaid')
    : hasOverdue
    ? tOffer(lang, 'paymentsHeadingOpen')
    : tOffer(lang, 'paymentsHeadingPaid');

  return (
    <section className="bg-background border-t border-border/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl">
          {/* Header */}
          <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
            {tOffer(lang, 'paymentsEyebrow')}
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
                        ? `${tOffer(lang, 'paymentsPaidOn')} ${fmtDate(p.paid_at) ?? "—"}`
                        : isOverdue
                        ? `${tOffer(lang, 'paymentsDueSince')} ${fmtDate(due) ?? "—"}`
                        : due
                        ? `${tOffer(lang, 'paymentsDueBy')} ${fmtDate(due)}`
                        : tOffer(lang, 'dueAnnounced')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-sans font-bold text-sm text-foreground">{fmt(p.amount_cents)}</p>
                    {isPaid && <p className="text-xs text-emerald-600 font-sans">{tOffer(lang, 'paymentsReceived')}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gesamtsumme wenn alles bezahlt */}
          {allPaid && (
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-6">
              <p className="font-sans font-semibold text-sm text-emerald-800">{tOffer(lang, 'paymentsTotalPaid')}</p>
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
                  {typeLabels[firstOpen.payment_type] ?? tOffer(lang, 'payGeneric')} {tOffer(lang, 'paymentsPayCta')}
                </span>
                <span className="text-xs font-normal opacity-80">{tOffer(lang, 'payMethods')}</span>
              </button>
            </a>
          )}

          {/* Alles bezahlt — Dankestext */}
          {allPaid && (
            <p className="text-sm font-sans text-muted-foreground">
              {tOffer(lang, 'paymentsAllPaidThanks')}
            </p>
          )}

          {/* Kontakthinweis bei offener Zahlung ohne Link */}
          {!allPaid && firstOpen && !firstOpen.stripe_payment_link_url && (
            <p className="text-sm font-sans text-muted-foreground">
              {tOffer(lang, 'paymentsContactIntro')}{" "}
              <a href="tel:+498951519696" className="text-primary hover:underline">089 51519696</a>{" "}
              {tOffer(lang, 'paymentsOrText')}{" "}
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

function ContactSection({ lang }: { lang: OfferLang }) {
  return (
    <section className="border-t border-border/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
          {tOffer(lang, 'contactEyebrow')}
        </p>
        <h2 className="text-xl md:text-2xl font-serif font-bold mb-3">
          {tOffer(lang, 'contactTitle')}
        </h2>
        <p className="text-muted-foreground font-sans mb-8 max-w-md text-sm">
          {tOffer(lang, 'contactSubtitle')}
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

function OfferFooter({ lang = 'de' }: { lang?: OfferLang }) {
  return _OfferFooter(lang);
}

function _OfferFooter(lang: OfferLang = 'de') {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-display text-xl font-bold tracking-wide mb-1">STORIA</p>
            <p className="text-sm text-background/50 font-sans">
              {tOffer(lang, 'footerCompany')}
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
              {tOffer(lang, 'footerImprint')}
            </LocalizedLink>
            <LocalizedLink
              to="legal.privacy"
              className="hover:text-background/60 transition-colors"
            >
              {tOffer(lang, 'footerPrivacy')}
            </LocalizedLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
