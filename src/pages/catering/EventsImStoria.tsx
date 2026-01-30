import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import EventPackageShopCard from "@/components/events/EventPackageShopCard";
import EventTestimonials from "@/components/events/EventTestimonials";
import EventContactForm from "@/components/events/EventContactForm";
import ConsentElfsightReviews from "@/components/ConsentElfsightReviews";
import { useEventPackages } from "@/hooks/useEventPackages";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, Users, Wine, MapPin, ChefHat, Sparkles,
  PartyPopper, Briefcase, Heart, Calendar, Phone, ArrowDown,
  Check, Leaf, Music, Umbrella, ShoppingCart, CreditCard, Clock
} from "lucide-react";
import { useState, useRef } from "react";

import heroImg from "@/assets/events/firmenfeier-2.webp";

// Event Gallery Images
import firmenfeierImg from "@/assets/events/firmenfeier.webp";
import geburtstagsfeierImg from "@/assets/events/geburtstagsfeier.webp";
import sommerfestImg from "@/assets/events/sommerfest.webp";
import weihnachtsfeierImg from "@/assets/events/weihnachtsfeier.webp";

// Event Types
const eventTypes = [
  { 
    icon: PartyPopper, 
    titleDe: "Weihnachtsfeiern", 
    titleEn: "Christmas Parties",
    descDe: "Festliche Atmosphäre für Ihr Team",
    descEn: "Festive atmosphere for your team"
  },
  { 
    icon: Briefcase, 
    titleDe: "Team-Events & Firmenfeiern", 
    titleEn: "Team Events & Corporate",
    descDe: "Von Sommerfest bis Jubiläum",
    descEn: "From summer party to anniversary"
  },
  { 
    icon: Users, 
    titleDe: "Business-Dinner", 
    titleEn: "Business Dinners",
    descDe: "Beeindrucken Sie Ihre Kunden",
    descEn: "Impress your clients"
  },
  { 
    icon: Heart, 
    titleDe: "Private Feiern", 
    titleEn: "Private Celebrations",
    descDe: "Geburtstage & besondere Anlässe",
    descEn: "Birthdays & special occasions"
  },
];

// Included Services
const includedServices = [
  { icon: Building2, titleDe: "Location", titleEn: "Venue", descDe: "Bis zu 180 Gäste", descEn: "Up to 180 guests" },
  { icon: Umbrella, titleDe: "Überdachte Terrasse", titleEn: "Covered Terrace", descDe: "Bis zu 100 Gäste", descEn: "Up to 100 guests" },
  { icon: Users, titleDe: "Service-Personal", titleEn: "Service Staff", descDe: "Professionell & aufmerksam", descEn: "Professional & attentive" },
  { icon: Wine, titleDe: "Getränke & Weine", titleEn: "Drinks & Wines", descDe: "Passend zu jedem Gang", descEn: "Paired with every course" },
  { icon: MapPin, titleDe: "Zentrale Lage", titleEn: "Central Location", descDe: "Nähe Königsplatz", descEn: "Near Königsplatz" },
  { icon: ChefHat, titleDe: "Cilento-Küche", titleEn: "Cilento Cuisine", descDe: "Aus dem UNESCO-Naturschutzgebiet", descEn: "From the UNESCO nature reserve" },
  { icon: Sparkles, titleDe: "Tischdekoration", titleEn: "Table Decoration", descDe: "Auf Wunsch arrangiert", descEn: "Arranged on request" },
  { icon: Music, titleDe: "DJ-Pult", titleEn: "DJ Booth", descDe: "Auf Wunsch verfügbar", descEn: "Available on request" },
];

// USPs
const usps = [
  { titleDe: "Zentrale Lage", titleEn: "Central Location", descDe: "Nähe Königsplatz & Pinakothek", descEn: "Near Königsplatz & Pinakothek" },
  { titleDe: "Flexible Räumlichkeiten", titleEn: "Flexible Spaces", descDe: "Innen & überdachte Terrasse", descEn: "Indoor & covered terrace" },
  { titleDe: "Persönliche Betreuung", titleEn: "Personal Care", descDe: "Ein Ansprechpartner für alles", descEn: "One contact for everything" },
  { titleDe: "Authentische Küche", titleEn: "Authentic Cuisine", descDe: "Echte italienische Tradition", descEn: "Real Italian tradition" },
];

