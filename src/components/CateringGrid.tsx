import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

// Bessere Bildauswahl mit echten Fotos
import fingerfoodImg from "@/assets/catering/fingerfood/burratina.webp";
import plattenImg from "@/assets/catering/platten/vitello-tonnato.webp";
import auflaufImg from "@/assets/catering/auflauf/lasagna.webp";
import pizzaImg from "@/assets/catering/pizze/hero-pizza.webp";
import dessertsImg from "@/assets/catering/fingerfood/tiramisu.webp";
import eventsImg from "@/assets/events/firmenfeier-3.webp";

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
    descriptionDe: "Frisch aus dem Steinofen – knusprig, heiß geliefert, überall genießbar.",
    descriptionEn: "Fresh from the stone oven – crispy, delivered hot, enjoyable anywhere.",
    path: "/catering/pizze-napoletane",
    image: pizzaImg,
  },
  {
    id: "desserts",
    titleDe: "Desserts",
    titleEn: "Desserts",
    descriptionDe: "Süße Verführungen im Glas – Tiramisù & Pistazien-Törtchen.",
    descriptionEn: "Sweet temptations in a glass – Tiramisù & Pistachio Tartlets.",
    path: "/catering/desserts",
    image: dessertsImg,
  },
  {
    id: "events",
    titleDe: "Events im Storia",
    titleEn: "Events at Storia",
    descriptionDe: "Private Feiern & Firmenevents – individuelle Menüs im Restaurant.",
    descriptionEn: "Private parties & corporate events – custom menus at the restaurant.",
    path: "/events",
    image: eventsImg,
  },
];

const CateringCard = ({ item, language, index }: { item: CateringItem; language: string; index: number }) => {
  const title = language === 'de' ? item.titleDe : item.titleEn;
  const description = language === 'de' ? item.descriptionDe : item.descriptionEn;
  const isAboveFold = index < 3;

  return (
    <Link 
      to={item.path}
      className="group relative overflow-hidden aspect-[3/2] block shadow-lg hover:shadow-xl transition-all duration-300"
    >
      {/* Bild mit Zoom-Effekt */}
      <img
        src={item.image}
        alt={`${title} – STORIA Catering München`}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        width="600"
        height="400"
        loading={isAboveFold ? "eager" : "lazy"}
        fetchPriority={isAboveFold ? "high" : undefined}
        decoding="async"
      />
      
      {/* Minimaler Gradient nur am unteren Textbereich */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      
      {/* Hover-Overlay */}
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300" />
      
      {/* Text-Container mit Glassmorphism */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
        <div className="backdrop-blur-sm bg-black/20 rounded-lg p-3">
          <h3 className="text-xl md:text-2xl font-serif font-semibold mb-1 text-white drop-shadow-lg">
            {title}
          </h3>
          <p className="text-base md:text-lg text-white/90 leading-relaxed drop-shadow-md line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
};

const CateringGrid = () => {
  const { language } = useLanguage();

  return (
    <section className="bg-background py-6 md:py-10" aria-labelledby="catering-categories-heading">
      <div className="container mx-auto px-4">
        {/* SEO-freundliche Überschrift - dezent aber sichtbar */}
        <h2 
          id="catering-categories-heading" 
          className="text-center text-sm md:text-base font-light text-muted-foreground tracking-[0.2em] uppercase mb-2"
        >
          {language === 'de' ? 'Unsere Catering-Kategorien' : 'Our Catering Categories'}
        </h2>
        <p className="text-center text-sm text-muted-foreground max-w-xl mx-auto mb-6">
          {language === 'de'
            ? 'Fingerfood, Pizza, Pasta & mehr – frisch zubereitet und flexibel geliefert.'
            : 'Finger food, pizza, pasta & more – freshly prepared and flexibly delivered.'}
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cateringItems.map((item, index) => (
            <CateringCard key={item.id} item={item} language={language} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CateringGrid;
