import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { LocalizedLink } from "@/components/LocalizedLink";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  guest_count: string | null;
  status: string;
  offer_phase: OfferPhase;
  selected_option_id: string | null;
  email_content: string | null;
  lexoffice_invoice_id: string | null;
}

interface CourseSelection {
  courseType: string;
  courseLabel: string;
  itemName: string;
  itemDescription: string | null;
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
// MAIN COMPONENT
// =================================================================

export default function PublicOffer() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const location = useLocation();
  const [data, setData] = useState<PublicOfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Slug-Route (/ihr-angebot/:slug) oder UUID-Route (/offer/:id)
  const isSlugRoute = location.pathname.includes('/ihr-angebot/') || location.pathname.includes('/your-offer/');
  const lookupValue = slug || id;

  useEffect(() => {
    if (!lookupValue) return;

    const fetchOffer = async () => {
      try {
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
  }, [lookupValue, isSlugRoute]);

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
  const effectivePhase: OfferPhase =
    phase === "draft" && inquiry.status === "offer_sent" ? "final_sent" : phase;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfferHeader />
      <main className="flex-1">
        <HeroSection inquiry={inquiry} phase={effectivePhase} />

        {/* PDF-Download — nur wenn LexOffice-Angebot verknüpft */}
        {inquiry.lexoffice_invoice_id && (
          <PdfDownloadSection inquiryId={inquiry.id} />
        )}

        {/* Anschreiben — immer sichtbar wenn vorhanden */}
        {inquiry.email_content && (
          <AnschreibenSection emailContent={inquiry.email_content} />
        )}

        {effectivePhase === "proposal_sent" && (
          <ProposalView
            inquiry={inquiry}
            options={options}
            onSubmitted={(updatedData) => setData(updatedData)}
          />
        )}

        {effectivePhase === "customer_responded" && (
          <ThankYouView
            customerResponse={customer_response}
            options={options}
          />
        )}

        {(effectivePhase === "final_sent" ||
          effectivePhase === "final_draft") && (
          <FinalOfferView
            inquiry={inquiry}
            options={options}
          />
        )}

        {(effectivePhase === "confirmed" || effectivePhase === "paid") && (
          <ConfirmationView inquiry={inquiry} options={options} />
        )}

        <ContactSection />
      </main>
      <OfferFooter />
    </div>
  );
}

// =================================================================
// PDF DOWNLOAD SECTION
// =================================================================

function PdfDownloadSection({ inquiryId }: { inquiryId: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'download-public-offer-pdf',
        { body: { inquiryId } }
      );

      if (error || data?.error) {
        throw new Error(data?.error || 'Download fehlgeschlagen');
      }

      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.pdf}`;
      link.download = data.filename || 'STORIA_Angebot.pdf';
      link.click();
    } catch {
      // Stille Fehlerbehandlung — Button bleibt sichtbar
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="bg-background border-b border-border/20">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 max-w-2xl">
          <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
            <FileText className="h-4.5 w-4.5 text-primary/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-sans text-foreground/80">
              Ihr Angebot steht auch als PDF zum Download bereit.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="rounded-full gap-2 font-sans shrink-0"
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            PDF herunterladen
          </Button>
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
                  {format(parseISO(inquiry.preferred_date), "d. MMMM yyyy", { locale: de })}
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
// PROPOSAL VIEW — Kunde wählt Option + schreibt Anmerkungen
// =================================================================

function ProposalView({
  inquiry,
  options,
  onSubmitted,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  onSubmitted: (data: PublicOfferData) => void;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wantsCopy, setWantsCopy] = useState(false);
  const [copyEmail, setCopyEmail] = useState(inquiry.email || "");

  const handleSubmit = async () => {
    if (!selectedOptionId) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        "submit_offer_response" as never,
        {
          p_inquiry_id: inquiry.id,
          p_selected_option_id: selectedOptionId,
          p_customer_notes: notes.trim() || null,
        } as never
      );

      const res = result as unknown as { success: boolean; error?: string };

      if (rpcError || !res?.success) {
        setSubmitError(res?.error || "Fehler beim Absenden");
        return;
      }

      // Admin-Notification (fire-and-forget)
      supabase.functions.invoke("notify-customer-response", {
        body: { inquiryId: inquiry.id },
      }).catch(() => {});

      // E-Mail-Kopie (fire-and-forget)
      if (wantsCopy && copyEmail.trim()) {
        const selectedOpt = options.find(o => o.id === selectedOptionId);
        supabase.functions.invoke("send-customer-response-copy", {
          body: {
            inquiryId: inquiry.id,
            customerEmail: copyEmail.trim(),
            selectedOptionLabel: selectedOpt
              ? `Option ${selectedOpt.option_label}: ${selectedOpt.package_name}`
              : "Ihre Auswahl",
            customerNotes: notes.trim() || null,
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
          customer_notes: notes.trim() || null,
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

  return (
    <section className="bg-secondary/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl">
          {/* Sektion-Header */}
          <div className="mb-10">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
              {isSingle ? "Unser Vorschlag" : `${options.length} Optionen`}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-3">
              {isSingle
                ? "Ihr Menü-Vorschlag"
                : "Wählen Sie Ihren Favoriten"}
            </h2>
            <p className="text-muted-foreground font-sans text-sm md:text-base max-w-xl">
              {isSingle
                ? "Teilen Sie uns eventuelle Wünsche oder Änderungen mit."
                : "Wir haben verschiedene Optionen für Sie zusammengestellt. Wählen Sie Ihren Favoriten und teilen Sie uns eventuelle Wünsche mit."}
            </p>
          </div>

          {/* Options */}
          <div className={cn(
            "gap-6 mb-10",
            options.length > 1 ? "grid grid-cols-1 lg:grid-cols-2" : "max-w-2xl"
          )}>
            {options.map((option) => (
              <ProposalOptionCard
                key={option.id}
                option={option}
                isSelected={selectedOptionId === option.id}
                onSelect={() => setSelectedOptionId(option.id)}
                singleOption={isSingle}
              />
            ))}
          </div>

          {/* Anmerkungen + Submit */}
          <div className="max-w-2xl">
            <div className="mb-6">
              <label className="text-sm font-sans font-medium text-foreground mb-2 block">
                <MessageSquare className="h-4 w-4 inline mr-1.5 text-muted-foreground" />
                Antworten Sie uns gerne direkt hier
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="z.B. Allergien, vegetarische Gäste, besondere Wünsche…"
                className="min-h-[100px] rounded-xl resize-y font-sans"
              />
            </div>

            {/* E-Mail-Kopie */}
            <div className="mb-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantsCopy}
                  onChange={(e) => setWantsCopy(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-muted-foreground font-sans flex items-center gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Kopie meiner Antwort per E-Mail erhalten
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
              <p className="text-sm text-destructive mb-4 font-sans">{submitError}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!selectedOptionId || isSubmitting}
              className="h-12 px-8 rounded-full font-sans font-semibold gap-2 text-base shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Auswahl bestätigen
            </Button>
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
}: {
  option: PublicOfferOption;
  isSelected: boolean;
  onSelect: () => void;
  singleOption: boolean;
}) {
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  const drinks = menu?.drinks?.filter((d) => d.selectedChoice || d.customDrink) || [];
  const pricePerPerson =
    option.guest_count > 0
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
                ? "Individuelles Menü"
                : option.package_name}
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {option.guest_count} Gäste
            </p>
          </div>
        </div>

        {/* Preis */}
        <div className="text-right shrink-0">
          <p className="text-2xl font-serif font-bold text-primary leading-none">
            {pricePerPerson > 0
              ? formatCurrencyDecimal(pricePerPerson)
              : formatCurrency(option.total_amount)}
          </p>
          {pricePerPerson > 0 && (
            <p className="text-[11px] text-muted-foreground font-sans mt-1">
              pro Person
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/60 font-sans mt-0.5">
            zzgl. gesetzl. MwSt.
          </p>
        </div>
      </div>

      {/* Menü-Details im Speisekarten-Stil */}
      {(courses.length > 0 || drinks.length > 0) && (
        <div className="px-6 pb-5">
          <div className="border-t border-border/20 pt-4">
            {courses.length > 0 && (
              <div className="space-y-2.5">
                {courses.map((c, i) => (
                  <div key={i} className="flex items-baseline gap-3">
                    <span className="text-[10px] font-sans font-semibold text-primary/50 uppercase tracking-[0.15em] w-20 flex-shrink-0">
                      {c.courseLabel}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-serif text-foreground/80">
                        {c.itemName}
                      </span>
                      {c.itemDescription && (
                        <p className="text-xs text-muted-foreground/60 font-sans italic mt-0.5">
                          {c.itemDescription}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {drinks.length > 0 && (
              <div className={cn("space-y-2", courses.length > 0 && "mt-4 pt-3 border-t border-border/10")}>
                {drinks.map((d, i) => (
                  <div key={i} className="flex items-baseline gap-3">
                    <span className="text-[10px] font-sans font-semibold text-primary/50 uppercase tracking-[0.15em] w-20 flex-shrink-0">
                      {d.drinkLabel}
                    </span>
                    <span className="text-sm font-serif text-foreground/80">
                      {d.customDrink || d.selectedChoice}
                      {d.quantityLabel && (
                        <span className="text-muted-foreground/50 ml-1">
                          ({d.quantityLabel})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
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
                isSelected={inquiry.selected_option_id === option.id}
                singleOption={displayOptions.length === 1}
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
  isSelected,
  singleOption,
}: {
  option: PublicOfferOption;
  isSelected: boolean;
  singleOption: boolean;
}) {
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  const drinks = menu?.drinks?.filter((d) => d.selectedChoice || d.customDrink) || [];
  const pricePerPerson =
    option.guest_count > 0
      ? (menu?.budgetPerPerson && menu.budgetPerPerson > 0
          ? menu.budgetPerPerson
          : option.total_amount / option.guest_count)
      : 0;

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
          {pricePerPerson > 0 && (
            <p className="text-[11px] text-muted-foreground font-sans mt-1">
              pro Person
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/60 font-sans mt-0.5">
            zzgl. gesetzl. MwSt.
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
                  <p className="font-serif text-base text-foreground">
                    {course.itemName}
                  </p>
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

        {drinks.length > 0 && (
          <div className={cn("border-t border-border/20 pt-5", courses.length === 0 && "mt-0")}>
            <div className="flex items-center gap-2 mb-4">
              <Wine className="h-3.5 w-3.5 text-primary/40" />
              <h4 className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/50">
                Getränke
              </h4>
            </div>
            <div className="space-y-2.5">
              {drinks.map((drink, i) => (
                <div key={i}>
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/40 mb-0.5">
                    {drink.drinkLabel}
                  </p>
                  <p className="font-serif text-sm text-foreground">
                    {drink.customDrink || drink.selectedChoice}
                    {drink.quantityLabel && (
                      <span className="text-muted-foreground/50 ml-1">
                        ({drink.quantityLabel})
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {courses.length === 0 && drinks.length === 0 && (
          <div className="border-t border-border/20 pt-5">
            <p className="text-sm text-muted-foreground font-sans italic">
              Menüdetails werden noch zusammengestellt.
            </p>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="px-6 py-4 bg-muted/30 border-t border-border/10">
        {option.stripe_payment_link_url ? (
          <a
            href={option.stripe_payment_link_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="w-full h-12 gap-2 rounded-full font-sans font-semibold text-base shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all">
              <CreditCard className="h-4 w-4" />
              Jetzt verbindlich buchen
            </Button>
          </a>
        ) : (
          <p className="text-center text-sm text-muted-foreground font-sans py-1">
            Zahlungslink wird erstellt — wir melden uns.
          </p>
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
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
}) {
  const selectedOption = inquiry.selected_option_id
    ? options.find((o) => o.id === inquiry.selected_option_id)
    : options[0];

  const pricePerPerson =
    selectedOption && selectedOption.guest_count > 0
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
                : formatCurrency(selectedOption.total_amount)}
            </p>
          )}
          {inquiry.preferred_date && (
            <p className="text-lg font-serif font-semibold text-foreground mb-2">
              {format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM yyyy", { locale: de })}
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
// CONTACT SECTION
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
    <header className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
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
