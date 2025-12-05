import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

// Import first images from detail pages
import fingerfoodImg from "@/assets/catering/fingerfood/grillgemuese.webp";
import plattenImg from "@/assets/catering/platten/insalate-stagione.webp";
import auflaufImg from "@/assets/catering/auflauf/parmigiana.webp";
import pizzaImg from "@/assets/catering/pizze/hero-pizza.webp";
import flyingBuffetImg from "@/assets/catering/flying-buffet/hero.webp";
import festmenusImg from "@/assets/catering/festmenus/hero.webp";
import antipastiImg from "@/assets/cocktails.webp";
import dessertsImg from "@/assets/tiramisu.webp";
import businessImg from "@/assets/weinservice.webp";
import zuhauseImg from "@/assets/menschen-aussen.jpeg";

interface CateringItem {
  id: string;
  titleDe: string;
  titleEn: string;
  descriptionDe: string;
  descriptionEn: string;
  path: string;
  image: string;
}

const cateringItems: CateringItem[] = [
  {
    id: "fingerfood",
    titleDe: "Fingerfood & Mini-Gerichte",
    titleEn: "Finger Food & Mini Dishes",
    descriptionDe: "Elegante Häppchen für Empfänge, Meetings & gesellige Runden.",
    descriptionEn: "Elegant bites for receptions, meetings & social gatherings.",
    path: "/catering/buffet-fingerfood",
    image: fingerfoodImg,
  },
  {
    id: "platten",
    titleDe: "Platten & Sharing",
    titleEn: "Platters & Sharing",
    descriptionDe: "Ideal für Teams, Familien & private Dinner – servierfertig geliefert.",
    descriptionEn: "Ideal for teams, families & private dinners – delivered ready to serve.",
    path: "/catering/buffet-platten",
    image: plattenImg,
  },
  {
    id: "auflauf",
    titleDe: "Warme Gerichte & Aufläufe",
    titleEn: "Hot Dishes & Casseroles",
    descriptionDe: "Wie hausgemacht – ofenfrisch geliefert für Büro, Zuhause oder Events.",
    descriptionEn: "Like homemade – delivered oven-fresh for office, home or events.",
    path: "/catering/buffet-auflauf",
    image: auflaufImg,
  },
  {
    id: "pizza",
    titleDe: "Pizza Napoletana",
    titleEn: "Pizza Napoletana",
    descriptionDe: "Frisch aus dem Steinofen – heiß geliefert, überall genießbar.",
    descriptionEn: "Fresh from the stone oven – delivered hot, enjoyable anywhere.",
    path: "/catering/pizze-napoletane",
    image: pizzaImg,
  },
  {
    id: "flying-buffet",
    titleDe: "Flying Buffet & Events",
    titleEn: "Flying Buffet & Events",
    descriptionDe: "Veranstaltungen im Restaurant – individuelle Menüs für Ihr Event.",
    descriptionEn: "Events at the restaurant – custom menus for your celebration.",
    path: "/catering/flying-buffet",
    image: flyingBuffetImg,
  },
  {
    id: "festmenus",
    titleDe: "3- & 4-Gänge Festmenüs",
    titleEn: "3 & 4 Course Set Menus",
    descriptionDe: "Exklusive Menüs für besondere Anlässe – direkt im Restaurant.",
    descriptionEn: "Exclusive menus for special occasions – at the restaurant.",
    path: "/catering/festmenus",
    image: festmenusImg,
  },
  {
    id: "antipasti",
    titleDe: "Antipasti & Klassiker",
    titleEn: "Antipasti & Classics",
    descriptionDe: "Mediterrane Vorspeisen für Zuhause, Office-Lunch oder Aperitivo.",
    descriptionEn: "Mediterranean starters for home, office lunch or aperitivo.",
    path: "/catering/antipasti",
    image: antipastiImg,
  },
  {
    id: "desserts",
    titleDe: "Desserts & Dolci",
    titleEn: "Desserts & Dolci",
    descriptionDe: "Der perfekte Abschluss – ideal auch für Zuhause & kleine Feiern.",
    descriptionEn: "The perfect finish – also ideal for home & small celebrations.",
    path: "/catering/desserts",
    image: dessertsImg,
  },
  {
    id: "business",
    titleDe: "Business Lunch & Office Catering",
    titleEn: "Business Lunch & Office Catering",
    descriptionDe: "Frische italienische Küche fürs Büro – Meetings, Workshops & Teams.",
    descriptionEn: "Fresh Italian cuisine for the office – meetings, workshops & teams.",
    path: "/catering/business-lunch",
    image: businessImg,
  },
  {
    id: "zuhause",
    titleDe: "Catering für Zuhause",
    titleEn: "Catering for Home",
    descriptionDe: "Für private Feiern, Geburtstage oder ein entspanntes Essen daheim.",
    descriptionEn: "For private parties, birthdays or a relaxed meal at home.",
    path: "/catering/catering-zuhause",
    image: zuhauseImg,
  },
];

const CateringCard = ({ item, language }: { item: CateringItem; language: string }) => {
  const title = language === 'de' ? item.titleDe : item.titleEn;
  const description = language === 'de' ? item.descriptionDe : item.descriptionEn;

  return (
    <Link 
      to={item.path}
      className="group relative overflow-hidden rounded-lg aspect-square block"
    >
      <img
        src={item.image}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white">
        <h3 className="text-lg md:text-xl font-serif font-medium mb-2">
          {title}
        </h3>
        <p className="text-sm text-white/80 leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
};

const CateringGrid = () => {
  const { language } = useLanguage();

  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
            {language === 'de' 
              ? 'Catering für jeden Anlass: Events, Büro & Zuhause' 
              : 'Catering for Every Occasion: Events, Office & Home'}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {language === 'de'
              ? 'Entdecken Sie unsere beliebtesten Speisen – flexibel kombinierbar und für jede Gruppengröße geeignet.'
              : 'Discover our most popular dishes – flexibly combinable and suitable for any group size.'}
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {cateringItems.map((item) => (
            <CateringCard key={item.id} item={item} language={language} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CateringGrid;
