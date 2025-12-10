import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
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
  Check, Leaf, Music, Umbrella
} from "lucide-react";
import { useState, useRef } from "react";

import heroImg from "@/assets/menschen-aussen.jpeg";
import wineImg from "@/assets/weinservice.webp";
import terrasseImg from "@/assets/terrasse-blumen.webp";

// Event Gallery Images
import firmenfeierImg from "@/assets/events/firmenfeier.webp";
import geburtstagsfeierImg from "@/assets/events/geburtstagsfeier.webp";
import sommerfestImg from "@/assets/events/sommerfest.webp";
import weihnachtsfeierImg from "@/assets/events/weihnachtsfeier.webp";

// Event Menus - Alle mit gleichen Leistungen, nur Gänge unterschiedlich
const eventPackages = [
  {
    id: "classic",
    name: "3-Gang Menü",
    name_en: "3-Course Menu",
    price: "ab 42 € p.P.",
    price_en: "from €42 p.p.",
    description: "Klassisch & elegant",
    description_en: "Classic & elegant",
    features: [
      "3 Gänge nach Wahl",
      "Aperitif mit Häppchen inklusive",
      "Individuelle Menükreation",
      "Persönliche Beratung",
      "Service-Personal inklusive",
      "Weinpairing möglich",
      "Tischdekoration auf Wunsch",
    ],
    features_en: [
      "3 courses of your choice",
      "Aperitif with canapés included",
      "Individual menu creation",
      "Personal consultation",
      "Service staff included",
      "Wine pairing available",
      "Table decoration on request",
    ],
    minGuests: 6,
  },
  {
    id: "premium",
    name: "4-Gang Menü",
    name_en: "4-Course Menu",
    price: "ab 55 € p.P.",
    price_en: "from €55 p.p.",
    description: "Mit Aperitif",
    description_en: "With Aperitif",
    features: [
      "4 Gänge nach Wahl",
      "Aperitif mit Häppchen inklusive",
      "Individuelle Menükreation",
      "Persönliche Beratung",
      "Service-Personal inklusive",
      "Weinpairing möglich",
      "Tischdekoration auf Wunsch",
    ],
    features_en: [
      "4 courses of your choice",
      "Aperitif with canapés included",
      "Individual menu creation",
      "Personal consultation",
      "Service staff included",
      "Wine pairing available",
      "Table decoration on request",
    ],
    minGuests: 6,
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
      "Bis zu 18 Gänge fließend serviert",
      "Bis zu 150 Personen innen",
      "+ 150 Personen auf unserer überdachten Terrasse (bei warmen Temperaturen)",
      "Cocktail-Empfang inklusive",
      "Individuelle Menükreation",
      "Persönliche Beratung",
      "Service-Personal inklusive",
      "Tischdekoration auf Wunsch",
    ],
    features_en: [
      "Up to 18 courses served flowing",
      "Up to 150 guests indoors",
      "+ 150 guests on our covered terrace (in warm weather)",
      "Cocktail reception included",
      "Individual menu creation",
      "Personal consultation",
      "Service staff included",
      "Table decoration on request",
    ],
    minGuests: 6,
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
  { icon: Building2, titleDe: "Location", titleEn: "Venue", descDe: "Bis zu 100 Gäste innen", descEn: "Up to 100 guests indoors" },
  { icon: Umbrella, titleDe: "Überdachte Terrasse", titleEn: "Covered Terrace", descDe: "Bis zu 100 Gäste", descEn: "Up to 100 guests" },
  { icon: Users, titleDe: "Service-Personal", titleEn: "Service Staff", descDe: "Professionell & aufmerksam", descEn: "Professional & attentive" },
  { icon: Wine, titleDe: "Weinpairing", titleEn: "Wine Pairing", descDe: "Passend zu jedem Gang", descEn: "Paired with every course" },
  { icon: MapPin, titleDe: "Zentrale Lage", titleEn: "Central Location", descDe: "Nähe Königsplatz & Pinakothek", descEn: "Near Königsplatz & Pinakothek" },
  { icon: ChefHat, titleDe: "Cilento-Küche", titleEn: "Cilento Cuisine", descDe: "Aus dem UNESCO-Naturschutzgebiet", descEn: "From the UNESCO nature reserve" },
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
      <Navigation />

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
              
              {/* WhatsApp Quick Contact */}
              <p className="mt-4 text-white/70 text-sm">
                {language === 'de' ? 'oder direkt per' : 'or directly via'}
                <a 
                  href="https://wa.me/491636033912?text=Hallo%2C%20ich%20interessiere%20mich%20für%20ein%20Event%20im%20Storia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 hover:underline ml-1 inline-flex items-center gap-1"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp →
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="py-6 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 text-center">
              <div>
                <span className="text-2xl md:text-3xl font-bold">100+</span>
                <p className="text-sm text-primary-foreground/80">{language === 'de' ? 'Erfolgreiche Events' : 'Successful Events'}</p>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-bold">30+</span>
                <p className="text-sm text-primary-foreground/80">{language === 'de' ? 'Jahre Familientradition' : 'Years Family Tradition'}</p>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-bold">100</span>
                <p className="text-sm text-primary-foreground/80">{language === 'de' ? 'Gäste im Restaurant' : 'Guests Indoors'}</p>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-bold">100</span>
                <p className="text-sm text-primary-foreground/80">{language === 'de' ? 'Gäste auf Terrasse' : 'Guests on Terrace'}</p>
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
              <p className="text-sm text-primary font-medium mt-3">
                {language === 'de' 
                  ? 'Alle Menüs ab 6 Personen buchbar'
                  : 'All menus available from 6 guests'}
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
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
                {language === 'de' ? "Willkommen im Storia" : "Welcome to Storia"}
              </h2>
            </div>
            
            {/* Event Gallery - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-4xl mx-auto mb-12">
              <img 
                src={firmenfeierImg} 
                alt={language === 'de' ? "Firmenfeier im STORIA" : "Corporate event at STORIA"}
                className="w-full h-40 md:h-56 object-cover rounded-xl shadow-lg"
              />
              <img 
                src={geburtstagsfeierImg} 
                alt={language === 'de' ? "Geburtstagsfeier im STORIA" : "Birthday celebration at STORIA"}
                className="w-full h-40 md:h-56 object-cover rounded-xl shadow-lg"
              />
              <img 
                src={sommerfestImg} 
                alt={language === 'de' ? "Sommerfest im STORIA" : "Summer party at STORIA"}
                className="w-full h-40 md:h-56 object-cover rounded-xl shadow-lg"
              />
              <img 
                src={weihnachtsfeierImg} 
                alt={language === 'de' ? "Weihnachtsfeier im STORIA" : "Christmas party at STORIA"}
                className="w-full h-40 md:h-56 object-cover rounded-xl shadow-lg"
              />
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

        {/* Alternative CTA */}
        <section className="py-10 bg-background">
          <div className="container mx-auto px-4 text-center">
            {/* Divider with "oder" */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px w-16 bg-border"></div>
              <span className="text-muted-foreground text-sm uppercase tracking-wider">
                {language === 'de' ? 'oder' : 'or'}
              </span>
              <div className="h-px w-16 bg-border"></div>
            </div>
            
            {/* Inviting text */}
            <p className="text-lg text-muted-foreground mb-4">
              {language === 'de' 
                ? "Lieber persönlich? Rufen Sie uns gerne an" 
                : "Prefer a personal touch? Give us a call"}
            </p>
            
            {/* Contact options */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              {/* Phone */}
              <a 
                href="tel:+491636033912"
                className="inline-flex items-center gap-2 text-xl md:text-2xl font-serif text-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-5 w-5" />
                +49 163 6033912
              </a>
              
              {/* WhatsApp */}
              <a 
                href="https://wa.me/491636033912?text=Hallo%2C%20ich%20interessiere%20mich%20für%20ein%20Event%20im%20Storia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-lg text-foreground hover:text-green-600 transition-colors"
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
    </>
  );
};

export default EventsImStoria;
