import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const CateringCTA = () => {
  const { language } = useLanguage();

  return (
    <section className="bg-primary/10 py-16 md:py-20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-xl md:text-2xl font-serif font-semibold mb-4">
          {language === 'de' 
            ? 'Ihr Event. Ihr Büro. Ihr Zuhause. Unser Catering.' 
            : 'Your Event. Your Office. Your Home. Our Catering.'}
        </h2>
        <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
          {language === 'de' 
            ? 'Wir erstellen Ihnen ein individuelles Catering-Angebot – passend zu Personenanzahl, Anlass und Budget. Frisch gekocht, zuverlässig geliefert, sofort servierbereit.' 
            : 'We create a customized catering offer for you – tailored to the number of guests, occasion and budget. Freshly prepared, reliably delivered, ready to serve immediately.'}
        </p>
        <Button size="lg" asChild>
          <Link to="/events#contact">
            {language === 'de' ? 'Unverbindlich anfragen' : 'Request a Quote'}
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default CateringCTA;
