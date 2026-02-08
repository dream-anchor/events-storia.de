import { useLanguage } from "@/contexts/LanguageContext";
import { LocalizedLink } from "@/components/LocalizedLink";
import type { RouteKey } from "@/config/routes";

// SEO-optimierte Bildnamen
import fingerfoodImg from "@/assets/catering/fingerfood/fingerfood-burratina-catering-storia-muenchen.webp";
import plattenImg from "@/assets/catering/platten/vitello-tonnato-buffet-catering-muenchen.webp";
import auflaufImg from "@/assets/catering/auflauf/lasagne-auflauf-catering-storia-muenchen.webp";
import pizzaImg from "@/assets/catering/pizze/pizza-napoletana-steinofen-storia-muenchen.webp";
import dessertsImg from "@/assets/catering/fingerfood/tiramisu-dessert-catering-storia-muenchen.webp";
import eventsImg from "@/assets/events/firmenfeier-eventlocation-storia-muenchen.webp";

interface CateringItem {
  id: string;
  titleDe: string;
  titleEn: string;
  descriptionDe: string;
  descriptionEn: string;
  altDe: string;
  altEn: string;
  routeKey: RouteKey;
  image: string;
}

const cateringItems: CateringItem[] = [
  {
    id: "events",
    titleDe: "Events im Storia",
    titleEn: "Events at Storia",
    descriptionDe: "Private Feiern & Firmenevents – individuelle Menüs im Restaurant.",
    descriptionEn: "Private parties & corporate events – custom menus at the restaurant.",
    altDe: "Firmenfeier & Events im Ristorante STORIA München – Italienisches Catering",
    altEn: "Corporate events at Ristorante STORIA Munich – Italian catering",
    routeKey: "events",
    image: eventsImg,
  },
  {
    id: "fingerfood",
    titleDe: "Fingerfood & Mini-Gerichte",
    titleEn: "Finger Food & Mini Dishes",
    descriptionDe: "Elegante Häppchen für Empfänge, Meetings & gesellige Runden.",
    descriptionEn: "Elegant bites for receptions, meetings & social gatherings.",
    altDe: "Italienisches Fingerfood Burratina – STORIA Catering München für Events & Büro",
    altEn: "Italian finger food Burratina – STORIA Catering Munich for events & office",
    routeKey: "catering.fingerfood",
    image: fingerfoodImg,
  },
  {
    id: "platten",
    titleDe: "Platten & Sharing",
    titleEn: "Platters & Sharing",
    descriptionDe: "Ideal für Teams, Familien & private Dinner – servierfertig geliefert.",
    descriptionEn: "Ideal for teams, families & private dinners – delivered ready to serve.",
    altDe: "Vitello Tonnato Buffet-Platte – Italienisches Catering STORIA München",
    altEn: "Vitello Tonnato buffet platter – Italian catering STORIA Munich",
    routeKey: "catering.platters",
    image: plattenImg,
  },
  {
    id: "auflauf",
    titleDe: "Warme Gerichte & Aufläufe",
    titleEn: "Hot Dishes & Casseroles",
    descriptionDe: "Wie hausgemacht – ofenfrisch geliefert für Büro, Zuhause oder Events.",
    descriptionEn: "Like homemade – delivered oven-fresh for office, home or events.",
    altDe: "Hausgemachte Lasagne – Warme Gerichte Catering STORIA München",
    altEn: "Homemade lasagna – Hot dishes catering STORIA Munich",
    routeKey: "catering.casseroles",
    image: auflaufImg,
  },
  {
    id: "pizza",
    titleDe: "Pizza Napoletana",
    titleEn: "Pizza Napoletana",
    descriptionDe: "Frisch aus dem Steinofen – knusprig, heiß geliefert, überall genießbar.",
    descriptionEn: "Fresh from the stone oven – crispy, delivered hot, enjoyable anywhere.",
    altDe: "Pizza Napoletana aus dem Steinofen – STORIA Catering München Lieferservice",
    altEn: "Pizza Napoletana from the stone oven – STORIA Catering Munich delivery",
    routeKey: "catering.pizza",
    image: pizzaImg,
  },
  {
    id: "desserts",
    titleDe: "Desserts",
    titleEn: "Desserts",
    descriptionDe: "Süße Verführungen im Glas – Tiramisù & Pistazien-Törtchen.",
    descriptionEn: "Sweet temptations in a glass – Tiramisù & Pistachio Tartlets.",
    altDe: "Tiramisù im Glas – Italienische Desserts Catering STORIA München",
    altEn: "Tiramisù in a glass – Italian desserts catering STORIA Munich",
    routeKey: "catering.desserts",
    image: dessertsImg,
  },
];

const CateringCard = ({ item, language, index }: { item: CateringItem; language: string; index: number }) => {
  const title = language === 'de' ? item.titleDe : item.titleEn;
  const description = language === 'de' ? item.descriptionDe : item.descriptionEn;
  const isAboveFold = index === 0;

  return (
    <LocalizedLink
      to={item.routeKey}
      className="group relative overflow-hidden aspect-[3/2] block shadow-lg hover:shadow-xl transition-all duration-300"
    >
      {/* Bild mit Zoom-Effekt */}
      <img
        src={item.image}
        alt={language === 'de' ? item.altDe : item.altEn}
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
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
        <div className="backdrop-blur-sm bg-black/20 rounded-lg p-2.5">
          <h3 className="text-xl md:text-2xl font-serif font-semibold mb-1 text-white drop-shadow-lg">
            {title}
          </h3>
          <p className="text-base md:text-lg text-white leading-relaxed drop-shadow-lg line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </LocalizedLink>
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
          className="font-display text-center text-lg md:text-xl text-muted-foreground tracking-[0.2em] uppercase mb-2"
        >
          {language === 'de' ? 'Unsere Catering-Kategorien' : 'Our Catering Categories'}
        </h2>
        <p className="font-display text-center text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-6">
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
