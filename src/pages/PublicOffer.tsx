import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
  MapPin,
  MessageSquare,
  Send,
  Copy,
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

// =================================================================
// MAIN COMPONENT
// =================================================================

export default function PublicOffer() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PublicOfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchOffer = async () => {
      try {
        const { data: result, error: rpcError } = await supabase.rpc(
          "get_public_offer" as never,
          { offer_id: id } as never
        );

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
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Angebot wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <OfferHeader />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-serif font-bold mb-4">
            Angebot nicht gefunden
          </h1>
          <p className="text-muted-foreground mb-8">
            Dieses Angebot ist nicht verfügbar oder wurde noch nicht versendet.
          </p>
          <LocalizedLink
            to="home"
            className="text-primary hover:underline font-medium"
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
// ANSCHREIBEN SECTION — persönlicher Begleittext
// =================================================================

function AnschreibenSection({ emailContent }: { emailContent: string }) {
  // Trenne Signatur-Block ab (erkennt "Mit freundlichen Grüßen" o.ä.)
  const signatureSeparators = [
    "Mit freundlichen Grüßen",
    "Herzliche Grüße",
    "Beste Grüße",
    "Viele Grüße",
  ];

  let bodyText = emailContent;
  let signatureText = "";

  for (const sep of signatureSeparators) {
    const idx = emailContent.indexOf(sep);
    if (idx !== -1) {
      bodyText = emailContent.slice(0, idx).trimEnd();
      signatureText = emailContent.slice(idx);
      break;
    }
  }

  return (
    <section className="border-b border-border/40">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-2xl mx-auto">
          {/* Dekorativer Strich */}
          <div className="w-12 h-0.5 bg-primary/40 mb-8" />

          {/* Fließtext */}
          <div className="font-serif text-base md:text-lg leading-relaxed text-foreground/90 whitespace-pre-line">
            {bodyText}
          </div>

          {/* Signatur — etwas abgesetzt */}
          {signatureText && (
            <div className="mt-8 pt-6 border-t border-border/30">
              <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {signatureText}
              </div>
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

  const phaseLabels: Partial<Record<OfferPhase, { text: string; color: string }>> = {
    proposal_sent: { text: "Vorschlag", color: "bg-amber-100 text-amber-800" },
    customer_responded: { text: "Rückmeldung erhalten", color: "bg-blue-100 text-blue-800" },
    final_sent: { text: "Finales Angebot", color: "bg-emerald-100 text-emerald-800" },
    confirmed: { text: "Bestätigt", color: "bg-emerald-100 text-emerald-800" },
    paid: { text: "Bezahlt", color: "bg-emerald-100 text-emerald-800" },
  };

  const badge = phaseLabels[phase];

  return (
    <section className="border-b border-border bg-stone-50/50">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="flex items-center gap-3 mb-2">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            Ihr persönliches Angebot
          </p>
          {badge && (
            <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full", badge.color)}>
              {badge.text}
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-6">
          {displayName}
        </h1>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
          {inquiry.preferred_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM yyyy", { locale: de })}
              </span>
            </div>
          )}
          {inquiry.guest_count && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{inquiry.guest_count} Gäste</span>
            </div>
          )}
          {inquiry.event_type && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{inquiry.event_type}</span>
            </div>
          )}
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

      // Admin-Notification senden (fire-and-forget)
      supabase.functions.invoke("notify-customer-response", {
        body: { inquiryId: inquiry.id },
      }).catch(() => {});

      // E-Mail-Kopie senden (fire-and-forget)
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

      // Update parent state to show ThankYouView
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
    <section className="container mx-auto px-4 py-10 md:py-14">
      <div className="max-w-3xl mx-auto">
        <p className="text-muted-foreground mb-8">
          {isSingle
            ? "Wir haben folgenden Vorschlag für Sie zusammengestellt. Teilen Sie uns eventuelle Wünsche mit."
            : `Wir haben ${options.length} Optionen für Sie zusammengestellt. Bitte wählen Sie Ihren Favoriten und teilen Sie uns eventuelle Wünsche mit.`}
        </p>

        {/* Options als Auswahl-Cards */}
        <div className="space-y-4 mb-8">
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

        {/* Anmerkungen */}
        <div className="mb-6">
          <label className="text-sm font-medium text-foreground mb-2 block">
            <MessageSquare className="h-4 w-4 inline mr-1.5 text-muted-foreground" />
            Anmerkungen oder Sonderwünsche (optional)
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="z.B. Allergien, vegetarische Gäste, besondere Wünsche..."
            className="min-h-[120px] rounded-xl resize-y"
          />
        </div>

        {/* E-Mail-Kopie */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wantsCopy}
              onChange={(e) => setWantsCopy(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Kopie meiner Antwort per E-Mail an mich senden
            </span>
          </label>
          {wantsCopy && (
            <div className="mt-2 ml-6">
              <Input
                type="email"
                value={copyEmail}
                onChange={(e) => setCopyEmail(e.target.value)}
                placeholder="ihre@email.de"
                className="max-w-sm h-10 rounded-lg"
              />
            </div>
          )}
        </div>

        {submitError && (
          <p className="text-sm text-destructive mb-4">{submitError}</p>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!selectedOptionId || isSubmitting}
          className="w-full h-12 rounded-xl font-semibold gap-2 text-base bg-primary hover:bg-primary/90"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Auswahl bestätigen
        </Button>
      </div>
    </section>
  );
}

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
  const pricePerPerson =
    option.guest_count > 0 ? option.total_amount / option.guest_count : 0;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-2xl border-2 bg-card overflow-hidden transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-border hover:border-border/80 hover:shadow-sm"
      )}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {/* Radio-Indicator */}
          {!singleOption && (
            <div
              className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                isSelected ? "border-primary" : "border-muted-foreground/40"
              )}
            >
              {isSelected && (
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </div>
          )}
          <div>
            <h3 className="font-bold text-foreground">
              {singleOption
                ? option.package_name
                : `Option ${option.option_label}: ${option.package_name}`}
            </h3>
            <p className="text-xs text-muted-foreground">
              {option.guest_count} Gäste
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-primary">
            {pricePerPerson > 0
              ? formatCurrency(pricePerPerson)
              : formatCurrency(option.total_amount)}
          </p>
          {pricePerPerson > 0 && (
            <p className="text-xs text-muted-foreground">
              pro Person
            </p>
          )}
        </div>
      </div>

      {/* Menü-Vorschau im Speisekarten-Stil */}
      {courses.length > 0 && (
        <div className="px-6 pb-4 pt-0">
          <div className="space-y-1.5">
            {courses.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">
                  {c.courseLabel}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.itemName}
                </span>
              </div>
            ))}
            {courses.length > 5 && (
              <p className="text-xs text-muted-foreground/60 italic ml-[5.25rem]">
                +{courses.length - 5} weitere Gänge
              </p>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

// =================================================================
// THANK YOU VIEW — nach Kunden-Rückmeldung
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
    <section className="container mx-auto px-4 py-16 md:py-20">
      <div className="max-w-lg mx-auto text-center">
        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-bold mb-4">
          Vielen Dank für Ihre Rückmeldung!
        </h2>
        {selectedOption && (
          <p className="text-muted-foreground mb-2">
            Sie haben{" "}
            <strong className="text-foreground">
              {selectedOption.package_name}
            </strong>{" "}
            gewählt.
          </p>
        )}
        {customerResponse?.customer_notes && (
          <div className="bg-muted/30 rounded-xl p-4 mt-4 mb-6 text-left">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Ihre Anmerkung:
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {customerResponse.customer_notes}
            </p>
          </div>
        )}
        <p className="text-muted-foreground">
          Wir melden uns in Kürze mit dem finalen Angebot bei Ihnen.
        </p>
      </div>
    </section>
  );
}

// =================================================================
// FINAL OFFER VIEW — Finales Menü + Stripe-Zahlung
// =================================================================

function FinalOfferView({
  inquiry,
  options,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
}) {
  // Wenn Kunde eine Option gewählt hat, nur diese zeigen
  const selectedId = inquiry.selected_option_id;
  const displayOptions = selectedId
    ? options.filter((o) => o.id === selectedId)
    : options;

  return (
    <section className="container mx-auto px-4 py-10 md:py-14">
      {displayOptions.length > 1 && (
        <p className="text-muted-foreground mb-8 text-center md:text-left">
          Ihr finales Angebot mit {displayOptions.length} Optionen.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {displayOptions.map((option) => (
          <FinalOptionCard
            key={option.id}
            option={option}
            isSelected={inquiry.selected_option_id === option.id}
            singleOption={displayOptions.length === 1}
          />
        ))}
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
  const drinks =
    menu?.drinks?.filter((d) => d.selectedChoice || d.customDrink) || [];
  const pricePerPerson =
    option.guest_count > 0 ? option.total_amount / option.guest_count : 0;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm overflow-hidden transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-border/80 hover:shadow-md",
        singleOption && "max-w-xl mx-auto"
      )}
    >
      {/* Header */}
      <div className="bg-muted/30 px-6 py-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!singleOption && (
            <span className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              {option.option_label}
            </span>
          )}
          <div>
            <h3 className="font-bold text-foreground">{option.package_name}</h3>
            <p className="text-xs text-muted-foreground">
              {option.guest_count} Gäste
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">
            {pricePerPerson > 0
              ? formatCurrency(pricePerPerson)
              : formatCurrency(option.total_amount)}
          </p>
          {pricePerPerson > 0 && (
            <p className="text-xs text-muted-foreground">
              pro Person
            </p>
          )}
        </div>
      </div>

      {/* Menü-Details (Speisekarten-Stil) */}
      <div className="px-6 py-5 space-y-5">
        {courses.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Menü
              </h4>
            </div>
            <div className="space-y-3">
              {courses.map((course, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">
                    {course.courseLabel}
                  </span>
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {course.itemName}
                    </p>
                    {course.itemDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">
                        {course.itemDescription}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {drinks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wine className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Getränke
              </h4>
            </div>
            <div className="space-y-2">
              {drinks.map((drink, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-24 flex-shrink-0">
                    {drink.drinkLabel}
                  </span>
                  <p className="text-sm text-foreground">
                    {drink.customDrink || drink.selectedChoice}
                    {drink.quantityLabel && (
                      <span className="text-muted-foreground ml-1">
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
          <p className="text-sm text-muted-foreground italic py-2">
            Menüdetails werden noch zusammengestellt.
          </p>
        )}
      </div>

      {/* Payment Footer */}
      <div className="px-6 py-4 border-t border-border/50 bg-muted/20">
        {option.stripe_payment_link_url ? (
          <a
            href={option.stripe_payment_link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button className="w-full h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl">
              <CreditCard className="h-4 w-4" />
              {singleOption ? "Jetzt buchen" : `Option ${option.option_label} buchen`}
            </Button>
          </a>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Zahlungslink wird erstellt — wir melden uns bei Ihnen.
          </p>
        )}
      </div>
    </div>
  );
}

// =================================================================
// CONFIRMATION VIEW — Buchung bestätigt / bezahlt
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
      ? selectedOption.total_amount / selectedOption.guest_count
      : 0;

  return (
    <section className="container mx-auto px-4 py-16 md:py-20">
      <div className="max-w-lg mx-auto text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-bold mb-4">
          Buchung bestätigt!
        </h2>
        {selectedOption && (
          <p className="text-muted-foreground mb-6">
            <strong className="text-foreground">{selectedOption.package_name}</strong>
            {" "}für {selectedOption.guest_count} Gäste —{" "}
            {pricePerPerson > 0
              ? `${formatCurrency(pricePerPerson)} pro Person`
              : formatCurrency(selectedOption.total_amount)}
          </p>
        )}
        {inquiry.preferred_date && (
          <p className="text-lg font-medium text-foreground mb-2">
            {format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM yyyy", { locale: de })}
          </p>
        )}
        <p className="text-muted-foreground mt-6">
          Wir freuen uns auf Ihr Event! Bei Fragen erreichen Sie uns jederzeit.
        </p>
      </div>
    </section>
  );
}

// =================================================================
// CONTACT SECTION
// =================================================================

function ContactSection() {
  return (
    <section className="border-t border-border">
      <div className="container mx-auto px-4 py-10 md:py-14 text-center">
        <h2 className="text-xl font-serif font-semibold mb-3">
          Fragen zu Ihrem Angebot?
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Wir beraten Sie gerne persönlich und passen das Angebot an Ihre
          Wünsche an.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="tel:+498951519696">
            <Button variant="outline" className="gap-2">
              <Phone className="h-4 w-4" />
              +49 89 51519696
            </Button>
          </a>
          <a href="mailto:info@events-storia.de">
            <Button variant="outline" className="gap-2">
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
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <LocalizedLink
            to="home"
            className="font-serif text-[1.55rem] md:text-[1.95rem] font-bold hover:opacity-80 transition-opacity"
          >
            STORIA
          </LocalizedLink>
          <div className="flex items-center gap-2 md:gap-6 text-base text-foreground/80 font-medium">
            <a
              href="tel:+498951519696"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span className="hidden sm:inline">+49 89 51519696</span>
            </a>
            <a
              href="mailto:info@events-storia.de"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors"
            >
              <Mail className="h-5 w-5" />
              <span className="hidden sm:inline">info@events-storia.de</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function OfferFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-serif text-xl font-bold mb-1">STORIA</p>
            <p className="text-sm text-primary-foreground/70">
              Catering & Events | München
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-primary-foreground/70">
            <a
              href="tel:+498951519696"
              className="hover:text-primary-foreground transition-colors flex items-center gap-2"
            >
              <Phone className="h-4 w-4" />
              +49 89 51519696
            </a>
            <a
              href="mailto:info@events-storia.de"
              className="hover:text-primary-foreground transition-colors flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              info@events-storia.de
            </a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-primary-foreground/10 text-center text-xs text-primary-foreground/50">
          <p>&copy; {new Date().getFullYear()} STORIA Catering & Events</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <LocalizedLink
              to="legal.imprint"
              className="hover:text-primary-foreground/80 transition-colors"
            >
              Impressum
            </LocalizedLink>
            <LocalizedLink
              to="legal.privacy"
              className="hover:text-primary-foreground/80 transition-colors"
            >
              Datenschutz
            </LocalizedLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
