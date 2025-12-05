import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import ReservationCTA from "@/components/ReservationCTA";
import { Button } from "@/components/ui/button";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const NeapolitanischePizza = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Neapolitanische Pizza München – Steinofen Pizzeria' : 'Neapolitan Pizza Munich – Stone Oven Pizzeria'}
        description={language === 'de' 
          ? 'Neapolitanische Pizza München im STORIA: Authentische Pizza aus dem Steinofen in der Maxvorstadt. Pizzeria nahe Königsplatz. Jetzt Tisch reservieren!'
          : 'Neapolitan pizza Munich at STORIA: Authentic stone-oven pizza in Maxvorstadt. Pizzeria near Königsplatz. Book your table now!'}
        canonical="/neapolitanische-pizza-muenchen"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Neapolitanische Pizza München' : 'Neapolitan Pizza Munich', url: '/neapolitanische-pizza-muenchen' }
        ]} 
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4 py-8 text-center">
            <Link to="/">
              <img src={storiaLogo} alt="STORIA – Italienisches Restaurant München" className="h-24 md:h-32 mx-auto mb-4 hover:opacity-80 transition-opacity cursor-pointer" />
            </Link>
            <p className="text-lg text-muted-foreground tracking-wide">
              RISTORANTE · PIZZERIA · BAR
            </p>
          </div>
        </div>
        <Navigation />
        
        <main className="container mx-auto px-4 py-12 flex-grow">
          <article className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-serif font-bold mb-6 text-center">
              {language === 'de' ? 'Neapolitanische Pizza München – Steinofen Pizzeria STORIA' : 'Neapolitan Pizza Munich – Stone Oven Pizzeria STORIA'}
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
              {language === 'de'
                ? 'Erleben Sie echte neapolitanische Pizza im STORIA. Traditionell im Steinofen gebacken, mit San-Marzano-Tomaten und frischem Mozzarella – so wie in Napoli.'
                : 'Experience authentic Neapolitan pizza at STORIA. Traditionally baked in a stone oven, with San Marzano tomatoes and fresh mozzarella – just like in Naples.'}
            </p>

            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Unsere Pizza-Philosophie' : 'Our Pizza Philosophy'}
              </h2>
              <ul className="space-y-3 text-muted-foreground mb-6">
                <li>✓ {language === 'de' ? 'Traditioneller Steinofen' : 'Traditional stone oven'}</li>
                <li>✓ {language === 'de' ? 'San-Marzano-Tomaten aus Kampanien' : 'San Marzano tomatoes from Campania'}</li>
                <li>✓ {language === 'de' ? 'Frischer Fior di Latte Mozzarella' : 'Fresh Fior di Latte mozzarella'}</li>
                <li>✓ {language === 'de' ? '24-48 Stunden Teigruhe' : '24-48 hours dough fermentation'}</li>
                <li>✓ {language === 'de' ? 'Italienisches Tipo-00-Mehl' : 'Italian Tipo 00 flour'}</li>
              </ul>
            </div>

            <div className="bg-secondary/50 p-8 rounded-lg mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Pizza wie in Napoli' : 'Pizza Like in Naples'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {language === 'de'
                  ? 'Von der klassischen Margherita bis zur Quattro Formaggi – unsere Pizzen werden nach traditioneller neapolitanischer Art zubereitet. Der luftige Teig, die knusprige Kruste und die hochwertigen Zutaten machen jede Pizza zu einem Genuss.'
                  : 'From the classic Margherita to Quattro Formaggi – our pizzas are prepared in traditional Neapolitan style. The airy dough, crispy crust and high-quality ingredients make every pizza a delight.'}
              </p>
              <p className="text-muted-foreground mb-4">
                {language === 'de'
                  ? 'Besuchen Sie uns in der Karlstraße 47a in der Maxvorstadt – nur wenige Gehminuten vom Königsplatz und dem Hauptbahnhof entfernt.'
                  : 'Visit us at Karlstraße 47a in Maxvorstadt – just a few minutes walk from Königsplatz and the main station.'}
              </p>
              <div className="flex flex-wrap gap-4 mt-6">
                <Button asChild>
                  <Link to="/speisekarte">{language === 'de' ? 'Speisekarte ansehen' : 'View Menu'}</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/reservierung">{language === 'de' ? 'Tisch reservieren' : 'Book a Table'}</Link>
                </Button>
              </div>
            </div>

            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Beliebte Pizzen' : 'Popular Pizzas'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-muted-foreground">
                <div>
                  <h3 className="font-semibold text-foreground">Margherita</h3>
                  <p className="text-sm">{language === 'de' ? 'Tomaten, Mozzarella, Basilikum' : 'Tomatoes, mozzarella, basil'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Diavola</h3>
                  <p className="text-sm">{language === 'de' ? 'Scharfe Salami, Tomaten, Mozzarella' : 'Spicy salami, tomatoes, mozzarella'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Quattro Formaggi</h3>
                  <p className="text-sm">{language === 'de' ? 'Vier italienische Käsesorten' : 'Four Italian cheeses'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Prosciutto e Rucola</h3>
                  <p className="text-sm">{language === 'de' ? 'Parmaschinken, Rucola, Parmesan' : 'Parma ham, arugula, parmesan'}</p>
                </div>
              </div>
            </div>

            <ReservationCTA />
          </article>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default NeapolitanischePizza;
