import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import storiaLogo from "@/assets/storia-logo.webp";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <SEO 
        title="Seite nicht gefunden"
        description="Die angeforderte Seite konnte nicht gefunden werden. Besuchen Sie unsere Startseite oder kontaktieren Sie uns."
        noIndex={true}
      />
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Link to="/">
          <img 
            src={storiaLogo} 
            alt="STORIA Logo" 
            className="h-24 md:h-32 mb-8 hover:opacity-80 transition-opacity"
          />
        </Link>
        
        <div className="text-center max-w-md">
          <h1 className="text-6xl md:text-8xl font-serif font-bold text-primary mb-4">404</h1>
          <p className="text-xl md:text-2xl text-foreground mb-2">Seite nicht gefunden</p>
          <p className="text-muted-foreground mb-8">
            Die angeforderte Seite existiert leider nicht. Vielleicht finden Sie hier, was Sie suchen:
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button asChild size="lg" className="gap-2">
              <Link to="/">
                <Home className="h-4 w-4" />
                Zur Startseite
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link to="/reservierung">
                Tisch reservieren
              </Link>
            </Button>
          </div>
          
          <div className="border-t border-border pt-8">
            <p className="text-sm text-muted-foreground mb-4">Oder kontaktieren Sie uns direkt:</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
              <a 
                href="tel:+498951519696" 
                className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" />
                +49 89 51519696
              </a>
              <a 
                href="mailto:info@ristorantestoria.de" 
                className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                info@ristorantestoria.de
              </a>
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Karlstraße 47a, 80333 München
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;
