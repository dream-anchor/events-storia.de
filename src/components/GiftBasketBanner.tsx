import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LocalizedLink } from "@/components/LocalizedLink";
import { KiBadge } from "@/components/KiBadge";
import { kiAltSuffix } from "@/lib/kiAlt";

/** Startseiten-Banner für die Geschenkkörbe, direkt unter dem Kategorienraster.
 *  Ersetzt die frühere 7. Kachel im Raster (Entscheidung Antoine 22.11.2026, Mockup-Variante A).
 *  Preise spiegeln gift_baskets.price_cents (Konzept: 99/139/249 €) – bei Preisänderung hier mitziehen. */
interface Basket {
  name: string;
  price: string;
  image: string;
  altDe: string;
  altEn: string;
}

const BASKETS: Basket[] = [
  {
    name: "Dolce Vita",
    price: "99 €",
    image: "/geschenkkoerbe/geschenkkorb-dolce-vita-moscato-dasti-600.webp",
    altDe: "Geschenkkorb Dolce Vita mit Moscato d’Asti – STORIA München",
    altEn: "Dolce Vita gift basket with Moscato d’Asti – STORIA Munich",
  },
  {
    name: "Gran Selezione",
    price: "249 €",
    image: "/geschenkkoerbe/geschenkkorb-gran-selezione-600.webp",
    altDe:
      "Geschenkkorb Gran Selezione mit italienischen Spezialitäten – STORIA München",
    altEn:
      "Gran Selezione gift basket with Italian specialities – STORIA Munich",
  },
  {
    name: "Sapori d’Italia",
    price: "139 €",
    image: "/geschenkkoerbe/geschenkkorb-sapori-d-italia-600.webp",
    altDe: "Geschenkkorb Sapori d’Italia – STORIA München",
    altEn: "Sapori d’Italia gift basket – STORIA Munich",
  },
];

// Preisleiste aufsteigend, Fächer mit dem großen Korb in der Mitte
const PRICE_ORDER = [0, 2, 1];

const FAN_POSITION = [
  "left-0 top-10 w-[35%] -rotate-[8deg] group-hover:-rotate-[11deg] group-hover:-translate-x-2 group-hover:translate-y-1",
  "left-[31.5%] top-0 z-10 w-[37%] rotate-1 group-hover:-translate-y-1.5",
  "right-0 top-12 z-20 w-[35%] rotate-[8deg] group-hover:rotate-[11deg] group-hover:translate-x-2 group-hover:translate-y-1",
];

// Handschrift auf den äußeren Polaroids nach außen, damit das mittlere sie nicht verdeckt
const CAPTION_ALIGN = [
  "justify-start pl-[6%]",
  "justify-center",
  "justify-end pr-[6%]",
];

