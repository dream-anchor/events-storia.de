import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";

const BusinessLunch = () => {
  const { language } = useLanguage();

  const packages = language === 'de' ? [
    { name: "Meeting Box", desc: "Belegte Brötchen, Antipasti, Dolci – ab 5 Personen" },
    { name: "Workshop Buffet", desc: "Warme und kalte Speisen für ganztägige Events" },
    { name: "Team Lunch Pasta", desc: "Verschiedene Pasta-Gerichte zum Teilen" },
    { name: "Executive Lunch", desc: "Premium-Auswahl für besondere Geschäftsanlässe" },
    { name: "Healthy Office", desc: "Leichte Gerichte mit Salaten und Antipasti" },
    { name: "Aperitivo Package", desc: "Häppchen und Getränke für After-Work" },
  ] : [
    { name: "Meeting Box", desc: "Sandwiches, antipasti, dolci – from 5 people" },
    { name: "Workshop Buffet", desc: "Hot and cold dishes for all-day events" },
    { name: "Team Lunch Pasta", desc: "Various pasta dishes for sharing" },
    { name: "Executive Lunch", desc: "Premium selection for special business occasions" },
    { name: "Healthy Office", desc: "Light dishes with salads and antipasti" },
    { name: "Aperitivo Package", desc: "Bites and drinks for after-work" },
  ];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Business Lunch & Office Catering | STORIA Catering München" : "Business Lunch & Office Catering | STORIA Catering Munich"}
        description={language === 'de' ? "Frische italienische Küche fürs Büro – Meetings, Workshops & Teams. STORIA Catering München." : "Fresh Italian cuisine for the office – meetings, workshops & teams. STORIA Catering Munich."}
        canonical="/catering/business-lunch"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Business Lunch & Office Catering' : 'Business Lunch & Office Catering'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Frische italienische Küche fürs Büro – Meetings, Workshops & Teams. Professionell geliefert, pünktlich servierbereit.'
                  : 'Fresh Italian cuisine for the office – meetings, workshops & teams. Professionally delivered, ready to serve on time.'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-serif font-medium mb-6 text-center">
                {language === 'de' ? 'Business Pakete' : 'Business Packages'}
              </h2>
              <div className="grid gap-4">
                {packages.map((pkg, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <h3 className="font-medium">{pkg.name}</h3>
                      <p className="text-sm text-muted-foreground">{pkg.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-8 italic">
                {language === 'de' 
                  ? 'Regelmäßige Bürobelieferung möglich. Kontaktieren Sie uns für ein individuelles Angebot.'
                  : 'Regular office delivery available. Contact us for a customized offer.'}
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

export default BusinessLunch;
