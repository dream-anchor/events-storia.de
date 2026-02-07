import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Types for the RPC response
interface PublicInquiry {
  id: string;
  company_name: string | null;
  contact_name: string;
  event_type: string | null;
  preferred_date: string | null;
  guest_count: string | null;
  status: string;
  selected_option_id: string | null;
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
  guest_count: number;
  menu_selection: MenuSelection | null;
  total_amount: number;
  stripe_payment_link_url: string | null;
  package_name: string;
  sort_order: number;
}

interface PublicOfferData {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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
          "get_public_offer",
          { offer_id: id }
        );

        if (rpcError || !result || !result.inquiry) {
          setError(true);
        } else {
          setData(result as PublicOfferData);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchOffer();
  }, [id]);

  // Loading state
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

  // Error / not found
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
          <Link to="/" className="text-primary hover:underline font-medium">
            Zur Startseite
          </Link>
        </div>
        <OfferFooter />
      </div>
    );
  }

  const { inquiry, options } = data;
  const displayName = inquiry.company_name || inquiry.contact_name;
  const isConfirmed = inquiry.status === "confirmed";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfferHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border">
          <div className="container mx-auto px-4 py-10 md:py-14">
            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">
              Ihr persönliches Angebot
            </p>
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

            {isConfirmed && (
              <div className="mt-6 inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-4 py-2 rounded-lg text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Angebot bestätigt
              </div>
            )}
          </div>
        </section>

        {/* Offer Options */}
        <section className="container mx-auto px-4 py-10 md:py-14">
          {options.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Noch keine Angebotsoptionen verfügbar.
            </p>
          ) : (
            <>
              {options.length > 1 && (
                <p className="text-muted-foreground mb-8 text-center md:text-left">
                  Wir haben {options.length} Optionen für Sie zusammengestellt.
                  Wählen Sie das Paket, das am besten zu Ihrem Event passt.
                </p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {options.map((option) => (
                  <OfferOptionCard
                    key={option.id}
                    option={option}
                    isSelected={inquiry.selected_option_id === option.id}
                    singleOption={options.length === 1}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Contact CTA */}
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
      </main>

      <OfferFooter />
    </div>
  );
}

// --- Sub-Components ---

function OfferHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="font-serif text-[1.55rem] md:text-[1.95rem] font-bold hover:opacity-80 transition-opacity"
          >
            STORIA
          </Link>
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
            <a href="tel:+498951519696" className="hover:text-primary-foreground transition-colors flex items-center gap-2">
              <Phone className="h-4 w-4" />
              +49 89 51519696
            </a>
            <a href="mailto:info@events-storia.de" className="hover:text-primary-foreground transition-colors flex items-center gap-2">
              <Mail className="h-4 w-4" />
              info@events-storia.de
            </a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-primary-foreground/10 text-center text-xs text-primary-foreground/50">
          <p>&copy; {new Date().getFullYear()} STORIA Catering & Events</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link to="/impressum" className="hover:text-primary-foreground/80 transition-colors">
              Impressum
            </Link>
            <Link to="/datenschutz" className="hover:text-primary-foreground/80 transition-colors">
              Datenschutz
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

interface OfferOptionCardProps {
  option: PublicOfferOption;
  isSelected: boolean;
  singleOption: boolean;
}

function OfferOptionCard({ option, isSelected, singleOption }: OfferOptionCardProps) {
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  const drinks = menu?.drinks?.filter((d) => d.selectedChoice || d.customDrink) || [];
  const pricePerPerson = option.guest_count > 0
    ? option.total_amount / option.guest_count
    : 0;

  return (
    <div
      className={`rounded-2xl border bg-card shadow-sm overflow-hidden transition-all ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-border/80 hover:shadow-md"
      }`}
    >
      {/* Card Header */}
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
            {formatCurrency(option.total_amount)}
          </p>
          {pricePerPerson > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(pricePerPerson)} pro Person
            </p>
          )}
        </div>
      </div>

      {/* Menu Section */}
      <div className="px-6 py-5 space-y-5">
        {/* Courses */}
        {courses.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Menü
              </h4>
            </div>
            <div className="space-y-2.5">
              {courses.map((course, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">
                    {course.courseLabel}
                  </span>
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {course.itemName}
                    </p>
                    {course.itemDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {course.itemDescription}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drinks */}
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
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-20 flex-shrink-0">
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

        {/* No menu configured */}
        {courses.length === 0 && drinks.length === 0 && (
          <p className="text-sm text-muted-foreground italic py-2">
            Menüdetails werden noch zusammengestellt.
          </p>
        )}
      </div>

      {/* Payment / Selection Footer */}
      <div className="px-6 py-4 border-t border-border/50 bg-muted/20">
        {isSelected ? (
          <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-5 w-5" />
            <span>Ausgewählt</span>
          </div>
        ) : option.stripe_payment_link_url ? (
          <a
            href={option.stripe_payment_link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <CreditCard className="h-4 w-4" />
              Option {option.option_label} buchen
            </Button>
          </a>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Kontaktieren Sie uns zur Buchung
          </p>
        )}
      </div>
    </div>
  );
}