const GiftBasketBanner = () => {
  const { language } = useLanguage();
  const de = language === "de";

  return (
    <section
      className="bg-background pb-6 md:pb-10"
      aria-labelledby="gift-basket-banner-heading"
    >
      <div className="container mx-auto px-4">
        <LocalizedLink
          to="catering.giftBaskets"
          className="group relative grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] items-center gap-6 overflow-hidden bg-[hsl(25_22%_11%)] text-[hsl(36_30%_94%)] px-5 py-8 sm:px-8 md:px-12 md:py-11 shadow-lg hover:shadow-xl transition-shadow duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(38_45%_62%)] focus-visible:ring-offset-2"
        >
          {/* Warmer Lichtschein hinter den Körben */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-1/2 left-[40%] -right-[10%] h-[120%] bg-[radial-gradient(closest-side,hsl(38_60%_50%/0.22),transparent)]"
          />

          {/* Text */}
          <div className="relative min-w-0">
            <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.22em] text-[hsl(38_45%_62%)]">
              <span
                aria-hidden="true"
                className="h-px w-7 bg-[hsl(38_45%_62%)]"
              />
              {de ? "Neu · Zum Verschenken" : "New · For gifting"}
            </p>
            <h2
              id="gift-basket-banner-heading"
              className="mt-4 mb-3.5 font-serif text-3xl md:text-[2.75rem] font-medium leading-[1.08] text-balance"
            >
              {de ? "Geschenkkörbe " : "Gift baskets "}
              <em className="italic text-[hsl(38_45%_62%)]">
                {de ? "aus dem STORIA" : "from STORIA"}
              </em>
            </h2>
            <p className="mb-6 max-w-[44ch] text-base leading-relaxed text-[hsl(36_15%_78%)]">
              {de
                ? "Italienische Spezialitäten und Wein, von Hand im Korb arrangiert. In der Karlstraße 47a abholen oder in München liefern lassen."
                : "Italian specialities and wine, arranged by hand in a basket. Pick up at Karlstraße 47a or have it delivered in Munich."}
            </p>

            <ul className="mb-6 flex border-y border-[hsl(36_20%_30%)]">
              {PRICE_ORDER.map((i) => (
                <li
                  key={BASKETS[i].name}
                  className="grid min-w-0 flex-1 grid-rows-[1fr_auto] gap-1 py-3 pr-3 [&+&]:border-l [&+&]:border-[hsl(36_20%_30%)] [&+&]:pl-3 sm:[&+&]:pl-4"
                >
                  <span className="text-[0.68rem] font-medium uppercase tracking-[0.12em] leading-snug text-[hsl(36_15%_65%)]">
                    {BASKETS[i].name}
                  </span>
                  <span className="font-serif text-xl sm:text-2xl font-medium tabular-nums">
                    {BASKETS[i].price}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[0.95rem] font-semibold text-primary-foreground transition-colors group-hover:bg-primary/90">
                {de ? "Geschenkkörbe ansehen" : "View gift baskets"}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
              <span className="text-sm text-[hsl(36_15%_70%)]">
                {de
                  ? "Auch zusammen mit Catering bestellbar"
                  : "Can also be ordered together with catering"}
              </span>
            </div>
          </div>

          {/* Drei Körbe im Fächer */}
          <div className="relative order-first lg:order-none h-[52vw] max-h-80 lg:max-h-none lg:h-[360px]">
            {BASKETS.map((basket, i) => (
              // Polaroid 600/i-Type (Polaroid-Support): Rahmen 88,5 × 107,5 mm, Bild 78,9 × 76,8 mm.
              // In % der Rahmenbreite: Rand seitlich 5,4 %, oben 6,5 %, unten ≈ 28 % (Rest, trägt die Handschrift).
              <figure
                key={basket.name}
                className={`absolute m-0 aspect-[88.5/107.5] bg-[hsl(40_33%_97%)] shadow-[0_2px_4px_rgb(0_0_0/0.25),0_18px_40px_rgb(0_0_0/0.45)] transition-transform duration-500 ease-out motion-reduce:transition-none ${FAN_POSITION[i]}`}
              >
                {/* Innerer Rahmen: Prozent-Abstände beziehen sich so auf die Polaroid-Breite */}
                <div className="flex h-full flex-col px-[5.4%] pt-[6.5%]">
                  <div className="relative shrink-0">
                    <img
                      src={basket.image}
                      alt={`${de ? basket.altDe : basket.altEn} ${kiAltSuffix(de ? "de" : "en")}`}
                      className="block aspect-[78.9/76.8] w-full object-cover object-[50%_60%] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
                      width="600"
                      height="584"
                      loading="lazy"
                      decoding="async"
                    />
                    <KiBadge size="mini" lang={de ? "de" : "en"} className="top-1 right-1" />
                  </div>
                  <figcaption
                    className={`flex flex-1 items-center ${CAPTION_ALIGN[i]} whitespace-nowrap font-signature text-[clamp(0.85rem,3.6vw,1.5rem)] leading-none text-[hsl(25_25%_22%)]`}
                  >
                    {basket.name}
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        </LocalizedLink>
      </div>
    </section>
  );
};

export default GiftBasketBanner;
