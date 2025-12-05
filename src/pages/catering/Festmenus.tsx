import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Building2, Users, Wine, Phone, Mail, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/catering/festmenus/hero.webp";

interface SetMenu {
  id: string;
  name: string;
  name_en: string;
  price: number;
  courses: {
    name: string;
    name_en: string;
  }[];
  isVegetarian?: boolean;
}

const threeCoursMenus: SetMenu[] = [
  {
    id: "vegetarisches-festmenu",
    name: "Vegetarisches Festmenü",
    name_en: "Vegetarian Feast Menu",
    price: 42,
    isVegetarian: true,
    courses: [
      { name: "Sellerie-Birnencremesuppe mit Zimtcroutons", name_en: "Celery pear cream soup with cinnamon croutons" },
      { name: "Cremiges Kürbisrisotto mit Taleggiokäse und schwarzem Trüffel", name_en: "Creamy pumpkin risotto with Taleggio cheese and black truffle" },
      { name: "Tonkabohnen Panna Cotta auf Orangencurd", name_en: "Tonka bean Panna Cotta on orange curd" }
    ]
  },
  {
    id: "mediterraner-winterklassiker",
    name: "Mediterraner Winterklassiker",
    name_en: "Mediterranean Winter Classic",
    price: 45,
    courses: [
      { name: "Gegrillter Ziegenkäse, Feldsalat mit feinem Waldhonig und knusprigen Walnüssen", name_en: "Grilled goat cheese, lamb's lettuce with fine forest honey and crispy walnuts" },
      { name: "Filet von der Dorade rosé, Wildfang, auf aromatischen Martini-Belugalinsen", name_en: "Wild-caught sea bream fillet rosé on aromatic Martini Beluga lentils" },
      { name: "Tonkabohnen Panna Cotta auf Orangencurd", name_en: "Tonka bean Panna Cotta on orange curd" }
    ]
  },
  {
    id: "herzhafter-wintergenuss",
    name: "Herzhafter Wintergenuss",
    name_en: "Hearty Winter Delight",
    price: 45,
    courses: [
      { name: "Rote Beete Carpaccio mit cremiger Ziegenkäsemousse und gerösteten Walnüssen", name_en: "Beetroot carpaccio with creamy goat cheese mousse and roasted walnuts" },
      { name: "Zart geschmortes Hirschragout auf cremiger Parmigiano Polenta", name_en: "Tender braised venison ragout on creamy Parmigiano polenta" },
      { name: "Bucchinotti, feines Gebäck mit Kastanienschokolade auf samtiger Zimtcreme", name_en: "Bucchinotti, fine pastry with chestnut chocolate on velvety cinnamon cream" }
    ]
  },
  {
    id: "meer-winterfrische",
    name: "Meer & Winterfrische",
    name_en: "Sea & Winter Freshness",
    price: 48,
    courses: [
      { name: "Carpaccio vom Octopus mit Jakobsmuscheln in feiner Kräuter-Zitrusmarinade", name_en: "Octopus carpaccio with scallops in fine herb-citrus marinade" },
      { name: "Loup de Mer Filet auf Orangencreme mit Winterwurzelgemüse", name_en: "Sea bass fillet on orange cream with winter root vegetables" },
      { name: "Bucchinotti, feines Gebäck mit Kastanienschokolade auf samtiger Zimtcreme", name_en: "Bucchinotti, fine pastry with chestnut chocolate on velvety cinnamon cream" }
    ]
  }
];

