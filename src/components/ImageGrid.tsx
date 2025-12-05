import weinserviceImage from "@/assets/weinservice.webp";
import ravioliImage from "@/assets/ravioli.webp";
import drinksImage from "@/assets/cocktails.webp";
import breakfastImage from "@/assets/aussen.webp";
import restaurantImage from "@/assets/haus-aussen-2.webp";
import aperitivoImage from "@/assets/meeresfruchte.webp";
import dessertImage from "@/assets/tiramisu.webp";
import terrasseImage from "@/assets/menschen-aussen.jpeg";
import { useLanguage } from "@/contexts/LanguageContext";

interface ImageCardProps {
  image: string;
  alt: string;
  title?: string;
  subtitle?: string;
  className?: string;
  imageClassName?: string;
}

const ImageCard = ({ image, alt, title, subtitle, className = "", imageClassName = "" }: ImageCardProps) => {
  return (
    <div className={`relative overflow-hidden group ${className}`}>
      <img 
        src={image} 
        alt={alt} 
        className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${imageClassName}`}
        loading="lazy"
      />
      {(title || subtitle) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="bg-primary/85 backdrop-blur-sm px-8 py-5 rounded-sm">
            {title && (
              <h3 className="text-primary-foreground text-lg md:text-xl font-serif font-semibold mb-2 tracking-wide">{title}</h3>
            )}
            {subtitle && (
              <p className="text-primary-foreground/90 text-sm md:text-base font-medium leading-relaxed">
                {subtitle.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < subtitle.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ImageGrid = () => {
  const { t, language } = useLanguage();

  const altTexts = language === 'de' ? {
    weinservice: 'Professioneller Weinservice im Ristorante STORIA – Italiener Maxvorstadt München',
    ravioli: 'Handgemachte Ravioli in der Pizzeria Maxvorstadt – Ristorante Pizzeria STORIA',
    drinks: 'Handgefertigte Cocktails und Aperitivo in der Trattoria München STORIA',
    meeresfruchte: 'Frische Meeresfrüchte und Fischgerichte – La Storia München',
    aussen: 'Gemütliche Außenterrasse der Trattoria München – STORIA Münchner Innenstadt',
    hausAussen: 'Historisches Gebäude des Ristorante STORIA – Italiener Maxvorstadt Karlstraße München',
    tiramisu: 'Hausgemachtes Tiramisu im Ristorante Pizzeria STORIA München',
    menschenAussen: 'Gäste genießen italienische Küche – Pizza München Innenstadt auf der Terrasse',
  } : {
    weinservice: 'Professional wine service at Ristorante STORIA – Italian restaurant Maxvorstadt Munich',
    ravioli: 'Handmade ravioli at Pizzeria Maxvorstadt – Ristorante Pizzeria STORIA',
    drinks: 'Handcrafted cocktails and aperitivo at Italian trattoria STORIA Munich',
    meeresfruchte: 'Fresh seafood and fish dishes – La Storia Munich',
    aussen: 'Cozy outdoor terrace of Italian trattoria – STORIA Munich city center',
    hausAussen: 'Historic building of Ristorante STORIA – Italian restaurant Maxvorstadt Karlstraße Munich',
    tiramisu: 'Homemade tiramisu at Ristorante Pizzeria STORIA Munich',
    menschenAussen: 'Guests enjoying Italian cuisine – stone-oven pizza on the terrace',
  };

  return (
    <section className="bg-background py-12" aria-label={language === 'de' ? 'Bildergalerie Restaurant STORIA' : 'Image Gallery Restaurant STORIA'}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Row 1 */}
          <ImageCard 
            image={weinserviceImage} 
            alt={altTexts.weinservice}
            className="aspect-square"
            imageClassName="object-center"
          />
          <ImageCard 
            image={ravioliImage} 
            alt={altTexts.ravioli}
            title={t.imageGrid.openingHoursTitle}
            subtitle={t.imageGrid.openingHoursText}
            className="aspect-square"
            imageClassName="object-bottom"
          />
          <ImageCard 
            image={drinksImage} 
            alt={altTexts.drinks}
            className="aspect-square"
          />
          <ImageCard 
            image={aperitivoImage} 
            alt={altTexts.meeresfruchte}
            title={t.imageGrid.notturnoTitle}
            subtitle={t.imageGrid.notturnoText}
            className="aspect-square"
          />

          {/* Row 2 */}
          <ImageCard 
            image={breakfastImage} 
            alt={altTexts.aussen}
            title={t.imageGrid.breakfastTitle}
            subtitle={t.imageGrid.breakfastText}
            className="aspect-square"
          />
          <ImageCard 
            image={restaurantImage} 
            alt={altTexts.hausAussen}
            className="aspect-square"
            imageClassName="object-bottom"
          />
          <ImageCard 
            image={dessertImage} 
            alt={altTexts.tiramisu}
            className="aspect-square"
          />
          <ImageCard 
            image={terrasseImage} 
            alt={altTexts.menschenAussen}
            className="aspect-square"
          />
        </div>
      </div>
    </section>
  );
};

export default ImageGrid;
