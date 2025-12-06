import { Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Testimonial {
  id: string;
  name: string;
  company: string;
  text: string;
  text_en: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "M. W.",
    company: "Technologieunternehmen",
    text: "Unsere Weihnachtsfeier im STORIA war ein voller Erfolg. Das Flying Buffet war exquisit und der Service erstklassig. Unsere 80 Mitarbeiter waren begeistert!",
    text_en: "Our Christmas party at STORIA was a complete success. The flying buffet was exquisite and the service was first-class. Our 80 employees were thrilled!",
    rating: 5
  },
  {
    id: "2",
    name: "S. H.",
    company: "Automobilkonzern",
    text: "Zum dritten Mal haben wir unser Team-Event hier gefeiert. Die individuelle Menügestaltung und die herzliche Betreuung machen den Unterschied. Absolute Empfehlung!",
    text_en: "For the third time, we celebrated our team event here. The individual menu design and warm care make the difference. Absolute recommendation!",
    rating: 5
  },
  {
    id: "3",
    name: "T. B.",
    company: "Versicherungsunternehmen",
    text: "Perfekte Location für unser Kundenevent. Die zentrale Lage, authentische italienische Küche und professioneller Service – alles top!",
    text_en: "Perfect location for our client event. The central location, authentic Italian cuisine and professional service – everything top!",
    rating: 5
  }
];

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
              ? 'Über 500 erfolgreiche Events in den letzten Jahren' 
              : 'Over 500 successful events in recent years'}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial) => (
            <div 
              key={testimonial.id}
              className="bg-card border border-border/50 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              
              {/* Quote */}
              <blockquote className="text-muted-foreground text-sm leading-relaxed mb-6">
                "{language === 'de' ? testimonial.text : testimonial.text_en}"
              </blockquote>
              
              {/* Author */}
              <div className="border-t border-border/50 pt-4">
                <p className="font-medium text-sm">{testimonial.name}</p>
                <p className="text-xs text-muted-foreground">{testimonial.company}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EventTestimonials;
