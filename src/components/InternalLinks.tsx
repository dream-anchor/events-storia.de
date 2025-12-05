import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const InternalLinks = () => {
  const { language } = useLanguage();

  const links = [
    {
      href: "/lunch-muenchen-maxvorstadt",
      de: "Lunch München",
      en: "Lunch Munich"
    },
    {
      href: "/aperitivo-muenchen",
      de: "Aperitivo München",
      en: "Aperitivo Munich"
    },
    {
      href: "/neapolitanische-pizza-muenchen",
      de: "Neapolitanische Pizza",
      en: "Neapolitan Pizza"
    },
    {
      href: "/romantisches-dinner-muenchen",
      de: "Romantisches Dinner",
      en: "Romantic Dinner"
    },
    {
      href: "/eventlocation-muenchen-maxvorstadt",
      de: "Eventlocation",
      en: "Event Location"
    },
    {
      href: "/firmenfeier-muenchen",
      de: "Firmenfeier",
      en: "Corporate Event"
    },
    {
      href: "/geburtstagsfeier-muenchen",
      de: "Geburtstagsfeier",
      en: "Birthday Party"
    }
  ];

  return (
    <section className="bg-secondary/30 py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-serif font-semibold text-center mb-8">
          {language === 'de' ? 'Entdecken Sie mehr' : 'Discover More'}
        </h2>
        <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="px-4 py-2 bg-background border border-border rounded-full text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              {language === 'de' ? link.de : link.en}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InternalLinks;
