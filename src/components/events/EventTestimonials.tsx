import { useLanguage } from "@/contexts/LanguageContext";
import ConsentElfsightReviews from "@/components/ConsentElfsightReviews";

const EventTestimonials = () => {
  const { language } = useLanguage();

  return (
    <section className="py-16 md:py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
            {language === 'de' ? 'Das sagen unsere Kunden' : 'What Our Clients Say'}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {language === 'de'
              ? 'Echte Bewertungen unserer Gäste von Google und TheFork'
              : 'Real reviews from our guests on Google and TheFork'}
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <ConsentElfsightReviews />
        </div>
      </div>
    </section>
  );
};

export default EventTestimonials;
