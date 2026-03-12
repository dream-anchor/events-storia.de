import { useLanguage } from "@/contexts/LanguageContext";
import { LocalizedLink } from "@/components/LocalizedLink";

const SEO_LINKS = [
  { key: "seo.fingerfoodCatering" as const, de: "Fingerfood Catering", en: "Finger Food Catering" },
  { key: "seo.pizzaCatering" as const, de: "Pizza Catering", en: "Pizza Catering" },
  { key: "seo.bueroCatering" as const, de: "Büro Catering", en: "Office Catering" },
  { key: "seo.firmenfeier" as const, de: "Firmenfeier Catering", en: "Corporate Event Catering" },
  { key: "seo.weihnachtsfeier" as const, de: "Weihnachtsfeier Catering", en: "Christmas Party Catering" },
  { key: "seo.hochzeitCatering" as const, de: "Hochzeit Catering", en: "Wedding Catering" },
  { key: "seo.geburtstagCatering" as const, de: "Geburtstag Catering", en: "Birthday Catering" },
  { key: "seo.partyservice" as const, de: "Partyservice", en: "Party Service" },
  { key: "seo.messeCatering" as const, de: "Messe Catering", en: "Trade Fair Catering" },
  { key: "seo.cateringPreise" as const, de: "Catering Preise", en: "Catering Prices" },
  { key: "seo.lieferservice" as const, de: "Catering Lieferservice", en: "Catering Delivery" },
  { key: "seo.italienischesCatering" as const, de: "Italienisches Catering", en: "Italian Catering" },
  { key: "events" as const, de: "Events im STORIA", en: "Events at STORIA" },
  { key: "faq" as const, de: "FAQ Catering", en: "Catering FAQ" },
] as const;

const InternalLinks = () => {
  const { language } = useLanguage();

  return (
    <section className="bg-muted/30 border-t py-8 md:py-10">
      <div className="container mx-auto px-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4 text-center">
          {language === "de" ? "Weitere Catering-Themen" : "More Catering Topics"}
        </p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {SEO_LINKS.map(({ key, de, en }) => (
            <LocalizedLink
              key={key}
              to={key}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {language === "de" ? de : en}
            </LocalizedLink>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InternalLinks;
