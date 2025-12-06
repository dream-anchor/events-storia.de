import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import EventPackageCard from "@/components/events/EventPackageCard";
import EventTestimonials from "@/components/events/EventTestimonials";
import EventContactForm from "@/components/events/EventContactForm";
import { Button } from "@/components/ui/button";
import { 
  Building2, Users, Wine, MapPin, ChefHat, Sparkles,
  PartyPopper, Briefcase, Heart, Calendar, Phone, ArrowDown,
  Check, Leaf, Music
} from "lucide-react";
import { useState, useRef } from "react";

import heroImg from "@/assets/menschen-aussen.jpeg";
import wineImg from "@/assets/weinservice.webp";

// Event Menus - Alle mit gleichen Leistungen, nur Gänge unterschiedlich
const eventPackages = [
  {
    id: "classic",
    name: "Classic",
    name_en: "Classic",
    price: "ab 42 € p.P.",
    price_en: "from €42 p.p.",
    description: "3-Gänge-Menü",
    description_en: "3-Course Menu",
    features: [
      "3 Gänge nach Wahl",
      "Individuelle Menükreation",
      "Persönliche Beratung",
      "Service-Personal inklusive",
      "Getränkeservice",
      "Tischdekoration auf Wunsch",
    ],
    features_en: [
      "3 courses of your choice",
      "Individual menu creation",
      "Personal consultation",
      "Service staff included",
      "Beverage service",
      "Table decoration on request",
    ],
    minGuests: 15,
  },
  {
    id: "premium",
    name: "Premium",
    name_en: "Premium",
    price: "ab 55 € p.P.",
    price_en: "from €55 p.p.",
    description: "4-Gänge-Menü mit Aperitif",
    description_en: "4-Course Menu with Aperitif",
    features: [
      "4 Gänge nach Wahl",
      "Aperitif mit Häppchen inklusive",
      "Individuelle Menükreation",
      "Persönliche Beratung",
      "Service-Personal inklusive",
      "Getränkeservice",
      "Tischdekoration auf Wunsch",
    ],
    features_en: [
      "4 courses of your choice",
      "Aperitif with canapés included",
      "Individual menu creation",
      "Personal consultation",
      "Service staff included",
      "Beverage service",
      "Table decoration on request",
    ],
    minGuests: 15,
  },
  {
    id: "exklusiv",
    name: "Flying Buffet Exklusiv",
    name_en: "Flying Buffet Exclusive",
    price: "auf Anfrage",
    price_en: "on request",
    description: "Individuelle Planung",
    description_en: "Custom Planning",
    features: [
      "Bis zu 9 Gänge fließend serviert",
      "Cocktail-Empfang inklusive",
      "Individuelle Menükreation",
      "Persönliche Beratung",
      "Service-Personal inklusive",
      "Tischdekoration auf Wunsch",
    ],
    features_en: [
      "Up to 9 courses served flowing",
      "Cocktail reception included",
      "Individual menu creation",
      "Personal consultation",
      "Service staff included",
      "Table decoration on request",
    ],
    minGuests: 15,
  },
];

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
  { icon: Building2, titleDe: "Location", titleEn: "Venue", descDe: "Bis zu 200 Gäste", descEn: "Up to 200 guests" },
  { icon: Users, titleDe: "Service-Personal", titleEn: "Service Staff", descDe: "Professionell & aufmerksam", descEn: "Professional & attentive" },
  { icon: Wine, titleDe: "Getränkeservice", titleEn: "Beverage Service", descDe: "Weinpairing möglich", descEn: "Wine pairing available" },
  { icon: MapPin, titleDe: "Zentrale Lage", titleEn: "Central Location", descDe: "Nähe Königsplatz & Pinakothek", descEn: "Near Königsplatz & Pinakothek" },
  { icon: ChefHat, titleDe: "Frische Küche", titleEn: "Fresh Cuisine", descDe: "Alles hausgemacht", descEn: "Everything homemade" },
  { icon: Sparkles, titleDe: "Tischdekoration", titleEn: "Table Decoration", descDe: "Auf Wunsch arrangiert", descEn: "Arranged on request" },
  { icon: Music, titleDe: "DJ-Pult", titleEn: "DJ Booth", descDe: "Auf Wunsch verfügbar", descEn: "Available on request" },
];