const fourCourseMenus: SetMenu[] = [
  {
    id: "vegetarische-eleganz",
    name: "Vegetarische Eleganz",
    name_en: "Vegetarian Elegance",
    price: 55,
    isVegetarian: true,
    courses: [
      { name: "Champagner-Kastaniencremesuppe mit getrüffeltem Crème Fraîche", name_en: "Champagne chestnut cream soup with truffled crème fraîche" },
      { name: "Rote Beete Carpaccio mit cremiger Ziegenkäsemousse und gerösteten Walnüssen", name_en: "Beetroot carpaccio with creamy goat cheese mousse and roasted walnuts" },
      { name: "Gnocchi gefüllt mit Steinpilzen und gehobeltem Parmigiano", name_en: "Gnocchi filled with porcini mushrooms and shaved Parmigiano" },
      { name: "Duett aus dunkler und weißer Schokoladenmousse mit Granatapfel-Coulis", name_en: "Duet of dark and white chocolate mousse with pomegranate coulis" }
    ]
  },
  {
    id: "festliche-winterkueche",
    name: "Festliche Winterküche",
    name_en: "Festive Winter Kitchen",
    price: 62,
    courses: [
      { name: "Ofenpaprika-Cremesuppe mit Garnele", name_en: "Roasted bell pepper cream soup with shrimp" },
      { name: "Tagliolini mit Garnelen in feinem Hummerfond", name_en: "Tagliolini with prawns in fine lobster stock" },
      { name: "Filet von der Dorade rosé, Wildfang, auf Martini-Belugalinsen", name_en: "Wild-caught sea bream fillet rosé on Martini Beluga lentils" },
      { name: "Pistazientörtchen auf Zimt-Vanillecreme", name_en: "Pistachio tartlet on cinnamon vanilla cream" }
    ]
  },
  {
    id: "winterliche-harmonie",
    name: "Winterliche Harmonie",
    name_en: "Winter Harmony",
    price: 62,
    courses: [
      { name: "Zartes Entenbrust Carpaccio mit Orangencreme und karamellisierten Maronen", name_en: "Tender duck breast carpaccio with orange cream and caramelized chestnuts" },
      { name: "Hausgemachte Ravioli mit Taleggiokäse-Birne-Füllung, Walnüsse", name_en: "Homemade ravioli with Taleggio cheese-pear filling, walnuts" },
      { name: "Rinderfiletmedaillon auf cremigem getrüffeltem Petersilienwurzelpüree", name_en: "Beef fillet medallion on creamy truffled parsley root purée" },
      { name: "Duett aus dunkler und weißer Schokoladenmousse mit Granatapfel-Coulis", name_en: "Duet of dark and white chocolate mousse with pomegranate coulis" }
    ]
  },
  {
    id: "surf-turf-winteredition",
    name: "Surf & Turf Winteredition",
    name_en: "Surf & Turf Winter Edition",
    price: 75,
    courses: [
      { name: "Gegrillter Ziegenkäse, Feldsalat mit feinem Waldhonig und knusprigen Walnüssen", name_en: "Grilled goat cheese, lamb's lettuce with fine forest honey and crispy walnuts" },
      { name: "Filet von der Dorade rosé, Wildfang, auf Martini-Belugalinsen", name_en: "Wild-caught sea bream fillet rosé on Martini Beluga lentils" },
      { name: "Rosa gebratener Rehrücken mit Wachholder und Rosmarin auf Petersilienwurzelpüree", name_en: "Pink roasted venison saddle with juniper and rosemary on parsley root purée" },
      { name: "Bucchinotti, feines Gebäck mit Kastanienschokolade auf samtiger Zimtcreme", name_en: "Bucchinotti, fine pastry with chestnut chocolate on velvety cinnamon cream" }
    ]
  }
];