// Process Steps
const processSteps = [
  { icon: ShoppingCart, titleDe: "Paket wählen", titleEn: "Choose Package", descDe: "Wählen Sie Ihr Wunschpaket", descEn: "Select your desired package" },
  { icon: Users, titleDe: "Gäste angeben", titleEn: "Add Guests", descDe: "Anzahl der Gäste festlegen", descEn: "Specify number of guests" },
  { icon: CreditCard, titleDe: "Buchen", titleEn: "Book", descDe: "100% Anzahlung sichern", descEn: "Secure with 100% deposit" },
  { icon: Calendar, titleDe: "Genießen", titleEn: "Enjoy", descDe: "Wir kümmern uns um alles", descEn: "We take care of everything" },
];

const EventsImStoria = () => {
  const { language } = useLanguage();
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const formRef = useRef<HTMLDivElement>(null);

  const { data: packages, isLoading: packagesLoading } = useEventPackages();
  const { showGross, setShowGross } = usePriceDisplay();

  const scrollToForm = (packageId?: string) => {
    if (packageId) setSelectedPackage(packageId);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPackages = () => {
    document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <SEO
        title={language === 'de' ? "Events & Firmenfeiern im STORIA Restaurant München" : "Events & Corporate Celebrations at STORIA Restaurant Munich"}
        description={language === 'de' 
          ? "Firmenfeiern, Weihnachtsfeiern & private Events im STORIA München: Business Dinner, Network-Aperitivo, Full Location Buyout. Jetzt online buchen!"
          : "Corporate events, Christmas parties & private events at STORIA Munich: Business Dinner, Network Aperitivo, Full Location Buyout. Book online now!"}
        canonical="/events"
      />
      <StructuredData type="event" />

      <Header />
      <Navigation />
      <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1">
        {/* Hero Section - Modern Glassmorphism */}
        <section className="relative h-[85vh] md:h-[90vh] overflow-hidden">
          <img
            src={heroImg}
            alt={language === 'de' ? "Events im STORIA Restaurant München" : "Events at STORIA Restaurant Munich"}
            className="w-full h-full object-cover"
            width="1920"
            height="1080"
            fetchPriority="high"
          />
          {/* Multi-Layer Gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,0,0,0.7)_0%,_transparent_70%)]" />
          
          {/* Content */}
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="text-center max-w-4xl">
              <Badge variant="secondary" className="mb-6 text-xs tracking-widest uppercase px-4 py-1.5">
                {language === 'de' ? 'Events im Restaurant' : 'Events at Restaurant'}
              </Badge>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-medium mb-6 text-white leading-tight">
                {language === 'de' 
                  ? <>Unvergessliche<br />Firmenevents</>
                  : <>Unforgettable<br />Corporate Events</>}
              </h1>
              
              <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
                {language === 'de'
                  ? "Business Dinner · Network-Aperitivo · Full Location Buyout"
                  : "Business Dinner · Network Aperitivo · Full Location Buyout"}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  onClick={scrollToPackages}
                  className="gap-2 text-base px-8"
                >
                  <span className="animate-pulse">
                    {language === 'de' ? 'Pakete entdecken' : 'Discover Packages'}
                  </span>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => scrollToForm()}
                  className="gap-2 text-base px-8 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                >
                  {language === 'de' ? 'Individuelle Anfrage' : 'Custom Inquiry'}
                </Button>
              </div>
            </div>
          </div>

        {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ArrowDown className="h-6 w-6 text-white/60" />
          </div>
        </section>

        {/* Event Pricing Cards removed - using shop cards with images instead */}

        {/* Trust Bar - Stats */}
        <section className="py-8 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-center">
              <div>
                <span className="text-3xl md:text-4xl font-bold">100+</span>
                <p className="text-base text-primary-foreground/80">{language === 'de' ? 'Events pro Jahr' : 'Events per Year'}</p>
              </div>
              <div>
                <span className="text-3xl md:text-4xl font-bold">30+</span>
                <p className="text-base text-primary-foreground/80">{language === 'de' ? 'Jahre Erfahrung' : 'Years Experience'}</p>
              </div>
              <div>
                <span className="text-3xl md:text-4xl font-bold">180</span>
                <p className="text-base text-primary-foreground/80">{language === 'de' ? 'Max. Gäste' : 'Max. Guests'}</p>
              </div>
              <div>
                <span className="text-3xl md:text-4xl font-bold">100%</span>
                <p className="text-base text-primary-foreground/80">{language === 'de' ? 'Zufriedenheit' : 'Satisfaction'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Process Steps - How it works */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-serif font-medium mb-2">
                {language === 'de' ? "So einfach geht's" : "How It Works"}
              </h2>
              <p className="text-lg text-muted-foreground">
                {language === 'de' ? "In 4 Schritten zu Ihrem Event" : "4 steps to your event"}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {processSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={index} className="text-center">
                    <div className="relative inline-flex">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="font-medium text-lg mb-1">
                      {language === 'de' ? step.titleDe : step.titleEn}
                    </h3>
                    <p className="text-base text-muted-foreground">
                      {language === 'de' ? step.descDe : step.descEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Event Types */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-medium mb-4">
                {language === 'de' ? "Ihr Event – Ihre Vision" : "Your Event – Your Vision"}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {language === 'de'
                  ? "Ob Firmenfeier, Team-Event oder privater Anlass – wir machen Ihren Event unvergesslich."
                  : "Whether corporate celebration, team event or private occasion – we make your event unforgettable."}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
              {eventTypes.map((type, index) => {
                const Icon = type.icon;
                return (
                  <div 
                    key={index}
                    className="bg-card border border-border/50 rounded-xl p-5 md:p-6 text-center hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer"
                    onClick={scrollToPackages}
                  >
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-medium text-xl mb-1">
                      {language === 'de' ? type.titleDe : type.titleEn}
                    </h3>
                    <p className="text-base text-muted-foreground">
                      {language === 'de' ? type.descDe : type.descEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Packages & Locations - Shop Section */}
        <section id="packages" className="py-16 md:py-24 bg-gradient-to-b from-muted/50 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 px-4 py-1.5 text-sm">
                {language === 'de' ? 'Jetzt online buchen' : 'Book Online Now'}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-serif font-medium mb-4">
                {language === 'de' ? "Unsere Event-Pakete" : "Our Event Packages"}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {language === 'de'
                  ? "Wählen Sie das passende Paket für Ihren Anlass und buchen Sie direkt online."
                  : "Choose the right package for your occasion and book directly online."}
              </p>
            </div>

            <div className="max-w-6xl mx-auto">
                {/* Brutto/Netto Toggle */}
                <div className="flex items-center justify-center gap-3 mb-8">
                  <Label 
                    htmlFor="price-toggle-events" 
                    className={`text-base cursor-pointer transition-colors ${!showGross ? "text-primary font-medium" : "text-muted-foreground"}`}
                  >
                    {language === 'de' ? 'Netto' : 'Net'}
                  </Label>
                  <Switch
                    id="price-toggle-events"
                    checked={showGross}
                    onCheckedChange={setShowGross}
                  />
                  <Label 
                    htmlFor="price-toggle-events" 
                    className={`text-base cursor-pointer transition-colors ${showGross ? "text-primary font-medium" : "text-muted-foreground"}`}
                  >
                    {language === 'de' ? 'Brutto' : 'Gross'}
                  </Label>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({language === 'de' ? '70% Speisen 7% · 30% Getränke 19%' : '70% food 7% · 30% drinks 19%'})
                  </span>
                </div>

                {packagesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-[500px] rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch">
                    {packages?.map((pkg, idx) => (
                      <EventPackageShopCard 
                        key={pkg.id} 
                        pkg={pkg} 
                        featured={idx === 1}
                      />
                    ))}
                  </div>
                )}

                {/* Consultation Note */}
                <div className="text-center mt-10 max-w-2xl mx-auto">
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {language === 'de' 
                      ? 'Gerne können Sie weitere Gänge und Getränke-Pakete dazubuchen. Gerne beraten wir Sie individuell telefonisch oder per E-Mail. Kontaktieren Sie uns einfach. Wir freuen uns auf Sie.'
                      : 'You are welcome to book additional courses and beverage packages. We are happy to advise you individually by phone or email. Simply contact us. We look forward to hearing from you.'}
                  </p>
                </div>

                {/* Trust Note */}
                <div className="mt-8 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
                    <Clock className="h-4 w-4" />
                    {language === 'de' 
                      ? '100% Anzahlung · Keine versteckten Kosten · Kostenlose Stornierung bis 14 Tage vorher'
                      : '100% Deposit · No hidden costs · Free cancellation up to 14 days before'}
                  </div>
                </div>
            </div>
          </div>
        </section>

        {/* Event Gallery */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
                {language === 'de' ? "Impressionen" : "Impressions"}
              </h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-5xl mx-auto">
              <img 
                src={firmenfeierImg} 
                alt={language === 'de' ? "Firmenfeier im STORIA München" : "Corporate event at STORIA Munich"}
                className="w-full h-40 md:h-56 object-cover rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                width="400"
                height="224"
                loading="lazy"
              />
              <img 
                src={geburtstagsfeierImg} 
                alt={language === 'de' ? "Geburtstagsfeier im STORIA München" : "Birthday celebration at STORIA Munich"}
                className="w-full h-40 md:h-56 object-cover rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                width="400"
                height="224"
                loading="lazy"
              />
              <img 
                src={sommerfestImg} 
                alt={language === 'de' ? "Sommerfest im STORIA München" : "Summer party at STORIA Munich"}
                className="w-full h-40 md:h-56 object-cover rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                width="400"
                height="224"
                loading="lazy"
              />
              <img 
                src={weihnachtsfeierImg} 
                alt={language === 'de' ? "Weihnachtsfeier im STORIA München" : "Christmas party at STORIA Munich"}
                className="w-full h-40 md:h-56 object-cover rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                width="400"
                height="224"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        {/* Included Services */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
                {language === 'de' ? "Alles inklusive" : "Everything Included"}
              </h2>
              <p className="text-muted-foreground">
                {language === 'de' 
                  ? "Bei jedem Paket enthalten – keine versteckten Kosten"
                  : "Included with every package – no hidden costs"}
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
              {includedServices.map((service, index) => {
                const Icon = service.icon;
                return (
                  <div 
                    key={index}
                    className="bg-card border border-border/50 rounded-lg p-4 md:p-5 text-center"
                  >
                    <Icon className="h-6 w-6 mx-auto mb-3 text-primary" />
                    <h3 className="font-medium text-sm mb-1">
                      {language === 'de' ? service.titleDe : service.titleEn}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {language === 'de' ? service.descDe : service.descEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <EventTestimonials />

        {/* USPs */}
        <section className="py-16 md:py-20 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-primary text-sm font-medium tracking-widest uppercase mb-2 block">
                {language === 'de' ? 'Ihre Vorteile' : 'Your Benefits'}
              </span>
              <h2 className="text-3xl md:text-4xl font-serif font-medium">
                {language === 'de' ? "Warum STORIA?" : "Why STORIA?"}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {usps.map((usp, index) => (
                <div 
                  key={index}
                  className="text-center p-6 bg-card border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-medium text-base mb-2">
                    {language === 'de' ? usp.titleDe : usp.titleEn}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === 'de' ? usp.descDe : usp.descEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dietary Options Note */}
        <section className="py-8">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-muted-foreground italic flex items-center justify-center gap-2">
              <Leaf className="h-4 w-4 text-primary" />
              {language === 'de'
                ? "Alle Menüs sind auch vegetarisch, vegan und allergenfreundlich verfügbar."
                : "All menus are also available vegetarian, vegan and allergen-friendly."}
            </p>
          </div>
        </section>

        {/* External Reviews */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <ConsentElfsightReviews />
          </div>
        </section>

        {/* Contact Form for Custom Inquiries */}
        <div id="contact" ref={formRef}>
          <EventContactForm preselectedPackage={selectedPackage} />
        </div>

        {/* Alternative CTA */}
        <section className="py-10 bg-background">
          <div className="container mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px w-16 bg-border"></div>
              <span className="text-muted-foreground text-sm uppercase tracking-wider">
                {language === 'de' ? 'oder' : 'or'}
              </span>
              <div className="h-px w-16 bg-border"></div>
            </div>
            
            <p className="text-lg text-muted-foreground mb-4">
              {language === 'de' 
                ? "Lieber persönlich? Rufen Sie uns gerne an" 
                : "Prefer a personal touch? Give us a call"}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <a 
                href="tel:+498951519696"
                className="inline-flex items-center gap-2 text-xl md:text-2xl font-serif text-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-5 w-5" />
                +49 89 51519696
              </a>
              
              <a 
                href="https://wa.me/491636033912?text=Hallo%2C%20ich%20interessiere%20mich%20für%20ein%20Event%20im%20Storia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-lg text-foreground hover:text-primary transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      </div>
    </>
  );
};

export default EventsImStoria;