// Example Menus (from Festmenus)
const exampleMenus = {
  threeCourseDe: [
    { name: "Gegrillter Ziegenkäse", desc: "Feldsalat mit Waldhonig und Walnüssen" },
    { name: "Filet von der Dorade rosé", desc: "Auf Martini-Belugalinsen mit Zitronenöl" },
    { name: "Tonkabohnen Panna Cotta", desc: "Auf Orangencurd" },
  ],
  threeCoursEn: [
    { name: "Grilled Goat Cheese", desc: "Lamb's lettuce with forest honey and walnuts" },
    { name: "Sea Bream Fillet Rosé", desc: "On Martini Beluga lentils with lemon oil" },
    { name: "Tonka Bean Panna Cotta", desc: "On orange curd" },
  ],
  fourCourseDe: [
    { name: "Champagner-Kastaniencremesuppe", desc: "Mit getrüffeltem Crème Fraîche" },
    { name: "Zartes Entenbrust Carpaccio", desc: "Mit Orangencreme und karamellisierten Maronen" },
    { name: "Rinderfiletmedaillon", desc: "Auf getrüffeltem Petersilienwurzelpüree" },
    { name: "Schokoladenmousse Duett", desc: "Mit Granatapfel-Coulis" },
  ],
  fourCourseEn: [
    { name: "Champagne Chestnut Cream Soup", desc: "With truffled crème fraîche" },
    { name: "Tender Duck Breast Carpaccio", desc: "With orange cream and caramelized chestnuts" },
    { name: "Beef Fillet Medallion", desc: "On truffled parsley root purée" },
    { name: "Chocolate Mousse Duet", desc: "With pomegranate coulis" },
  ],
};

// USPs
const usps = [
  { titleDe: "Zentrale Lage", titleEn: "Central Location", descDe: "Nähe Königsplatz & Pinakothek", descEn: "Near Königsplatz & Pinakothek" },
  { titleDe: "Flexible Räumlichkeiten", titleEn: "Flexible Spaces", descDe: "Innen & überdachte Terrasse", descEn: "Indoor & covered terrace" },
  { titleDe: "Persönliche Betreuung", titleEn: "Personal Care", descDe: "Ein Ansprechpartner für alles", descEn: "One contact for everything" },
  { titleDe: "Authentische Küche", titleEn: "Authentic Cuisine", descDe: "Echte italienische Tradition", descEn: "Real Italian tradition" },
];

