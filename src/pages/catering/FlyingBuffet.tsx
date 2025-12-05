import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import CateringCTA from "@/components/CateringCTA";
import { Building2, Users, Wine, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

import heroImg from "@/assets/catering/flying-buffet/hero.webp";

interface MenuCourse {
  type: "welcome" | "starter" | "primo" | "secondo" | "dolce";
  name: string;
  name_en: string;
  description?: string;
  description_en?: string;
  items?: string[];
  items_en?: string[];
}

const menuCourses: MenuCourse[] = [
  {
    type: "welcome",
    name: "Gruß aus der Küche & Bar",
    name_en: "Kitchen & Bar Greeting",
    items: [
      "Grissini STORIA, Olive di Cerignola & Blinis mit hausgebeiztem Lachs",
      "Cocktail: Elder Fizz – Gin, Holunder, Zitrone & Soda"
    ],
    items_en: [
      "Grissini STORIA, Olive di Cerignola & Blinis with house-cured salmon",
      "Cocktail: Elder Fizz – Gin, Elderflower, Lemon & Soda"
    ]
  },
  {
    type: "starter",
    name: "Zuppa di Zucca",
    name_en: "Pumpkin Soup",
    description: "Kürbiscreme mit Burrata, Walnüsse und aromatische Kräuter",
    description_en: "Pumpkin cream with Burrata, walnuts and aromatic herbs"
  },
  {
    type: "starter",
    name: "Insalata di Polpo",
    name_en: "Octopus Salad",
    description: "Oktopussalat mit Zitronenessenz und Estragon",
    description_en: "Octopus salad with lemon essence and tarragon"
  },
  {
    type: "starter",
    name: "Vitello Tonnato",
    name_en: "Vitello Tonnato",
    description: "Zart gegartes rosa Kalbfleisch in Scheiben, serviert mit unserer hausgemachten Thunfisch-Kapern-Sauce",
    description_en: "Tender pink veal slices served with our homemade tuna-caper sauce"
  },
  {
    type: "starter",
    name: "Carpaccio d'anatra",
    name_en: "Duck Carpaccio",
    description: "Zartes Carpaccio von Entenbrust mit feinem Orangenaroma und karamellisierten Maronen",
    description_en: "Delicate duck breast carpaccio with fine orange aroma and caramelized chestnuts"
  },
  {
    type: "primo",
    name: "Ravioli al Tartufo",
    name_en: "Truffle Ravioli",
    description: "Hausgemachte Ravioli gefüllt mit Ricotta, verfeinert mit frischem Trüffel",
    description_en: "Homemade ravioli filled with ricotta, refined with fresh truffle"
  },
  {
    type: "secondo",
    name: "Filetto di Orata rosè",
    name_en: "Sea Bream Fillet Rosé",
    description: "Filet von der Dorade rosè auf Martini-Bellugalinsen mit confierten Kirschtomaten & Zitronenöl",
    description_en: "Sea bream fillet rosé on Martini-Beluga lentils with confit cherry tomatoes & lemon oil"
  },
  {
    type: "secondo",
    name: "Tagliata di Manzo",
    name_en: "Sliced Beef Tagliata",
    description: "Feine Scheiben vom bayerischen dry age Rib-eye auf Rucola & Parmigiano 22 Monate",
    description_en: "Fine slices of Bavarian dry-aged rib-eye on arugula & 22-month Parmigiano"
  },
  {
    type: "dolce",
    name: "Tortino al Limone di Amalfi",
    name_en: "Amalfi Lemon Tart",
    description: "Zitronentörtchen aus Amalfi mit Waldbeerencreme",
    description_en: "Amalfi lemon tart with wild berry cream"
  }
];

const eventServices = [
  {
    icon: Building2,
    titleDe: "Location",
    titleEn: "Location",
    subtitleDe: "Bis zu 120 Gäste",
    subtitleEn: "Up to 120 guests"
  },
  {
    icon: Users,
    titleDe: "Service",
    titleEn: "Service",
    subtitleDe: "Personal inklusive",
    subtitleEn: "Staff included"
  },
  {
    icon: Wine,
    titleDe: "Getränke",
    titleEn: "Beverages",
    subtitleDe: "Weinpairing möglich",
    subtitleEn: "Wine pairing available"
  }
];

const getCourseTypeLabel = (type: string, language: string): string => {
  const labels: Record<string, { de: string; en: string }> = {
    welcome: { de: "Aperitivo", en: "Aperitivo" },
    starter: { de: "Antipasti", en: "Starters" },
    primo: { de: "Primi Piatti", en: "First Courses" },
    secondo: { de: "Secondi Piatti", en: "Main Courses" },
    dolce: { de: "Dolci", en: "Desserts" }
  };
  return labels[type]?.[language as "de" | "en"] || type;
};

const FlyingBuffet = () => {
  const { language } = useLanguage();

  // Group courses by type
  const groupedCourses = menuCourses.reduce((acc, course) => {
    if (!acc[course.type]) {
      acc[course.type] = [];
    }
    acc[course.type].push(course);
    return acc;
  }, {} as Record<string, MenuCourse[]>);

  const courseOrder = ["welcome", "starter", "primo", "secondo", "dolce"];

  return (
    <>
      <SEO
        title={language === 'de' ? "Flying Buffet & Events im Restaurant" : "Flying Buffet & Events at the Restaurant"}
        description={language === 'de' 
          ? "Veranstaltungen im STORIA Restaurant München – Flying Buffet, individuelle Menüs für Firmenfeiern, Hochzeiten und private Events."
          : "Events at STORIA Restaurant Munich – Flying Buffet, custom menus for corporate events, weddings and private celebrations."}
        canonical="/catering/flying-buffet"
      />
      <StructuredData type="restaurant" />

      <Header />

      <main className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative h-[50vh] md:h-[60vh] overflow-hidden">
          <img
            src={heroImg}
            alt={language === 'de' ? "Flying Buffet Event" : "Flying Buffet Event"}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <h1 className="text-3xl md:text-5xl font-serif font-medium mb-4">
                Flying Buffet & Events
              </h1>
              <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
                {language === 'de' 
                  ? "Veranstaltungen im Restaurant – Flexibel, Authentisch und Genussvoll"
                  : "Events at the Restaurant – Flexible, Authentic and Delightful"}
              </p>
            </div>
          </div>
        </section>

        {/* Introduction */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              {language === 'de'
                ? "Genießen Sie die traditionelle italienische Küche mit unseren frisch zubereiteten Flying Buffet Menüs. Perfekt für Firmenfeiern, Hochzeiten, Geburtstage und besondere Anlässe – direkt in unserem stilvollen Restaurant."
                : "Enjoy traditional Italian cuisine with our freshly prepared Flying Buffet menus. Perfect for corporate events, weddings, birthdays and special occasions – right in our stylish restaurant."}
            </p>
          </div>
        </section>

        {/* Menu Card */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              {/* Menu Header */}
              <div className="text-center mb-8 pb-6 border-b border-border">
                <p className="text-sm tracking-[0.3em] text-muted-foreground uppercase mb-2">
                  {language === 'de' ? "Beispiel" : "Example"}
                </p>
                <h2 className="text-2xl md:text-3xl font-serif font-medium">
                  Flying Buffet Menü
                </h2>
              </div>

              {/* Menu Courses */}
              <div className="space-y-8">
                {courseOrder.map((type) => {
                  const courses = groupedCourses[type];
                  if (!courses) return null;

                  return (
                    <div key={type} className="space-y-4">
                      {/* Course Type Header */}
                      <h3 className="text-xs tracking-[0.25em] text-primary uppercase text-center font-medium">
                        {getCourseTypeLabel(type, language)}
                      </h3>

                      {/* Dishes */}
                      {courses.map((course, index) => (
                        <div key={index} className="text-center py-3">
                          <h4 className="text-lg md:text-xl font-serif font-medium mb-2">
                            {language === 'de' ? course.name : course.name_en}
                          </h4>
                          {course.description && (
                            <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-lg mx-auto">
                              {language === 'de' ? course.description : course.description_en}
                            </p>
                          )}
                          {course.items && (
                            <div className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-lg mx-auto space-y-1">
                              {(language === 'de' ? course.items : course.items_en)?.map((item, i) => (
                                <p key={i}>{item}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Separator */}
                      <div className="flex items-center justify-center pt-4">
                        <div className="w-8 h-px bg-border" />
                        <div className="mx-3 text-primary/40">✦</div>
                        <div className="w-8 h-px bg-border" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Menu Footer Note */}
              <div className="mt-10 pt-8 border-t border-border text-center">
                <p className="text-sm text-muted-foreground italic">
                  {language === 'de'
                    ? "Dieses Menü dient als Beispiel. Wir gestalten Ihr individuelles Menü gerne nach Ihren Wünschen."
                    : "This menu serves as an example. We are happy to create your custom menu according to your wishes."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Event Services */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-xl md:text-2xl font-serif font-medium text-center mb-8">
              {language === 'de' ? "Event-Services" : "Event Services"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {eventServices.map((service, index) => {
                const Icon = service.icon;
                return (
                  <div 
                    key={index}
                    className="bg-card rounded-lg p-6 text-center shadow-sm border border-border/50"
                  >
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-medium mb-1">
                      {language === 'de' ? service.titleDe : service.titleEn}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {language === 'de' ? service.subtitleDe : service.subtitleEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-xl md:text-2xl font-serif font-medium mb-4">
              {language === 'de' ? "Interesse an einem Event?" : "Interested in an Event?"}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              {language === 'de'
                ? "Kontaktieren Sie uns für eine persönliche Beratung und ein individuelles Angebot."
                : "Contact us for personal consultation and a custom quote."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="gap-2">
                <a href="tel:+498951519696">
                  <Phone className="w-4 h-4" />
                  +49 89 51519696
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <a href="mailto:info@storia-restaurant.de">
                  <Mail className="w-4 h-4" />
                  E-Mail
                </a>
              </Button>
            </div>
          </div>
        </section>

        <CateringCTA />
      </main>

      <Footer />
    </>
  );
};

export default FlyingBuffet;