const MenuCard = ({ menu, language }: { menu: SetMenu; language: string }) => {
  const name = language === 'de' ? menu.name : menu.name_en;
  
  return (
    <div className="bg-card border border-border/50 rounded-lg p-6 md:p-8 relative">
      {menu.isVegetarian && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm">
          <Leaf className="h-4 w-4" />
          <span>{language === 'de' ? 'Vegetarisch' : 'Vegetarian'}</span>
        </div>
      )}
      
      <div className="flex justify-between items-start mb-6">
        <h3 className="font-serif text-xl md:text-2xl font-medium pr-20">{name}</h3>
        <span className="text-xl md:text-2xl font-medium text-primary whitespace-nowrap">{menu.price} €</span>
      </div>
      
      <div className="space-y-4">
        {menu.courses.map((course, index) => (
          <div key={index} className="text-center">
            <p className="text-muted-foreground leading-relaxed">
              {language === 'de' ? course.name : course.name_en}
            </p>
            {index < menu.courses.length - 1 && (
              <div className="flex justify-center mt-4">
                <span className="text-primary/60">✦</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const Festmenus = () => {
  const { language } = useLanguage();

  const eventServices = [
    {
      icon: Building2,
      title: language === 'de' ? 'Location' : 'Venue',
      description: language === 'de' ? 'Bis zu 120 Gäste' : 'Up to 120 guests'
    },
    {
      icon: Users,
      title: 'Service',
      description: language === 'de' ? 'Personal inklusive' : 'Staff included'
    },
    {
      icon: Wine,
      title: language === 'de' ? 'Getränke' : 'Beverages',
      description: language === 'de' ? 'Weinpairing möglich' : 'Wine pairing available'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative h-[50vh] md:h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt={language === 'de' ? '3- & 4-Gänge Festmenüs' : '3 & 4 Course Set Menus'}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 text-center text-white px-4">
          <h1 className="text-3xl md:text-5xl font-serif font-medium mb-4">
            {language === 'de' ? '3- & 4-Gänge Festmenüs' : '3 & 4 Course Set Menus'}
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
            {language === 'de' 
              ? 'Exklusive Menüs für besondere Anlässe im Restaurant'
              : 'Exclusive menus for special occasions at the restaurant'}
          </p>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              {language === 'de'
                ? 'Feiern Sie Ihre besonderen Momente mit unseren sorgfältig komponierten Festmenüs. Jedes Menü ist eine kulinarische Reise durch die italienische Küche – perfekt für Geburtstage, Firmenfeiern oder romantische Abende.'
                : 'Celebrate your special moments with our carefully composed set menus. Each menu is a culinary journey through Italian cuisine – perfect for birthdays, corporate events or romantic evenings.'}
            </p>
          </div>
        </div>
      </section>

      {/* 3-Course Menus */}
      <section className="py-8 md:py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-10">
            {language === 'de' ? '3-Gänge-Menüs' : '3-Course Menus'}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {threeCoursMenus.map((menu) => (
              <MenuCard key={menu.id} menu={menu} language={language} />
            ))}
          </div>
        </div>
      </section>

      {/* 4-Course Menus */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-10">
            {language === 'de' ? '4-Gänge-Menüs' : '4-Course Menus'}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {fourCourseMenus.map((menu) => (
              <MenuCard key={menu.id} menu={menu} language={language} />
            ))}
          </div>
        </div>
      </section>

      {/* Note */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center border-y border-border/50 py-8">
            <p className="text-muted-foreground italic">
              {language === 'de'
                ? 'Diese Menüs dienen als Beispiele für Ihre Veranstaltung. Gerne gestalten wir Ihr individuelles Menü nach Ihren Wünschen und saisonalen Verfügbarkeiten.'
                : 'These menus serve as examples for your event. We are happy to create your individual menu according to your wishes and seasonal availability.'}
            </p>
          </div>
        </div>
      </section>

      {/* Event Services */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-10">
            {language === 'de' ? 'Event-Services' : 'Event Services'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {eventServices.map((service, index) => (
              <div key={index} className="bg-card border border-border/50 rounded-lg p-6 text-center">
                <service.icon className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-medium mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
              {language === 'de' ? 'Interesse an einem Festmenü?' : 'Interested in a Set Menu?'}
            </h2>
            <p className="text-muted-foreground mb-8">
              {language === 'de'
                ? 'Kontaktieren Sie uns für eine individuelle Beratung und Reservierung.'
                : 'Contact us for individual consultation and reservation.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="gap-2">
                <a href="tel:+498951519696">
                  <Phone className="h-4 w-4" />
                  +49 89 51519696
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <a href="mailto:info@storia-restaurant.de">
                  <Mail className="h-4 w-4" />
                  E-Mail
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Festmenus;