const EventsImStoria = () => {
  const { language } = useLanguage();
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = (packageId?: string) => {
    if (packageId) setSelectedPackage(packageId);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <SEO
        title={language === 'de' ? "Events & Firmenfeiern im STORIA Restaurant München" : "Events & Corporate Celebrations at STORIA Restaurant Munich"}
        description={language === 'de' 
          ? "Unvergessliche Firmenevents in München – Flying Buffet, Festmenüs, Weihnachtsfeiern. Bis zu 120 Gäste. Zentrale Lage. Jetzt anfragen!"
          : "Unforgettable corporate events in Munich – Flying Buffet, Set Menus, Christmas Parties. Up to 120 guests. Central location. Inquire now!"}
        canonical="/events"
      />
      <StructuredData type="event" />

      <Header />

      <main className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative h-[70vh] md:h-[80vh] overflow-hidden">
          <img
            src={heroImg}
            alt={language === 'de' ? "Events im STORIA Restaurant" : "Events at STORIA Restaurant"}
            className="w-full h-full object-cover"
          />
          {/* Multi-Layer Gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
          
          {/* Glassmorphism Text Container */}
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="text-center max-w-4xl backdrop-blur-md bg-black/30 rounded-2xl border border-white/10 px-8 py-10 md:px-12 md:py-14">
              <p className="text-sm md:text-base tracking-[0.3em] uppercase text-white/90 mb-4">
                {language === 'de' ? 'Events im Restaurant' : 'Events at Restaurant'}
              </p>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-medium mb-6 text-white">
                {language === 'de' 
                  ? "Unvergessliche Firmenevents im Herzen Münchens"
                  : "Unforgettable Corporate Events in the Heart of Munich"}
              </h1>
              <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
                {language === 'de'
                  ? "Authentische italienische Küche · Bis zu 200 Gäste · Nähe Königsplatz & Pinakothek"
                  : "Authentic Italian Cuisine · Up to 200 Guests · Near Königsplatz & Pinakothek"}
              </p>
              <Button 
                size="lg" 
                onClick={() => scrollToForm()}
                className="gap-2 text-base"
              >
                {language === 'de' ? 'Jetzt unverbindlich anfragen' : 'Request a Quote Now'}
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="py-6 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 text-center">
              <div>
                <span className="text-2xl md:text-3xl font-bold">100+</span>
                <p className="text-sm text-primary-foreground/80">{language === 'de' ? 'Events' : 'Events'}</p>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-bold">30+</span>
                <p className="text-sm text-primary-foreground/80">{language === 'de' ? 'Jahre Erfahrung' : 'Years Experience'}</p>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-bold">100</span>
                <p className="text-sm text-primary-foreground/80">{language === 'de' ? 'Gäste Innen' : 'Indoor Guests'}</p>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-bold">100</span>
                <p className="text-sm text-primary-foreground/80">{language === 'de' ? 'Überdachte Terrasse' : 'Covered Terrace'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Event Types */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
                {language === 'de' ? "Ihr Event – Ihre Vision – Unsere Expertise" : "Your Event – Your Vision – Our Expertise"}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
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
                    className="bg-card border border-border/50 rounded-xl p-5 md:p-6 text-center hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-medium text-sm md:text-base mb-1">
                      {language === 'de' ? type.titleDe : type.titleEn}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {language === 'de' ? type.descDe : type.descEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Event Menus */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
                {language === 'de' ? "Unsere Event-Menüs" : "Our Event Menus"}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {language === 'de'
                  ? "Wählen Sie das passende Menü für Ihren Anlass – oder lassen Sie sich individuell beraten."
                  : "Choose the right menu for your occasion – or get individual consultation."}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto items-start">
              {eventPackages.map((pkg) => (
                <EventPackageCard 
                  key={pkg.id} 
                  pkg={pkg} 
                  onSelect={scrollToForm}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Example Menus */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
                {language === 'de' ? "Beispielmenüs" : "Example Menus"}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {language === 'de'
                  ? "Alle Menüs werden individuell nach Ihren Wünschen und saisonalen Verfügbarkeiten angepasst."
                  : "All menus are individually tailored to your wishes and seasonal availability."}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* 3-Course Menu */}
              <div className="bg-card border border-border/50 rounded-xl p-6 md:p-8">
                <h3 className="font-serif text-xl font-medium text-center mb-6">
                  {language === 'de' ? '3-Gänge-Menü' : '3-Course Menu'}
                  <span className="block text-primary text-lg mt-1">ab 42 €</span>
                </h3>
                <div className="space-y-4">
                  {(language === 'de' ? exampleMenus.threeCourseDe : exampleMenus.threeCoursEn).map((course, index) => (
                    <div key={index} className="text-center">
                      <p className="font-medium">{course.name}</p>
                      <p className="text-sm text-muted-foreground">{course.desc}</p>
                      {index < 2 && <div className="text-primary/40 mt-3">✦</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4-Course Menu */}
              <div className="bg-card border border-primary/30 rounded-xl p-6 md:p-8 ring-2 ring-primary/10">
                <h3 className="font-serif text-xl font-medium text-center mb-6">
                  {language === 'de' ? '4-Gänge-Menü' : '4-Course Menu'}
                  <span className="block text-primary text-lg mt-1">ab 55 €</span>
                </h3>
                <div className="space-y-4">
                  {(language === 'de' ? exampleMenus.fourCourseDe : exampleMenus.fourCourseEn).map((course, index) => (
                    <div key={index} className="text-center">
                      <p className="font-medium">{course.name}</p>
                      <p className="text-sm text-muted-foreground">{course.desc}</p>
                      {index < 3 && <div className="text-primary/40 mt-3">✦</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground italic mt-8 max-w-2xl mx-auto">
              {language === 'de'
                ? "Vegetarische, vegane und allergenfreie Optionen sind selbstverständlich möglich."
                : "Vegetarian, vegan and allergen-free options are of course available."}
              <Leaf className="inline-block h-4 w-4 text-green-600 ml-2" />
            </p>
          </div>
        </section>

        {/* Included Services */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
                {language === 'de' ? "Bei uns inklusive" : "Included With Us"}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
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

        {/* Contact Form */}
        <div ref={formRef}>
          <EventContactForm preselectedPackage={selectedPackage} />
        </div>

        {/* Footer CTA */}
        <section className="py-12 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <p className="text-lg md:text-xl font-medium mb-6">
              {language === 'de' 
                ? "Sichern Sie sich jetzt Ihren Wunschtermin" 
                : "Secure your preferred date now"}
            </p>
            <Button 
              asChild 
              variant="secondary" 
              size="lg"
              className="gap-2"
            >
              <a href="tel:+498951519696">
                <Phone className="h-4 w-4" />
                +49 89 51519696
              </a>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default EventsImStoria;
