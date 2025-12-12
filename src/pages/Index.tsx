import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import CateringGrid from "@/components/CateringGrid";
import lieferungMuenchen from "@/assets/lieferung-muenchen.webp";
import CateringCTA from "@/components/CateringCTA";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import ConsentElfsightReviews from "@/components/ConsentElfsightReviews";
import { useLanguage } from "@/contexts/LanguageContext";

const Index = () => {
  const { language } = useLanguage();

  const faqItems = language === 'de' ? [
    {
      question: 'Was bietet STORIA Catering an?',
      answer: 'STORIA Catering bietet authentische italienische Küche für Events, Büro und Zuhause: Fingerfood, Platten, warme Gerichte, Pizza Napoletana, Antipasti, Desserts und individuelles Business Catering.',
    },
    {
      question: 'Wie kann ich ein Catering-Angebot anfragen?',
      answer: 'Sie können ganz einfach über unser Kontaktformular oder telefonisch unter +49 89 515196 ein unverbindliches Angebot anfragen. Wir beraten Sie gerne zu Ihrem Event.',
    },
    {
      question: 'Wohin liefert STORIA Catering?',
      answer: 'Wir liefern in ganz München und Umgebung. Kontaktieren Sie uns für Lieferungen außerhalb Münchens.',
    },
    {
      question: 'Für wie viele Personen kann ich Catering bestellen?',
      answer: 'Unser Catering ist flexibel – von kleinen Team-Lunches ab 5 Personen bis hin zu großen Events mit mehreren hundert Gästen.',
    },
    {
      question: 'Bietet STORIA auch Business Lunch und Office Catering an?',
      answer: 'Ja, wir bieten spezielles Business Catering für Meetings, Workshops und Team-Events. Frische italienische Küche direkt ins Büro geliefert.',
    },
  ] : [
    {
      question: 'What does STORIA Catering offer?',
      answer: 'STORIA Catering offers authentic Italian cuisine for events, office and home: finger food, platters, hot dishes, Pizza Napoletana, antipasti, desserts and custom business catering.',
    },
    {
      question: 'How can I request a catering quote?',
      answer: 'You can easily request a non-binding quote via our contact form or by calling +49 89 515196. We are happy to advise you on your event.',
    },
    {
      question: 'Where does STORIA Catering deliver?',
      answer: 'We deliver throughout Munich and surrounding areas. Contact us for deliveries outside Munich.',
    },
    {
      question: 'For how many people can I order catering?',
      answer: 'Our catering is flexible – from small team lunches starting at 5 people to large events with several hundred guests.',
    },
    {
      question: 'Does STORIA also offer business lunch and office catering?',
      answer: 'Yes, we offer special business catering for meetings, workshops and team events. Fresh Italian cuisine delivered directly to your office.',
    },
  ];

  return (
    <>
      <SEO canonical="/" />
      <StructuredData type="restaurant" faqItems={faqItems} />
      <Header />
      <Navigation />
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1">
          <Hero />
          <CateringGrid />
          
          {/* Delivery Image Section */}
          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4">
              <figure className="max-w-4xl mx-auto">
                <img
                  src={lieferungMuenchen}
                  alt={language === 'de' 
                    ? 'STORIA Catering Lieferservice München – Lieferwagen und Vespa am Marienplatz' 
                    : 'STORIA Catering Delivery Service Munich – Delivery truck and Vespa at Marienplatz'}
                  className="w-full rounded-xl shadow-lg"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="mt-2 text-xs text-center text-muted-foreground/75 leading-snug">
                  {language === 'de' 
                    ? 'Lieferung mit eigenen und bei Bedarf gemieteten Fahrzeugen. Abbildung dient der symbolischen Darstellung.' 
                    : 'Delivery with own and, if required, rented vehicles. Image is for illustrative purposes.'}
                </figcaption>
              </figure>
            </div>
          </section>
          
          {/* Customer Reviews Section */}
          <section className="py-16 md:py-20 bg-muted/30">
            <div className="container mx-auto px-4">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-serif font-medium mb-3">
                  {language === 'de' ? 'Bewertungen für das Ristorante STORIA' : 'Reviews for Ristorante STORIA'}
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  {language === 'de'
                    ? 'Erfahrungen aus unserem Restaurant in München'
                    : 'Experiences from our restaurant in Munich'}
                </p>
              </div>
              <ConsentElfsightReviews />
              <p className="text-center text-muted-foreground mt-8 max-w-2xl mx-auto">
                {language === 'de' ? (
                  <>Auf Wunsch liefern wir Ihnen diese Küche auch<br />nach Hause, ins Büro oder zum Event.</>
                ) : (
                  <>On request, we also deliver this cuisine<br />to your home, office or event.</>
                )}
              </p>
            </div>
          </section>
          
          <CateringCTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
